// ─────────────────────────────────────────────────────────────────────────────
// consultationService.js
//
// Booking lifecycle:
//   - book        Create a Consultation in 'pending' (or 'confirmed' if auto-confirm)
//   - reschedule  Cancel current row, create new with rescheduledFromId pointing back
//   - cancel      Soft-cancel with reason + cancelledAt
//   - confirm     Host confirms a pending booking
//   - complete    Host marks a meeting as completed (post-event)
//   - markNoShow  Host marks no-show
//
// Concurrency: the @@unique([assignedAdminId, scheduledAt]) constraint guarantees
// that two simultaneous booking attempts at the same start time → exactly one
// succeeds, the other gets Prisma P2002 → mapped to 409 by errorHandler.
// ─────────────────────────────────────────────────────────────────────────────

const crypto  = require("crypto")
const { addMinutes, isBefore, differenceInHours } = require("date-fns")
const prisma  = require("../lib/prisma")
const {
  resolveHostUserId,
  loadServicePolicy,
  getAvailableSlots,
  ACTIVE_BOOKING_STATUSES,
} = require("./availabilityService")

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a 32-byte URL-safe token used in cancel/reschedule email links.
 * Stored on Consultation.confirmationToken (unique).
 */
function generateConfirmationToken() {
  return crypto.randomBytes(32).toString("base64url")
}

/**
 * Verify the requested startUtc is currently bookable (still in the available
 * slot list). Defends against stale clients holding old slot data.
 */
async function assertSlotIsAvailable({ serviceId, startUtc, displayTimezone }) {
  const dateLocal = require("date-fns-tz").format(
    require("date-fns-tz").utcToZonedTime(startUtc, displayTimezone),
    "yyyy-MM-dd",
    { timeZone: displayTimezone },
  )
  const slots = await getAvailableSlots({ serviceId, dateLocal, displayTimezone })
  const target = startUtc.getTime()
  if (!slots.some((s) => new Date(s.startUtc).getTime() === target)) {
    throw Object.assign(new Error("This time slot is no longer available"), {
      statusCode: 409, code: "SLOT_UNAVAILABLE",
    })
  }
}

/**
 * Window-policy enforcement on cancel/reschedule.
 * Defaults: 12h before scheduledAt for cancel, 12h for reschedule.
 */
function assertWithinPolicyWindow(consultation, { hoursBefore = 12 } = {}) {
  const hoursLeft = differenceInHours(consultation.scheduledAt, new Date())
  if (hoursLeft < hoursBefore) {
    throw Object.assign(
      new Error(`This action requires at least ${hoursBefore}h notice before the scheduled time`),
      { statusCode: 400, code: "POLICY_WINDOW" },
    )
  }
}

const PUBLIC_INCLUDE = {
  service:       { select: { id: true, title: true, slug: true } },
  assignedAdmin: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
  user:          { select: { id: true, fullName: true, email: true } },
}

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Book a consultation slot.
 *
 * @param {Object}   args
 * @param {string}   args.userId         Authenticated member id (required)
 * @param {string}   [args.serviceId]    Service the booking is for; null = generic
 * @param {string|Date} args.startUtc    ISO string or Date — slot start time
 * @param {string}   args.timezone       Client's IANA tz at time of booking
 * @param {string}   [args.clientNotes]  Optional agenda/context from client
 * @param {string}   [args.serviceOrderId] If booking against a paid ServiceOrder
 * @param {boolean}  [args.autoConfirm=true] Whether to skip the 'pending' state
 */
async function bookConsultation({
  userId,
  serviceId    = null,
  startUtc,
  timezone,
  clientNotes  = null,
  serviceOrderId = null,
  autoConfirm  = true,
}) {
  if (!userId)   throw Object.assign(new Error("Authentication required"), { statusCode: 401, code: "AUTH_MISSING" })
  if (!startUtc) throw Object.assign(new Error("startUtc required"),       { statusCode: 400, code: "BAD_START" })
  if (!timezone) throw Object.assign(new Error("timezone required"),       { statusCode: 400, code: "BAD_TIMEZONE" })

  const startDate = startUtc instanceof Date ? startUtc : new Date(startUtc)
  if (Number.isNaN(startDate.getTime())) {
    throw Object.assign(new Error("Invalid startUtc"), { statusCode: 400, code: "BAD_START" })
  }
  if (isBefore(startDate, new Date())) {
    throw Object.assign(new Error("Cannot book a slot in the past"), { statusCode: 400, code: "PAST_SLOT" })
  }

  // Re-validate against current availability (closes the read-then-write race
  // window enough for non-malicious clients; the unique-constraint handles the rest).
  await assertSlotIsAvailable({ serviceId, startUtc: startDate, displayTimezone: timezone })

  const policy = await loadServicePolicy(serviceId)
  const hostId = await resolveHostUserId(serviceId)
  const endsAt = addMinutes(startDate, policy.bookingDurationMin)

  // If serviceOrderId is supplied, validate ownership.
  if (serviceOrderId) {
    const so = await prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      select: { id: true, userId: true, serviceId: true },
    })
    if (!so) throw Object.assign(new Error("ServiceOrder not found"),       { statusCode: 404, code: "SERVICE_ORDER_NOT_FOUND" })
    if (so.userId !== userId) throw Object.assign(new Error("Forbidden"),   { statusCode: 403, code: "FORBIDDEN" })
  }

  try {
    const consultation = await prisma.consultation.create({
      data: {
        userId,
        assignedAdminId:   hostId,
        serviceOrderId:    serviceOrderId || null,
        serviceId:         serviceId || null,
        scheduledAt:       startDate,
        endsAt,
        durationMin:       policy.bookingDurationMin,
        timezone,
        clientNotes,
        status:            autoConfirm ? "confirmed" : "pending",
        confirmedAt:       autoConfirm ? new Date()  : null,
        confirmationToken: generateConfirmationToken(),
      },
      include: PUBLIC_INCLUDE,
    })

    return consultation
  } catch (err) {
    // Race: another booker won this slot in the same instant.
    if (err.code === "P2002") {
      throw Object.assign(new Error("This time slot was just taken — please choose another"), {
        statusCode: 409, code: "SLOT_UNAVAILABLE",
      })
    }
    throw err
  }
}

/**
 * Reschedule an existing consultation: marks the old row as 'rescheduled' and
 * creates a new row with rescheduledFromId pointing back. Preserves audit chain.
 */
async function rescheduleConsultation({ id, userId, isAdmin = false, newStartUtc, newTimezone }) {
  const existing = await prisma.consultation.findUnique({ where: { id } })
  if (!existing) throw Object.assign(new Error("Consultation not found"), { statusCode: 404, code: "NOT_FOUND" })

  // Authorization
  if (!isAdmin && existing.userId !== userId) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403, code: "FORBIDDEN" })
  }

  if (!ACTIVE_BOOKING_STATUSES.includes(existing.status)) {
    throw Object.assign(new Error(`Cannot reschedule a ${existing.status} consultation`), {
      statusCode: 400, code: "BAD_STATE",
    })
  }

  // Members get window enforcement; admin can override.
  if (!isAdmin) assertWithinPolicyWindow(existing, { hoursBefore: 12 })

  const newStart = new Date(newStartUtc)
  if (Number.isNaN(newStart.getTime())) {
    throw Object.assign(new Error("Invalid newStartUtc"), { statusCode: 400, code: "BAD_START" })
  }

  const tz = newTimezone || existing.timezone

  await assertSlotIsAvailable({
    serviceId: existing.serviceId,
    startUtc:  newStart,
    displayTimezone: tz,
  })

  const policy = await loadServicePolicy(existing.serviceId)
  const newEnd = addMinutes(newStart, existing.durationMin || policy.bookingDurationMin)

  // Atomic: cancel old, create new in one transaction. The new row inherits the
  // host, service, user — only the time changes. Uniqueness ensures no overlap.
  return prisma.$transaction(async (tx) => {
    await tx.consultation.update({
      where: { id: existing.id },
      data: {
        status: "rescheduled",
        cancelledAt: new Date(),
      },
    })

    try {
      return await tx.consultation.create({
        data: {
          userId:            existing.userId,
          assignedAdminId:   existing.assignedAdminId,
          serviceOrderId:    existing.serviceOrderId,
          serviceId:         existing.serviceId,
          scheduledAt:       newStart,
          endsAt:             newEnd,
          durationMin:       existing.durationMin,
          timezone:          tz,
          clientNotes:       existing.clientNotes,
          status:            "confirmed",
          confirmedAt:       new Date(),
          confirmationToken: generateConfirmationToken(),
          rescheduledFromId: existing.id,
          meetingProvider:   existing.meetingProvider,
          meetingLink:       existing.meetingLink,
        },
        include: PUBLIC_INCLUDE,
      })
    } catch (err) {
      if (err.code === "P2002") {
        throw Object.assign(new Error("That time was just taken — please choose another"), {
          statusCode: 409, code: "SLOT_UNAVAILABLE",
        })
      }
      throw err
    }
  })
}

/**
 * Cancel a consultation. Members enforce 12h window; admin can override.
 */
async function cancelConsultation({ id, userId, isAdmin = false, reason }) {
  const existing = await prisma.consultation.findUnique({ where: { id } })
  if (!existing) throw Object.assign(new Error("Consultation not found"), { statusCode: 404, code: "NOT_FOUND" })

  if (!isAdmin && existing.userId !== userId) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403, code: "FORBIDDEN" })
  }
  if (!ACTIVE_BOOKING_STATUSES.includes(existing.status)) {
    throw Object.assign(new Error(`Already ${existing.status}`), { statusCode: 400, code: "BAD_STATE" })
  }
  if (!isAdmin) assertWithinPolicyWindow(existing, { hoursBefore: 12 })

  return prisma.consultation.update({
    where: { id },
    data: {
      status:             "cancelled",
      cancelledAt:        new Date(),
      cancellationReason: reason || null,
    },
    include: PUBLIC_INCLUDE,
  })
}

/**
 * Lookup by confirmationToken — used by guest cancel/reschedule email links.
 */
async function findByConfirmationToken(token) {
  if (!token) return null
  return prisma.consultation.findUnique({ where: { confirmationToken: token }, include: PUBLIC_INCLUDE })
}

// ─────────────────────────────────────────────────────────────────────────────
// Member queries
// ─────────────────────────────────────────────────────────────────────────────

async function listMyConsultations(userId, { status, upcoming } = {}) {
  return prisma.consultation.findMany({
    where: {
      userId,
      ...(status   ? { status } : {}),
      ...(upcoming ? { scheduledAt: { gte: new Date() }, status: { in: ACTIVE_BOOKING_STATUSES } } : {}),
    },
    orderBy: { scheduledAt: upcoming ? "asc" : "desc" },
    include: PUBLIC_INCLUDE,
  })
}

async function getConsultationByIdForUser({ id, userId, isAdmin }) {
  const c = await prisma.consultation.findUnique({ where: { id }, include: PUBLIC_INCLUDE })
  if (!c) return null
  if (!isAdmin && c.userId !== userId) return null
  return c
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin operations
// ─────────────────────────────────────────────────────────────────────────────

async function adminListConsultations({ status, from, to, hostUserId, page = 1, pageSize = 25 }) {
  const skip = Math.max(0, (Number(page) - 1) * Number(pageSize))
  const take = Math.min(100, Math.max(1, Number(pageSize)))

  const where = {
    ...(status     ? { status } : {}),
    ...(hostUserId ? { assignedAdminId: hostUserId } : {}),
    ...(from || to ? {
      scheduledAt: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to   ? { lte: new Date(to)   } : {}),
      },
    } : {}),
  }

  const [items, total] = await Promise.all([
    prisma.consultation.findMany({
      where,
      orderBy: { scheduledAt: "desc" },
      include: PUBLIC_INCLUDE,
      skip, take,
    }),
    prisma.consultation.count({ where }),
  ])
  return { items, total, page: Number(page), pageSize: take }
}

/**
 * Generate a Jitsi meeting room URL — used when the admin confirms a
 * consultation without supplying a Google Meet / Zoom link of their own.
 *
 * Jitsi is the lowest-friction default: no API, no account, the room is
 * created on first visit, and the URL itself is the credential. We salt
 * it with random bytes so a leaked legacy URL can't be guessed from the
 * consultation ID alone.
 */
function generateJitsiMeetingLink(consultationId) {
  const slug = crypto.randomBytes(6).toString("hex")
  const short = String(consultationId || "").slice(-6).toLowerCase().replace(/[^a-z0-9]/g, "x")
  return `https://meet.jit.si/ukizuru-${short}-${slug}`
}

/**
 * Reduce a consultation row to the fields worth recording in the audit
 * trail. Excludes large text fields (notes) and relations to keep the
 * JSON snapshot small.
 */
function pickAuditFields(row) {
  if (!row) return null
  return {
    id: row.id, status: row.status, scheduledAt: row.scheduledAt,
    meetingProvider: row.meetingProvider, meetingLink: row.meetingLink,
    assignedAdminId: row.assignedAdminId, confirmedAt: row.confirmedAt,
    cancelledAt: row.cancelledAt, completedAt: row.completedAt,
  }
}

/**
 * Fire-and-forget confirmation email when a consultation transitions to
 * `confirmed`. Includes the meeting link, schedule, and a deep-link to
 * the member's consultation detail page.
 */
async function sendConsultationConfirmedEmail(row, opts = {}) {
  const { sendTemplateEmail } = require("./emailService")
  const { resolveUserLocale } = require("../utils/resolveUserLocale")

  const to = row.user?.email
  if (!to) return // No recipient — nothing to do.

  let locale = "en"
  try {
    locale = opts.locale || resolveUserLocale({ user: { id: row.userId } })
  } catch { /* fall through to "en" */ }

  const frontend = (process.env.FRONTEND_URL || "").replace(/\/$/, "")
  const scheduledAt = row.scheduledAt instanceof Date ? row.scheduledAt : new Date(row.scheduledAt)
  const scheduledHuman = scheduledAt.toLocaleString(locale === "es" ? "es-MX" : "en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
    timeZone: row.timezone || "UTC",
  })

  await sendTemplateEmail({
    locale,
    to,
    templateKey: "consultation.confirmed",
    userId:      row.userId,
    variables: {
      customerName:    row.user?.fullName?.split(" ")[0] || "there",
      scheduledAt:     scheduledHuman,
      durationMin:     row.durationMin || 30,
      timezone:        row.timezone || "UTC",
      meetingLink:     row.meetingLink || "",
      meetingProvider: row.meetingProvider || "manual",
      serviceTitle:    row.service?.title || "Consulting session",
      hostName:        row.assignedAdmin?.fullName || "Mustapha Ukizuru",
      consultationUrl: `${frontend}/dashboard/consultations`,
    },
  })
}

async function adminUpdateConsultation(id, patch, ctx = {}) {
  // Allowed admin patches (allowlist)
  const allowed = {}
  if (patch.status          !== undefined) allowed.status          = patch.status
  if (patch.summaryNotes    !== undefined) allowed.summaryNotes    = patch.summaryNotes
  if (patch.meetingLink     !== undefined) allowed.meetingLink     = patch.meetingLink
  if (patch.meetingProvider !== undefined) allowed.meetingProvider = patch.meetingProvider
  if (patch.assignedAdminId !== undefined) allowed.assignedAdminId = patch.assignedAdminId

  // Status side-effects
  const now = new Date()
  if (patch.status === "confirmed") allowed.confirmedAt   = allowed.confirmedAt   || now
  if (patch.status === "completed") allowed.completedAt   = allowed.completedAt   || now
  if (patch.status === "cancelled") allowed.cancelledAt   = allowed.cancelledAt   || now

  // Pre-flight read for: (a) auto meeting-link generation decision,
  // (b) the AdminAuditLog `beforeJson` snapshot.
  const before = await prisma.consultation.findUnique({
    where:  { id },
    include: PUBLIC_INCLUDE,
  })
  if (!before) {
    throw Object.assign(new Error("Consultation not found"), { code: "NOT_FOUND" })
  }

  // Auto-generate a Jitsi room when the admin confirms a booking without
  // supplying a link. Manual override wins — if patch.meetingLink is set
  // (including to ""), we respect it. The MeetingProvider enum doesn't
  // currently have a "jitsi" value, so we tag it as "manual" — the URL
  // host (meet.jit.si) is self-describing in the email + dashboard.
  const willConfirmNow = patch.status === "confirmed" && before.status !== "confirmed"
  if (willConfirmNow && patch.meetingLink === undefined && !before.meetingLink) {
    allowed.meetingLink = generateJitsiMeetingLink(id)
    if (!allowed.meetingProvider && !before.meetingProvider) {
      allowed.meetingProvider = "manual"
    }
  }

  // Atomic — update row + write audit log together so we never have one
  // without the other. The email send is fire-and-forget outside the
  // transaction (it can fail without blocking the admin's confirm action).
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.consultation.update({
      where: { id },
      data:  allowed,
      include: PUBLIC_INCLUDE,
    })

    if (ctx.adminUserId) {
      const action = patch.status ? `consultation.${patch.status}` : "consultation.updated"
      await tx.adminAuditLog.create({
        data: {
          adminUserId: ctx.adminUserId,
          action,
          targetType:  "Consultation",
          targetId:    id,
          beforeJson:  pickAuditFields(before),
          afterJson:   pickAuditFields(row),
          ipAddress:   ctx.ipAddress || null,
        },
      }).catch(() => null)
    }

    return row
  })

  if (willConfirmNow) {
    sendConsultationConfirmedEmail(updated, ctx).catch((e) => {
      // Don't blow up the admin action on email failure — the row is
      // already updated, the audit log already recorded. Best-effort.
      // eslint-disable-next-line no-console
      console.error("[consultation] confirmation email failed:", e?.message)
    })
  }

  return updated
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  bookConsultation,
  rescheduleConsultation,
  cancelConsultation,
  findByConfirmationToken,
  listMyConsultations,
  getConsultationByIdForUser,
  adminListConsultations,
  adminUpdateConsultation,
}
