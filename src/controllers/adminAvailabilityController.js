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
} = require("../services/consultationService")

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

module.exports = {
  // rules
  getRules, postRule, patchRule, removeRule,
  // exceptions
  getExceptions, postException, removeException,
  // consultations
  listConsultations, updateConsultation,
}
