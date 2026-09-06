// ─────────────────────────────────────────────────────────────────────────────
// availabilityService.js
//
// Generates available booking slots from:
//   1. AvailabilityRule rows (recurring weekly windows in the host's tz)
//   2. AvailabilityException rows (date-specific overrides: BLOCK or CUSTOM)
//   3. Existing Consultation rows (subtract pending/confirmed/scheduled)
//   4. Service booking policy (minNoticeHours, maxAdvanceDays, duration, buffer)
//
// All time math is UTC-internal. Conversion to/from local times uses the IANA
// timezone strings stored on rules/exceptions (host) and provided by the client
// at query time (display only).
//
// Pure-function design: the algorithm itself takes inputs and returns slots —
// Prisma I/O is isolated to fetch wrappers, which makes the algorithm trivial
// to unit-test without a database.
// ─────────────────────────────────────────────────────────────────────────────

const prisma = require("../lib/prisma")
const { zonedTimeToUtc, utcToZonedTime, format: tzFormat } = require("date-fns-tz")
const { addDays, addMinutes, isBefore, isAfter, startOfDay, endOfDay } = require("date-fns")

// ─────────────────────────────────────────────────────────────────────────────
// Constants & helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Status values that occupy a slot (cannot be re-booked at the same time).
const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed", "scheduled"]

/**
 * Parse "HH:mm" into an object { h, m } with bounds-check.
 */
function parseHHmm(value) {
  if (typeof value !== "string") throw new Error(`Invalid time string: ${value}`)
  const match = value.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) throw new Error(`Invalid time string: ${value}`)
  const h = Number(match[1])
  const m = Number(match[2])
  if (h < 0 || h > 23 || m < 0 || m > 59) throw new Error(`Time out of range: ${value}`)
  return { h, m }
}

/**
 * Build the UTC Date that represents `dateLocal` (YYYY-MM-DD) at `HH:mm`
 * inside `timezone` (IANA). Handles DST correctly via date-fns-tz.
 */
function localDateTimeToUtc(dateLocal, timeStr, timezone) {
  const { h, m } = parseHHmm(timeStr)
  const hh = String(h).padStart(2, "0")
  const mm = String(m).padStart(2, "0")
  // ISO local string without offset — zonedTimeToUtc interprets it in `timezone`.
  return zonedTimeToUtc(`${dateLocal}T${hh}:${mm}:00`, timezone)
}

/**
 * Format a UTC Date as a YYYY-MM-DD string in the given timezone.
 */
function utcDateToLocalDateStr(utcDate, timezone) {
  return tzFormat(utcToZonedTime(utcDate, timezone), "yyyy-MM-dd", { timeZone: timezone })
}

/**
 * Returns the day-of-week (0=Sun..6=Sat) of `utcDate` as observed in `timezone`.
 */
function localDayOfWeek(utcDate, timezone) {
  return Number(tzFormat(utcToZonedTime(utcDate, timezone), "i", { timeZone: timezone })) % 7
  // Note: date-fns "i" returns 1=Mon..7=Sun (ISO). Modulo 7 maps 7→0 to align
  // with JS Date.getDay() convention used by AvailabilityRule.dayOfWeek.
}

// ─────────────────────────────────────────────────────────────────────────────
// Slot generation — pure algorithm
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate every candidate slot for a single date from a single rule.
 * Returns slots as array of { startUtc: Date, endUtc: Date }.
 */
function expandRuleForDate(rule, dateLocalStr) {
  const windowStartUtc = localDateTimeToUtc(dateLocalStr, rule.startTime, rule.timezone)
  const windowEndUtc   = localDateTimeToUtc(dateLocalStr, rule.endTime,   rule.timezone)

  // Defensive: require positive window
  if (!isBefore(windowStartUtc, windowEndUtc)) return []

  const stride = rule.slotDurationMin + (rule.bufferMin || 0)
  const slots = []
  let cursor = windowStartUtc
  while (true) {
    const slotEnd = addMinutes(cursor, rule.slotDurationMin)
    if (isAfter(slotEnd, windowEndUtc)) break
    slots.push({ startUtc: cursor, endUtc: slotEnd })
    cursor = addMinutes(cursor, stride)
  }
  return slots
}

/**
 * Subtract any slot that overlaps a busy interval (booked consultations, or a
 * BLOCK exception's UTC interval). Two intervals overlap when start<otherEnd
 * AND end>otherStart.
 */
function subtractBusy(slots, busyIntervals) {
  if (!busyIntervals.length) return slots
  return slots.filter((slot) => {
    return !busyIntervals.some(
      (b) => isBefore(slot.startUtc, b.endUtc) && isAfter(slot.endUtc, b.startUtc),
    )
  })
}

/**
 * Apply the service booking policy: drop slots earlier than minNotice,
 * drop slots beyond maxAdvance horizon.
 */
function applyPolicy(slots, { now, minNoticeHours, maxAdvanceDays }) {
  const earliest = addMinutes(now, minNoticeHours * 60)
  const latest   = addDays(now, maxAdvanceDays)
  return slots.filter(
    (s) => !isBefore(s.startUtc, earliest) && !isAfter(s.startUtc, latest),
  )
}

/**
 * Core: compute available slots for one specific local date for one host.
 * Pure-function (no I/O). The caller supplies all data.
 *
 * @param {Object} params
 * @param {string} params.dateLocal      YYYY-MM-DD in the displayTimezone
 * @param {string} params.displayTimezone Client's IANA tz (used to interpret dateLocal)
 * @param {Array}  params.rules          AvailabilityRule rows for the host (and optional service)
 * @param {Array}  params.exceptions     AvailabilityException rows for the host on/around the date
 * @param {Array}  params.busyIntervals  [{ startUtc, endUtc }] — booked consultations
 * @param {Object} params.policy         { minNoticeHours, maxAdvanceDays, slotDurationMin, bufferMin }
 * @param {Date}   params.now            Current UTC time (injected for testability)
 *
 * @returns {Array<{ startUtc: Date, endUtc: Date }>}
 */
function computeSlotsForDate({ dateLocal, displayTimezone, rules, exceptions, busyIntervals, policy, now }) {
  // Determine the local day-of-week for the requested date in the display timezone.
  // This is what we'll match against rule.dayOfWeek.
  // We use noon-local to avoid DST midnight ambiguity.
  const noonUtc = localDateTimeToUtc(dateLocal, "12:00", displayTimezone)
  const dow = localDayOfWeek(noonUtc, displayTimezone)

  // Filter exceptions to those whose date matches dateLocal (compared in their own tz).
  // An exception's `date` is stored as UTC midnight of the local day; convert to local.
  const todaysExceptions = exceptions.filter((ex) => {
    const exLocalDate = utcDateToLocalDateStr(ex.date, ex.timezone)
    return exLocalDate === dateLocal
  })

  const blockExceptions  = todaysExceptions.filter((ex) => ex.type === "block")
  const customExceptions = todaysExceptions.filter((ex) => ex.type === "custom")

  // 1. Expand recurring rules that match this dayOfWeek.
  const ruleSlots = rules
    .filter((r) => r.isActive && r.dayOfWeek === dow)
    .flatMap((r) =>
      expandRuleForDate(
        {
          ...r,
          slotDurationMin: r.slotDurationMin || policy.slotDurationMin || 30,
          bufferMin:       r.bufferMin       ?? policy.bufferMin       ?? 0,
        },
        dateLocal,
      ),
    )

  // 2. Expand CUSTOM exceptions (added windows outside recurring rules).
  const customSlots = customExceptions.flatMap((ex) => {
    if (!ex.startTime || !ex.endTime) return []
    return expandRuleForDate(
      {
        startTime: ex.startTime,
        endTime: ex.endTime,
        timezone: ex.timezone,
        slotDurationMin: policy.slotDurationMin || 30,
        bufferMin: policy.bufferMin || 0,
      },
      dateLocal,
    )
  })

  // 3. Combine, dedupe by startUtc, sort.
  const seen = new Set()
  let combined = [...ruleSlots, ...customSlots].filter((s) => {
    const key = s.startUtc.getTime()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  combined.sort((a, b) => a.startUtc.getTime() - b.startUtc.getTime())

  // 4. Subtract BLOCK exceptions (their full window).
  const blockIntervals = blockExceptions.map((ex) => ({
    startUtc: ex.startTime
      ? localDateTimeToUtc(dateLocal, ex.startTime, ex.timezone)
      : localDateTimeToUtc(dateLocal, "00:00", ex.timezone),
    endUtc: ex.endTime
      ? localDateTimeToUtc(dateLocal, ex.endTime, ex.timezone)
      : localDateTimeToUtc(dateLocal, "23:59", ex.timezone),
  }))
  combined = subtractBusy(combined, blockIntervals)

  // 5. Subtract booked consultations.
  combined = subtractBusy(combined, busyIntervals)

  // 6. Apply policy (notice + horizon).
  combined = applyPolicy(combined, {
    now,
    minNoticeHours: policy.minNoticeHours ?? 24,
    maxAdvanceDays: policy.maxAdvanceDays ?? 60,
  })

  return combined
}

// ─────────────────────────────────────────────────────────────────────────────
// Host resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the host user for a given service. Uses Service.createdById if set,
 * otherwise falls back to env DEFAULT_HOST_USER_ID, otherwise the first admin.
 * Cached in-memory for the process lifetime.
 */
const hostCache = new Map()

async function resolveHostUserId(serviceId) {
  if (serviceId && hostCache.has(serviceId)) return hostCache.get(serviceId)

  let hostId = null
  if (serviceId) {
    const svc = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { createdById: true },
    })
    hostId = svc?.createdById || null
  }

  if (!hostId && process.env.DEFAULT_HOST_USER_ID) {
    hostId = process.env.DEFAULT_HOST_USER_ID
  }

  if (!hostId) {
    const admin = await prisma.user.findFirst({
      where: { role: "admin", status: "active" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    })
    hostId = admin?.id || null
  }

  if (!hostId) {
    throw Object.assign(new Error("No host user configured for booking"), {
      statusCode: 500,
      code: "BOOKING_NO_HOST",
    })
  }

  if (serviceId) hostCache.set(serviceId, hostId)
  return hostId
}

function clearHostCache() { hostCache.clear() }

// ─────────────────────────────────────────────────────────────────────────────
// Service booking policy
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load the booking policy for a service, or return sensible defaults.
 *
 * Booking Hardening v1 · exposes three additional fields:
 *   - bookingRequiresPayment           — gates free bookings on paid services
 *   - bookingCancellationNoticeHours   — replaces hardcoded 12h
 *   - bookingRescheduleNoticeHours     — replaces hardcoded 12h
 */
async function loadServicePolicy(serviceId) {
  const defaults = {
    bookingDurationMin:             30,
    bookingBufferMin:               15,
    bookingMinNoticeHours:          24,
    bookingMaxAdvanceDays:          60,
    bookingRequiresPayment:         false, // generic discovery call → free
    bookingCancellationNoticeHours: 12,
    bookingRescheduleNoticeHours:   12,
    isBookable:                     true,  // when no service supplied (free discovery call)
  }
  if (!serviceId) return defaults

  const svc = await prisma.service.findUnique({
    where: { id: serviceId },
    select: {
      isBookable:                     true,
      bookingDurationMin:             true,
      bookingBufferMin:               true,
      bookingMinNoticeHours:          true,
      bookingMaxAdvanceDays:          true,
      bookingRequiresPayment:         true,
      bookingCancellationNoticeHours: true,
      bookingRescheduleNoticeHours:   true,
      title:                          true,
      slug:                           true,
    },
  })

  if (!svc) {
    throw Object.assign(new Error("Service not found"), { statusCode: 404, code: "SERVICE_NOT_FOUND" })
  }
  if (!svc.isBookable) {
    throw Object.assign(new Error("This service is not currently bookable"), {
      statusCode: 400,
      code: "SERVICE_NOT_BOOKABLE",
    })
  }
  return svc
}

/**
 * Load just the cancel/reschedule notice windows for a consultation's service.
 *
 * Distinct from loadServicePolicy because:
 *   1. It must NOT throw when the service has been de-listed since the
 *      booking was made — a member should always be able to cancel an
 *      existing consultation even if the admin un-published the service.
 *   2. It only reads two columns, so it's cheaper for the cancel/reschedule
 *      hot path which doesn't need the full booking policy.
 *
 * Returns defaults (12h each) when serviceId is null/missing.
 */
async function loadCancellationPolicy(serviceId) {
  const defaults = {
    bookingCancellationNoticeHours: 12,
    bookingRescheduleNoticeHours:   12,
  }
  if (!serviceId) return defaults

  const svc = await prisma.service.findUnique({
    where: { id: serviceId },
    select: {
      bookingCancellationNoticeHours: true,
      bookingRescheduleNoticeHours:   true,
    },
  })
  if (!svc) return defaults
  return {
    bookingCancellationNoticeHours: svc.bookingCancellationNoticeHours ?? 12,
    bookingRescheduleNoticeHours:   svc.bookingRescheduleNoticeHours   ?? 12,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// I/O wrappers — fetch data, then defer to the pure algorithm
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Public: get available slots for a single date.
 * @param {Object} params
 * @param {string} [params.serviceId]    Service the booking is for (omit for generic call)
 * @param {string} params.dateLocal      YYYY-MM-DD as observed in displayTimezone
 * @param {string} params.displayTimezone IANA tz, e.g. "America/Mexico_City"
 */
async function getAvailableSlots({ serviceId, dateLocal, displayTimezone }) {
  if (!dateLocal || !/^\d{4}-\d{2}-\d{2}$/.test(dateLocal)) {
    throw Object.assign(new Error("dateLocal must be YYYY-MM-DD"), { statusCode: 400, code: "BAD_DATE" })
  }
  if (!displayTimezone) {
    throw Object.assign(new Error("timezone is required"), { statusCode: 400, code: "BAD_TIMEZONE" })
  }

  const policy   = await loadServicePolicy(serviceId)
  const hostId   = await resolveHostUserId(serviceId)

  // Compute the day window in UTC to fetch consultations efficiently.
  const dayStartUtc = localDateTimeToUtc(dateLocal, "00:00", displayTimezone)
  const dayEndUtc   = localDateTimeToUtc(dateLocal, "23:59", displayTimezone)

  const [rules, exceptions, busyConsultations] = await Promise.all([
    prisma.availabilityRule.findMany({
      where: {
        hostUserId: hostId,
        isActive:   true,
        OR: [
          { serviceId: null },
          ...(serviceId ? [{ serviceId }] : []),
        ],
      },
    }),
    prisma.availabilityException.findMany({
      where: {
        hostUserId: hostId,
        // Window-search: ±2 days handles tz boundary edge cases cheaply.
        date: {
          gte: addDays(startOfDay(dayStartUtc), -2),
          lte: addDays(endOfDay(dayEndUtc),     2),
        },
      },
    }),
    prisma.consultation.findMany({
      where: {
        assignedAdminId: hostId,
        status: { in: ACTIVE_BOOKING_STATUSES },
        // Overlap with our day window (inclusive of slots that start before midnight)
        scheduledAt: { lt: addDays(dayEndUtc,   1) },
        endsAt:      { gt: addDays(dayStartUtc, -1) },
      },
      select: { scheduledAt: true, endsAt: true, durationMin: true },
    }),
  ])

  const busyIntervals = busyConsultations.map((c) => ({
    startUtc: c.scheduledAt,
    endUtc:   c.endsAt || addMinutes(c.scheduledAt, c.durationMin || policy.bookingDurationMin),
  }))

  const slots = computeSlotsForDate({
    dateLocal,
    displayTimezone,
    rules,
    exceptions,
    busyIntervals,
    policy: {
      slotDurationMin: policy.bookingDurationMin,
      bufferMin:       policy.bookingBufferMin,
      minNoticeHours:  policy.bookingMinNoticeHours,
      maxAdvanceDays:  policy.bookingMaxAdvanceDays,
    },
    now: new Date(),
  })

  return slots.map((s) => ({
    startUtc:   s.startUtc.toISOString(),
    endUtc:     s.endUtc.toISOString(),
    startLocal: tzFormat(utcToZonedTime(s.startUtc, displayTimezone), "yyyy-MM-dd'T'HH:mm:ssXXX", { timeZone: displayTimezone }),
    durationMin: policy.bookingDurationMin,
  }))
}

/**
 * Public: for a given month, return which dates have ≥ 1 available slot.
 * Used by the calendar grid to dim/highlight days. Bounded to maxAdvanceDays.
 */
async function getAvailableDaysInMonth({ serviceId, year, month, displayTimezone }) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw Object.assign(new Error("year and month required"), { statusCode: 400, code: "BAD_MONTH" })
  }

  const policy = await loadServicePolicy(serviceId)
  const horizonEnd = addDays(new Date(), policy.bookingMaxAdvanceDays)

  // Iterate every date in the month (capped by horizon).
  const daysInMonth = new Date(year, month, 0).getDate()
  const checks = []
  for (let d = 1; d <= daysInMonth; d += 1) {
    const dateLocal = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    const candidateUtc = localDateTimeToUtc(dateLocal, "12:00", displayTimezone)
    if (isAfter(candidateUtc, horizonEnd)) continue
    checks.push(dateLocal)
  }

  // Run in parallel batches of 7 to keep DB load reasonable.
  const result = []
  for (let i = 0; i < checks.length; i += 7) {
    const batch = checks.slice(i, i + 7)
     
    const slotCounts = await Promise.all(
      batch.map((dl) => getAvailableSlots({ serviceId, dateLocal: dl, displayTimezone }).then((s) => s.length)),
    )
     
    batch.forEach((dl, idx) => {
      if (slotCounts[idx] > 0) result.push(dl)
    })
  }

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD wrappers — used by admin controllers
// ─────────────────────────────────────────────────────────────────────────────

async function listRules({ hostUserId }) {
  return prisma.availabilityRule.findMany({
    where: { hostUserId },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    include: { service: { select: { id: true, title: true, slug: true } } },
  })
}

async function createRule({ hostUserId, serviceId, dayOfWeek, startTime, endTime, timezone, slotDurationMin, bufferMin, isActive }) {
  // Validation
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw Object.assign(new Error("dayOfWeek must be 0..6"), { statusCode: 400, code: "BAD_DAY" })
  }
  parseHHmm(startTime); parseHHmm(endTime)
  if (!timezone) throw Object.assign(new Error("timezone required"), { statusCode: 400, code: "BAD_TIMEZONE" })

  const created = await prisma.availabilityRule.create({
    data: {
      hostUserId,
      serviceId: serviceId || null,
      dayOfWeek,
      startTime,
      endTime,
      timezone,
      slotDurationMin: slotDurationMin || 30,
      bufferMin:       bufferMin       || 0,
      isActive:        isActive !== false,
    },
  })
  clearHostCache()
  return created
}

async function updateRule(id, patch) {
  if (patch.startTime) parseHHmm(patch.startTime)
  if (patch.endTime)   parseHHmm(patch.endTime)
  if (patch.dayOfWeek != null && (patch.dayOfWeek < 0 || patch.dayOfWeek > 6)) {
    throw Object.assign(new Error("dayOfWeek must be 0..6"), { statusCode: 400, code: "BAD_DAY" })
  }
  return prisma.availabilityRule.update({ where: { id }, data: patch })
}

async function deleteRule(id) {
  return prisma.availabilityRule.delete({ where: { id } })
}

async function listExceptions({ hostUserId, from, to }) {
  return prisma.availabilityException.findMany({
    where: {
      hostUserId,
      ...(from || to ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
    },
    orderBy: { date: "asc" },
  })
}

async function createException({ hostUserId, date, type, startTime, endTime, timezone, reason }) {
  if (!date) throw Object.assign(new Error("date required"), { statusCode: 400, code: "BAD_DATE" })
  if (!["block", "custom"].includes(type)) {
    throw Object.assign(new Error("type must be 'block' or 'custom'"), { statusCode: 400, code: "BAD_TYPE" })
  }
  if (type === "custom" && (!startTime || !endTime)) {
    throw Object.assign(new Error("custom exceptions require startTime and endTime"), { statusCode: 400, code: "BAD_CUSTOM" })
  }
  if (startTime) parseHHmm(startTime)
  if (endTime)   parseHHmm(endTime)
  if (!timezone) throw Object.assign(new Error("timezone required"), { statusCode: 400, code: "BAD_TIMEZONE" })

  // Normalise date to UTC midnight of the local day.
  const dateUtc = localDateTimeToUtc(String(date).slice(0, 10), "00:00", timezone)

  return prisma.availabilityException.create({
    data: {
      hostUserId,
      date: dateUtc,
      type,
      startTime: startTime || null,
      endTime:   endTime   || null,
      timezone,
      reason:    reason    || null,
    },
  })
}

async function deleteException(id) {
  return prisma.availabilityException.delete({ where: { id } })
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Public-facing
  getAvailableSlots,
  getAvailableDaysInMonth,

  // Admin CRUD
  listRules,
  createRule,
  updateRule,
  deleteRule,
  listExceptions,
  createException,
  deleteException,

  // Internals exposed for the booking service + tests
  resolveHostUserId,
  loadServicePolicy,
  loadCancellationPolicy,
  computeSlotsForDate,
  expandRuleForDate,
  parseHHmm,
  localDateTimeToUtc,
  ACTIVE_BOOKING_STATUSES,
}
