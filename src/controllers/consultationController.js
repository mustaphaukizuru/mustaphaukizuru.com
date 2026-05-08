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

// POST /api/v1/consultations
const create = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  const { serviceId, startUtc, timezone, clientNotes, serviceOrderId } = req.body

  if (!startUtc || !timezone) {
    return res.status(400).json({
      success: false,
      code:    "BAD_REQUEST",
      message: "startUtc and timezone are required",
    })
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

  return res.status(201).json({
    success: true,
    message: "Consultation booked",
    data:    consultation,
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
