// @ts-check
/* ════════════════════════════════════════════════════════════════════════
   adminReviewController.js · HTTP layer for /api/v1/admin/reviews
   ────────────────────────────────────────────────────────────────────────
   Thin controllers — all DB + audit logic lives in adminReviewService.
   Every route is gated by `protect + adminOnly` at the route file.
   ════════════════════════════════════════════════════════════════════════ */

const asyncHandler = require("../utils/asyncHandler")
const svc = require("../services/adminReviewService")

/* GET /api/v1/admin/reviews/stats */
const stats = asyncHandler(async (req, res) => {
  const data = await svc.getStats()
  res.json({ success: true, data })
})

/* GET /api/v1/admin/reviews */
const list = asyncHandler(async (req, res) => {
  const { page, limit, status, minRating, productId, serviceId, q } = req.query
  const result = await svc.listReviews({
    page, limit, status, minRating, productId, serviceId, q,
  })
  res.json({
    success:    true,
    data:       result.items,
    pagination: result.pagination,
  })
})

/* GET /api/v1/admin/reviews/:id */
const getOne = asyncHandler(async (req, res) => {
  const review = await svc.getReviewForAdmin(req.params.id)
  if (!review) return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Review not found" })
  res.json({ success: true, data: review })
})

/* PATCH /api/v1/admin/reviews/:id */
const update = asyncHandler(async (req, res) => {
  const adminId = req.user?.id
  const review = await svc.updateReview(req.params.id, req.body || {}, adminId)
  if (!review) return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Review not found" })
  res.json({ success: true, data: review })
})

/* POST /api/v1/admin/reviews/bulk  body: { ids:[], action } */
const bulk = asyncHandler(async (req, res) => {
  const adminId = req.user?.id
  const { ids, action } = req.body || {}
  const result = await svc.bulkAction(ids, action, adminId)
  res.json({ success: true, data: result })
})

/* DELETE /api/v1/admin/reviews/:id */
const remove = asyncHandler(async (req, res) => {
  const adminId = req.user?.id
  const result = await svc.deleteReview(req.params.id, adminId)
  if (!result) return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Review not found" })
  res.json({ success: true, data: result })
})

module.exports = { stats, list, getOne, update, bulk, remove }
