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
const logger  = require("../utils/logger")
const {
  resolveHostUserId,
  loadServicePolicy,
  getAvailableSlots,
  ACTIVE_BOOKING_STATUSES,
} = require("./availabilityService")
const googleCalendar = require("../lib/googleCalendar")

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
    let consultation = await prisma.consultation.create({
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

    // When the booking is auto-confirmed (client picked from published
    // availability → no admin review needed), wire the same side-effects
    // the manual admin-confirm path runs:
    //   1. Create a Google Calendar event with a Meet link (or fall back
    //      to a Jitsi room if Google isn't configured).
    //   2. Persist the meeting link + provider + event id back onto the row.
    //   3. Fire the confirmation email so the client gets the join link
    //      immediately, plus the Calendar invite Google itself sends.
    // All of this is best-effort — if it fails the consultation still
    // exists in the DB and the admin can recover from /admin/consultations.
    if (autoConfirm) {
      consultation = await provisionMeetingAndNotify(consultation)
    }

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
  // The Google Calendar event (if any) is updated in-place AFTER the
  // transaction commits — we don't want a Calendar API timeout to roll
  // back the DB write. The new row inherits the SAME googleEventId so the
  // single Calendar event tracks the booking across reschedules.
  const newRow = await prisma.$transaction(async (tx) => {
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
          googleEventId:     existing.googleEventId,
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

  // Calendar event update is best-effort and outside the transaction.
  // Failure here is logged but doesn't roll back the DB reschedule —
  // the admin can re-sync later via the admin dashboard if needed.
  if (existing.googleEventId && googleCalendar.isConfigured()) {
    googleCalendar.updateCalendarEvent(existing.googleEventId, {
      start: newStart,
      end:   newEnd,
      timezone: tz,
    }).catch((e) => {
      // eslint-disable-next-line no-console
      console.error("[consultation] Google Calendar reschedule failed:", e?.message)
    })
  }

  // Reschedule email is intentionally NOT sent from here — the controller
  // (consultationController.reschedule) calls
  // utils/mailer.sendConsultationRescheduledEmail() after this function
  // returns, which is the canonical path (full ICS update). Calling our
  // template-based send here would produce a duplicate email.
  // Google Calendar's `sendUpdates: "all"` on the patch above ALSO sends
  // a native "this event has been rescheduled" notice — separate channel,
  // works in parallel.

  return newRow
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

  const cancelled = await prisma.consultation.update({
    where: { id },
    data: {
      status:             "cancelled",
      cancelledAt:        new Date(),
      cancellationReason: reason || null,
    },
    include: PUBLIC_INCLUDE,
  })

  // Best-effort Calendar event delete. Google emails the attendee a
  // cancellation automatically when `sendUpdates: "all"` is set inside
  // googleCalendar.cancelCalendarEvent. Failure here is logged but
  // doesn't roll back the DB cancel — the row is already cancelled.
  if (existing.googleEventId && googleCalendar.isConfigured()) {
    googleCalendar.cancelCalendarEvent(existing.googleEventId).catch((e) => {
      // eslint-disable-next-line no-console
      console.error("[consultation] Google Calendar cancel failed:", e?.message)
    })
  }

  return cancelled
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

/* generateJitsiMeetingLink — REMOVED in Phase 11 polish.
 * Bookings now use Google Meet exclusively (see provisionMeetingAndNotify
 * below). When Google fails or isn't configured, the booking still
 * succeeds but with meetingLink=null; the admin completes it manually
 * from /admin/consultations. */

/**
 * Provision a meeting link for a freshly-confirmed consultation and send
 * the confirmation email. The two-step shape is on purpose: a Calendar
 * API failure must NOT block the email, and a transient API outage must
 * NOT prevent the booking from being recorded.
 *
 * Order of operations:
 *   1. If Google Calendar is configured, try to create an event + Meet
 *      link via the Calendar API. On success, persist meetingProvider =
 *      google_meet, meetingLink = <Meet URL>, googleEventId = <event id>.
 *   2. If Google fails (or isn't configured), fall back to a Jitsi room
 *      with meetingProvider = manual.
 *   3. Regardless of which provider was used, fire the existing
 *      consultation.confirmed email — the template substitutes the link
 *      so the client always gets something they can click on.
 *
 * Returns the (refetched) consultation row with the link populated.
 */
async function provisionMeetingAndNotify(consultation) {
  // The DB row passed in has the user/service relations expanded via
  // PUBLIC_INCLUDE — read those for the Calendar event metadata.
  const id    = consultation.id
  const start = consultation.scheduledAt instanceof Date
    ? consultation.scheduledAt
    : new Date(consultation.scheduledAt)
  const end   = consultation.endsAt instanceof Date
    ? consultation.endsAt
    : new Date(consultation.endsAt || (start.getTime() + (consultation.durationMin || 30) * 60_000))

  // Google Meet is the ONLY supported provider for auto-provisioned links.
  // The previous Jitsi fallback was removed (Phase 11 polish) — bookings
  // now require Google Calendar to be configured AND reachable. Reasoning:
  //   · Two parallel meeting platforms confuse the customer-facing UX
  //     (some get meet.jit.si, some get meet.google.com, different join
  //     experiences, different reminder emails)
  //   · A working Google Calendar integration is a hard pre-req for
  //     production anyway (it powers the Calendar event + native invites
  //     + reschedule sync) — failing loudly is better than papering over
  //     a configuration gap with a half-broken Jitsi link
  //   · Resilience is preserved via clean error: the booking row is
  //     created with status=pending + no meetingLink, and the admin gets
  //     a chance to manually set a link from the dashboard before the
  //     client receives the confirmation email.
  if (!googleCalendar.isConfigured()) {
    const diag = typeof googleCalendar.diagnoseConfig === "function"
      ? googleCalendar.diagnoseConfig()
      : "config incomplete"
    logger.error(
      `[consultation ${id}] Google Calendar not configured — booking left without a meeting link. ` +
      `Diagnosis: ${diag}. Admin must paste a link manually via /admin/consultations, or ` +
      `POST /api/v1/admin/consultations/${id}/regenerate-link after fixing the config.`
    )
    // Mark the row as pending-link so the admin dashboard surfaces it
    // for manual attention. Don't throw — the booking should still
    // succeed; the link issue is a soft-defect, not a fatal one.
    return await prisma.consultation.update({
      where: { id },
      data:  { meetingLink: null, meetingProvider: "manual", googleEventId: null },
      include: PUBLIC_INCLUDE,
    })
  }

  try {
    const serviceTitle  = consultation.service?.title || "Consulting session"
    const attendeeEmail = consultation.user?.email
    const attendeeName  = consultation.user?.fullName

    const event = await googleCalendar.createCalendarEvent({
      summary:        `${serviceTitle} · ${attendeeName || "Client"}`,
      description:
        `Consultation booked via mustaphaukizuru.com\n\n` +
        (consultation.clientNotes ? `Client notes:\n${consultation.clientNotes}\n\n` : "") +
        `Booking ID: ${id}`,
      start,
      end,
      timezone:       consultation.timezone || "UTC",
      attendeeEmail:  attendeeEmail || undefined,
      attendeeName:   attendeeName  || undefined,
      consultationId: id,
    })

    const updated = await prisma.consultation.update({
      where: { id },
      data: {
        meetingLink:     event.meetLink,
        meetingProvider: "google_meet",
        googleEventId:   event.eventId,
      },
      include: PUBLIC_INCLUDE,
    })

    // Emails intentionally NOT sent from here — the controller fires
    // utils/mailer.sendConsultationConfirmationEmail() after we return.
    // The Google Calendar API's `sendUpdates: "all"` (inside
    // createCalendarEvent) also dispatches Google's native invite —
    // separate channel, intentional.
    return updated
  } catch (err) {
    // Google was configured but the API call failed (401 refresh-token
    // revoked, 403 scope missing, 500 from Google, etc.). Same approach
    // as the "not configured" branch: don't fail the booking; leave the
    // link blank for admin attention.
    logger.error(`[consultation ${id}] Google Calendar event creation failed`, {
      message:      err?.message,
      googleStatus: err?.googleStatus || null,
      googleError:  err?.googleError  || null,
      // Common cause-codes worth surfacing: invalid_grant (refresh token
      // bad / revoked), insufficient_scope (consent screen missing
      // calendar.events), accessNotConfigured (Calendar API disabled in
      // the Cloud project).
      causeCode:    err?.cause?.code || null,
    })
    return await prisma.consultation.update({
      where: { id },
      data:  { meetingLink: null, meetingProvider: "manual", googleEventId: null },
      include: PUBLIC_INCLUDE,
    })
  }
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

  // When the admin confirms a previously-pending booking WITHOUT supplying
  // their own meeting link, the post-transaction path below will run the
  // Google Meet provisioner (same flow as the public auto-confirm path).
  // The previous implementation auto-generated a Jitsi link inside the
  // transaction; that was removed (Phase 11 polish) so the admin path now
  // produces the same Google Meet experience as the customer path.
  //
  // Manual override still wins — if patch.meetingLink is explicitly set
  // (including to ""), we respect it and skip the Google provisioner.
  const willConfirmNow      = patch.status === "confirmed" && before.status !== "confirmed"
  const willAutoProvision   = willConfirmNow && patch.meetingLink === undefined && !before.meetingLink

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

  // Auto-provision a Google Calendar event + Meet link AFTER the DB
  // transaction commits (the API call is async, can't sit inside Prisma
  // tx). Same provisioner the public booking path uses, so admin-confirmed
  // and customer-confirmed bookings end up looking identical.
  let finalRow = updated
  if (willAutoProvision) {
    finalRow = await provisionMeetingAndNotify(updated)
  }

  if (willConfirmNow) {
    // Use the SAME ICS-rich mailer the public auto-confirm path fires
    // (consultationController.create) so admin-confirmed and customer-
    // confirmed bookings produce an identical surface: branded HTML +
    // iCalendar attachment so Gmail / Outlook / Apple Mail all surface
    // an inline "Add to Calendar" action. Required lazily so the test
    // suite can mock '../utils/mailer' without dragging the nodemailer
    // pool into module-load.
    const { sendConsultationConfirmationEmail } = require("../utils/mailer")
    const { resolveUserLocale } = require("../utils/resolveUserLocale")
    let locale = "en"
    try {
      locale = ctx.locale || resolveUserLocale({ user: { id: finalRow.userId } })
    } catch { /* fall through to "en" */ }
    sendConsultationConfirmationEmail(finalRow, { locale }).catch((e) => {
      // Don't blow up the admin action on email failure — the row is
      // already updated, the audit log already recorded. Best-effort.
      // eslint-disable-next-line no-console
      console.error("[consultation] confirmation email failed:", e?.message)
    })
  }

  return finalRow
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * adminRegenerateMeetingLink — operator-triggered re-run of the Google Meet
 * provisioner for a single consultation. Use when the initial booking
 * confirmation failed to attach a link (typically because Google credentials
 * were misconfigured at the time — see /admin/consultations for rows with
 * meetingProvider="manual" + meetingLink=null).
 *
 * Guards:
 *   - NOT_FOUND if the consultation doesn't exist
 *   - BAD_STATE if the row is in a terminal state (cancelled / completed /
 *     no_show / rescheduled) — no point provisioning a link for a meeting
 *     that already happened or never will
 *   - Skips silently and returns the existing row if a meeting link is
 *     already populated (idempotent — re-runs are safe)
 *
 * Audit:
 *   When ctx.adminUserId is supplied, writes an AdminAuditLog row capturing
 *   the provider/link transition.
 */
async function adminRegenerateMeetingLink({ id, adminUserId = null, ipAddress = null } = {}) {
  if (!id) {
    throw Object.assign(new Error("id required"), { statusCode: 400, code: "BAD_REQUEST" })
  }

  const before = await prisma.consultation.findUnique({
    where:  { id },
    include: PUBLIC_INCLUDE,
  })
  if (!before) {
    throw Object.assign(new Error("Consultation not found"), { statusCode: 404, code: "NOT_FOUND" })
  }

  const terminalStates = ["cancelled", "completed", "no_show", "rescheduled"]
  if (terminalStates.includes(before.status)) {
    throw Object.assign(
      new Error(`Cannot regenerate link for a ${before.status} consultation`),
      { statusCode: 400, code: "BAD_STATE" },
    )
  }

  // Idempotent: a row that already has a link is left alone. The admin can
  // explicitly clear meetingLink first if they want a fresh one (rare —
  // typical use is re-running provisioning after fixing Google env vars).
  if (before.meetingLink) {
    return before
  }

  const finalRow = await provisionMeetingAndNotify(before)

  if (adminUserId) {
    await prisma.adminAuditLog.create({
      data: {
        adminUserId,
        action:     "consultation.meeting_link.regenerated",
        targetType: "Consultation",
        targetId:   id,
        beforeJson: pickAuditFields(before),
        afterJson:  pickAuditFields(finalRow),
        ipAddress,
      },
    }).catch((e) => logger.warn(`[consultation ${id}] audit log failed: ${e.message}`))
  }

  return finalRow
}

module.exports = {
  bookConsultation,
  rescheduleConsultation,
  cancelConsultation,
  findByConfirmationToken,
  listMyConsultations,
  getConsultationByIdForUser,
  adminListConsultations,
  adminUpdateConsultation,
  adminRegenerateMeetingLink,
}
