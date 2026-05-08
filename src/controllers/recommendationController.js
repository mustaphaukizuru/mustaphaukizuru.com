/* ════════════════════════════════════════════════════════════════════════
   recommendationController.js · public reads + admin CRUD
   ════════════════════════════════════════════════════════════════════════ */

const asyncHandler = require("../utils/asyncHandler")
const svc = require("../services/recommendationService")

/* ── Public ────────────────────────────────────────────────────────────── */

const listPublic = asyncHandler(async (req, res) => {
  const { category, limit } = req.query
  const items = await svc.listPublic({ category, limit })
  res.set("Cache-Control", "public, max-age=120, stale-while-revalidate=300")
  res.json({ success: true, data: items })
})

const getBySlug = asyncHandler(async (req, res) => {
  const item = await svc.getBySlug(req.params.slug)
  if (!item) return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Recommendation not found" })
  res.json({ success: true, data: item })
})

/* ── Admin ─────────────────────────────────────────────────────────────── */

const listForAdmin = asyncHandler(async (req, res) => {
  const { page, limit, status, category, q } = req.query
  const result = await svc.listForAdmin({ page, limit, status, category, q })
  res.json({ success: true, data: result.items, pagination: result.pagination })
})

const getOneForAdmin = asyncHandler(async (req, res) => {
  const item = await svc.getForAdmin(req.params.id)
  if (!item) return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Recommendation not found" })
  res.json({ success: true, data: item })
})

const create = asyncHandler(async (req, res) => {
  const adminId = req.user?.id
  const item = await svc.createOne(req.body || {}, adminId)
  res.status(201).json({ success: true, data: item })
})

const update = asyncHandler(async (req, res) => {
  const item = await svc.updateOne(req.params.id, req.body || {})
  if (!item) return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Recommendation not found" })
  res.json({ success: true, data: item })
})

const remove = asyncHandler(async (req, res) => {
  const result = await svc.removeOne(req.params.id)
  if (!result) return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Recommendation not found" })
  res.json({ success: true, data: result })
})

module.exports = {
  listPublic, getBySlug,
  listForAdmin, getOneForAdmin, create, update, remove,
}
