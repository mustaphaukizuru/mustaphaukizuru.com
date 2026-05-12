// ─────────────────────────────────────────────────────────────────────────────
// adminAvailabilityController.js — admin CRUD for booking calendar
// ─────────────────────────────────────────────────────────────────────────────

const asyncHandler = require("../utils/asyncHandler")
const {
  resolveHostUserId,
  listRules,
  createRule,
  updateRule,
  deleteRule,
  listExceptions,
  createException,
  deleteException,
} = require("../services/availabilityService")
const {
  adminListConsultations,
  adminUpdateConsultation,
  adminRegenerateMeetingLink,
} = require("../services/consultationService")
const googleCalendar = require("../lib/googleCalendar")

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Resolve which host the admin is managing — defaults to themselves.
async function getHostUserId(req) {
  return req.query.hostUserId || req.body.hostUserId || req.user?.id || (await resolveHostUserId(null))
}

// ─────────────────────────────────────────────────────────────────────────────
// AvailabilityRule CRUD
// ─────────────────────────────────────────────────────────────────────────────

const getRules = asyncHandler(async (req, res) => {
  const hostUserId = await getHostUserId(req)
  const rules = await listRules({ hostUserId })
  return res.status(200).json({ success: true, data: rules })
})

const postRule = asyncHandler(async (req, res) => {
  const hostUserId = await getHostUserId(req)
  const created = await createRule({ ...req.body, hostUserId })
  return res.status(201).json({ success: true, message: "Availability rule created", data: created })
})

const patchRule = asyncHandler(async (req, res) => {
  const updated = await updateRule(req.params.id, req.body)
  return res.status(200).json({ success: true, message: "Availability rule updated", data: updated })
})

const removeRule = asyncHandler(async (req, res) => {
  await deleteRule(req.params.id)
  return res.status(200).json({ success: true, message: "Availability rule deleted" })
})

// ─────────────────────────────────────────────────────────────────────────────
// AvailabilityException CRUD
// ─────────────────────────────────────────────────────────────────────────────

const getExceptions = asyncHandler(async (req, res) => {
  const hostUserId = await getHostUserId(req)
  const { from, to } = req.query
  const items = await listExceptions({ hostUserId, from, to })
  return res.status(200).json({ success: true, data: items })
})

const postException = asyncHandler(async (req, res) => {
  const hostUserId = await getHostUserId(req)
  const created = await createException({ ...req.body, hostUserId })
  return res.status(201).json({ success: true, message: "Exception added", data: created })
})

const removeException = asyncHandler(async (req, res) => {
  await deleteException(req.params.id)
  return res.status(200).json({ success: true, message: "Exception deleted" })
})

// ─────────────────────────────────────────────────────────────────────────────
// Admin consultation operations
// ─────────────────────────────────────────────────────────────────────────────

const listConsultations = asyncHandler(async (req, res) => {
  const { status, from, to, page, pageSize, hostUserId } = req.query
  const result = await adminListConsultations({
    status,
    from,
    to,
    hostUserId,
    page:     page     ? Number(page)     : 1,
    pageSize: pageSize ? Number(pageSize) : 25,
  })
  return res.status(200).json({ success: true, data: result.items, pagination: { total: result.total, page: result.page, pageSize: result.pageSize } })
})

const updateConsultation = asyncHandler(async (req, res) => {
  const updated = await adminUpdateConsultation(req.params.id, req.body, {
    adminUserId: req.user?.id || null,
    ipAddress:   req.ip || null,
  })
  return res.status(200).json({ success: true, message: "Consultation updated", data: updated })
})

/**
 * POST /api/v1/admin/consultations/:id/regenerate-link
 *
 * Operator escape-hatch for consultations whose meeting link failed to
 * provision at booking time (typically because Google was misconfigured
 * then, and is fixed now). Re-runs the Google Calendar + Meet provisioner
 * and returns the updated row.
 *
 * Includes a pre-flight Google-config diagnostic so the admin gets a clear
 * "your refresh token looks like a URL" message INSTEAD of a generic
 * "provider unconfigured" if they haven't actually fixed the underlying
 * problem. Returning 409 + diagnostic short-circuits the retry so we don't
 * burn another API call to confirm what we already know.
 */
const regenerateMeetingLink = asyncHandler(async (req, res) => {
  if (!googleCalendar.isConfigured()) {
    const diag = typeof googleCalendar.diagnoseConfig === "function"
      ? googleCalendar.diagnoseConfig()
      : "config incomplete"
    return res.status(409).json({
      success: false,
      code:    "GCAL_NOT_CONFIGURED",
      message: `Google Calendar is not configured: ${diag}`,
    })
  }
  try {
    const updated = await adminRegenerateMeetingLink({
      id:          req.params.id,
      adminUserId: req.user?.id || null,
      ipAddress:   req.ip       || null,
    })
    const okWithLink = Boolean(updated?.meetingLink)
    return res.status(okWithLink ? 200 : 502).json({
      success: okWithLink,
      message: okWithLink
        ? "Meeting link regenerated"
        : "Provisioning ran but did not produce a link — check server logs",
      data: updated,
    })
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      code:    err.code || "REGENERATE_FAILED",
      message: err.message || "Failed to regenerate meeting link",
    })
  }
})

module.exports = {
  // rules
  getRules, postRule, patchRule, removeRule,
  // exceptions
  getExceptions, postException, removeException,
  // consultations
  listConsultations, updateConsultation, regenerateMeetingLink,
}
