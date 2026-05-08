const asyncHandler = require("../utils/asyncHandler")
const couponService = require("../services/couponService")

/* ────────────────────────────────────────────────────────────────────────────
 * Admin coupon CRUD — every route protected by `protect` + `adminOnly`.
 * ──────────────────────────────────────────────────────────────────────────── */

const list = asyncHandler(async (req, res) => {
  const page  = Number.parseInt(req.query.page, 10) || 1
  const limit = Number.parseInt(req.query.limit, 10) || 20
  const includeInactive = req.query.includeInactive === "true" || req.query.includeInactive === "1"

  if (page < 1) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "'page' must be >= 1" })
  }
  if (limit < 1 || limit > 100) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "'limit' must be between 1 and 100" })
  }

  const result = await couponService.listCoupons({ page, limit, includeInactive })
  res.json({
    success:    true,
    data:       result.items,
    pagination: result.pagination,
  })
})

const getOne = asyncHandler(async (req, res) => {
  const coupon = await couponService.getCouponById(req.params.id)
  if (!coupon) {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Coupon not found" })
  }
  res.json({ success: true, data: coupon })
})

const create = asyncHandler(async (req, res) => {
  const coupon = await couponService.createCoupon(req.body || {})
  res.status(201).json({ success: true, data: coupon })
})

const update = asyncHandler(async (req, res) => {
  const coupon = await couponService.updateCoupon(req.params.id, req.body || {})
  if (!coupon) {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Coupon not found" })
  }
  res.json({ success: true, data: coupon })
})

const softDelete = asyncHandler(async (req, res) => {
  const coupon = await couponService.softDeleteCoupon(req.params.id)
  if (!coupon) {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Coupon not found" })
  }
  res.json({ success: true, data: coupon })
})

const usage = asyncHandler(async (req, res) => {
  const page  = Number.parseInt(req.query.page, 10) || 1
  const limit = Number.parseInt(req.query.limit, 10) || 50

  const result = await couponService.listCouponUsage(req.params.id, { page, limit })
  if (!result) {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Coupon not found" })
  }
  res.json({
    success:    true,
    data:       result.items,
    coupon:     result.coupon,
    pagination: result.pagination,
  })
})

module.exports = { list, getOne, create, update, softDelete, usage }
