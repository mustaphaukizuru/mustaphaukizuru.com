// ─────────────────────────────────────────────────────────────────────────────
// consultationController.js — member-facing booking endpoints
// ─────────────────────────────────────────────────────────────────────────────

const asyncHandler = require("../utils/asyncHandler")
const {
  bookConsultation,
  rescheduleConsultation,
  cancelConsultation,
  listMyConsultations,
  getConsultationByIdForUser,
  findByConfirmationToken,
} = require("../services/consultationService")
const {
  sendConsultationConfirmationEmail,
  sendConsultationRescheduledEmail,
  sendConsultationCancelledEmail,
} = require("../utils/mailer")
const { resolveUserLocale } = require("../utils/resolveUserLocale")
const { findOrCreateUserForCheckout } = require("../services/authService")
const { sendTemplateEmail } = require("../services/emailService")
const logger = require("../utils/logger")

// Same pragmatic RFC 5322 check as orderController.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * POST /api/v1/consultations — soft-auth (attachUserIfPresent). Mirrors
 * POST /orders (orderController.createOrder):
 *   1. Signed-in member → books as req.user
 *   2. Guest, new email  → passwordless "checkout" account + claim email
 *   3. Guest, email of a claimed account → 401 ACCOUNT_EXISTS (must sign in)
 */

/** True when Intl accepts the zone (IANA name); guards date-fns-tz from a RangeError → 500. */
function isValidTimezone(tz) {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false
  try { Intl.DateTimeFormat(undefined, { timeZone: tz }); return true } catch { return false }
}

const create = asyncHandler(async (req, res) => {
  let userId = req.user?.id || null
  const { serviceId, startUtc, timezone, serviceOrderId, customerName, customerEmail } = req.body
  const clientNotes = req.body?.clientNotes == null ? undefined : String(req.body.clientNotes).slice(0, 2000)

  if (timezone && !isValidTimezone(timezone)) {
    return res.status(400).json({ success: false, code: "BAD_REQUEST", message: "timezone must be a valid IANA zone (e.g. America/Mexico_City)" })
  }
  if (!startUtc || !timezone) {
    return res.status(400).json({
      success: false,
      code:    "BAD_REQUEST",
      message: "startUtc and timezone are required",
    })
  }

  let isNewUser  = false
  let claimToken = null
  let guestEmail = null
  let guestName  = null

  if (!userId) {
    // Paid bookings need the serviceOrder ownership check, which only makes
    // sense against a real session — never auto-create an account for that.
    if (serviceOrderId) {
      return res.status(401).json({
        success: false, code: "LOGIN_REQUIRED_FOR_PAID_BOOKING",
        message: "Please sign in to book a session against a paid order.",
      })
    }
    const email = String(customerEmail || "").trim()
    if (!email) {
      return res.status(400).json({
        success: false, code: "VALIDATION_ERROR",
        message: "customerEmail is required",
      })
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({
        success: false, code: "VALIDATION_ERROR",
        message: "customerEmail is not a valid email address",
      })
    }
    const name = String(customerName || "").trim()
    if (!name) {
      return res.status(400).json({
        success: false, code: "VALIDATION_ERROR",
        message: "customerName is required",
      })
    }

    try {
      const result = await findOrCreateUserForCheckout({ fullName: name, email })
      if (result.requiresLogin) {
        return res.status(401).json({
          success: false, code: "ACCOUNT_EXISTS",
          message: "An account already exists for this email. Please sign in to complete your purchase.",
        })
      }
      userId     = result.user.id
      isNewUser  = Boolean(result.isNew)
      claimToken = result.claimToken || null
      guestEmail = result.user.email || email
      guestName  = result.user.fullName || name
    } catch (err) {
      logger.error("[booking] auto-account failed:", err.message)
      return res.status(500).json({
        success: false, code: "AUTO_ACCOUNT_FAILED",
        message: "Could not create your account. Please try signing up first.",
      })
    }
  }

  const consultation = await bookConsultation({
    userId,
    serviceId:      serviceId      || null,
    startUtc,
    timezone,
    clientNotes:    clientNotes    || null,
    serviceOrderId: serviceOrderId || null,
  })

  // Fire-and-forget email · locale resolved from req (Accept-Language /
  // referer / explicit body.locale) so a Spanish member gets the Spanish
  // booking confirmation. Falls back to "en" when resolution fails.
  const locale = resolveUserLocale({ req })
  sendConsultationConfirmationEmail(consultation, { locale }).catch((err) =>
    console.error("[booking] confirmation email failed:", err.message),
  )

  // Brand-new guests also get the claim-account email (same template as
  // checkout) so they can set a password and see the booking in /dashboard.
  // The confirmation email above already carries the confirmationToken
  // manage link, so reschedule/cancel work before the account is claimed.
  if (isNewUser && claimToken) {
    const claimUrl = `${(process.env.FRONTEND_URL || process.env.CLIENT_URL || "").replace(/\/$/, "")}/reset-password/${claimToken}?source=booking`
    sendTemplateEmail({
      locale,
      to:          guestEmail,
      templateKey: "auth.account-claim",
      userId,
      variables: {
        customerName: guestName?.split(" ")[0] || "there",
        orderNumber:  consultation.id,
        claimUrl,
      },
    }).catch((err) => logger.error("[booking] claim email failed:", err.message))
  }

  return res.status(201).json({
    success: true,
    message: "Consultation booked",
    data:    { ...consultation, isNewUser },
  })
})

// GET /api/v1/consultations  — current user's bookings
const listMine = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  const { status, upcoming } = req.query

  const items = await listMyConsultations(userId, {
    status,
    upcoming: upcoming === "true" || upcoming === "1",
  })

  return res.status(200).json({ success: true, data: items })
})

// GET /api/v1/consultations/:id
const getById = asyncHandler(async (req, res) => {
  const userId  = req.user?.id
  const isAdmin = req.user?.role === "admin"
  const item = await getConsultationByIdForUser({ id: req.params.id, userId, isAdmin })
  if (!item) return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Consultation not found" })
  return res.status(200).json({ success: true, data: item })
})

// PATCH /api/v1/consultations/:id/reschedule
const reschedule = asyncHandler(async (req, res) => {
  const userId  = req.user?.id
  const isAdmin = req.user?.role === "admin"
  const { newStartUtc, newTimezone } = req.body

  if (!newStartUtc) {
    return res.status(400).json({ success: false, code: "BAD_REQUEST", message: "newStartUtc is required" })
  }
  if (newTimezone && !isValidTimezone(newTimezone)) {
    return res.status(400).json({ success: false, code: "BAD_REQUEST", message: "newTimezone must be a valid IANA zone" })
  }

  const updated = await rescheduleConsultation({
    id: req.params.id,
    userId,
    isAdmin,
    newStartUtc,
    newTimezone,
  })

  const rescheduleLocale = resolveUserLocale({ req })
  sendConsultationRescheduledEmail(updated, { locale: rescheduleLocale }).catch((err) =>
    console.error("[booking] reschedule email failed:", err.message),
  )

  return res.status(200).json({ success: true, message: "Consultation rescheduled", data: updated })
})

// DELETE /api/v1/consultations/:id  — cancel
const cancel = asyncHandler(async (req, res) => {
  const userId  = req.user?.id
  const isAdmin = req.user?.role === "admin"
  const { reason } = req.body || {}

  const updated = await cancelConsultation({ id: req.params.id, userId, isAdmin, reason })

  const cancelLocale = resolveUserLocale({ req })
  sendConsultationCancelledEmail(updated, { locale: cancelLocale }).catch((err) =>
    console.error("[booking] cancel email failed:", err.message),
  )

  return res.status(200).json({ success: true, message: "Consultation cancelled", data: updated })
})

// GET /api/v1/consultations/by-token/:token  — guest cancel/reschedule resolver
const lookupByToken = asyncHandler(async (req, res) => {
  const item = await findByConfirmationToken(req.params.token)
  if (!item) return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Invalid or expired link" })
  // Trim sensitive fields when accessed without auth
  const safe = {
    id:           item.id,
    scheduledAt:  item.scheduledAt,
    endsAt:       item.endsAt,
    durationMin:  item.durationMin,
    timezone:     item.timezone,
    status:       item.status,
    service:      item.service,
    assignedAdmin: item.assignedAdmin,
  }
  return res.status(200).json({ success: true, data: safe })
})

module.exports = { create, listMine, getById, reschedule, cancel, lookupByToken }
