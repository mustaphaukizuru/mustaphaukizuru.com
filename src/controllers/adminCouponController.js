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

/* ────────────────────────────────────────────────────────────────────────────
 * Coupons are single-use style. The admin form exposes only:
 *   code · discountType · discountValue · expiresAt · usageLimit (default 1)
 *   maxUsesPerUser (default 1) · isActive (+ optional description)
 * stackable / minOrderAmount / startsAt are ignored even if a client sends
 * them (they keep their DB defaults: stackable=true, null, null).
 * ──────────────────────────────────────────────────────────────────────────── */

const ALLOWED_FIELDS = ["code", "description", "discountType", "discountValue", "expiresAt", "usageLimit", "maxUsesPerUser", "isActive"]

function bad(res, message) {
  return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message })
}

function parseNullableInt(value, label) {
  if (value === undefined) return { value: undefined }
  if (value === null || value === "") return { value: null }
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1) return { error: `${label} must be a positive integer or empty` }
  return { value: n }
}

// Returns { data } or { error }.
function shapeCouponInput(body, { isCreate }) {
  const data = {}
  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined) data[key] = body[key]
  }

  if (data.discountType !== undefined && !["percentage", "fixed"].includes(data.discountType)) {
    return { error: "discountType must be 'percentage' or 'fixed'" }
  }
  if (data.discountValue !== undefined) {
    const v = Number(data.discountValue)
    if (!Number.isFinite(v) || v <= 0) return { error: "discountValue must be a positive number" }
    const type = data.discountType
    if (type === "percentage" && v > 100) return { error: "Percentage discount cannot exceed 100" }
    data.discountValue = v
  }
  if (data.expiresAt !== undefined && data.expiresAt !== null && data.expiresAt !== "") {
    const d = new Date(data.expiresAt)
    if (Number.isNaN(d.getTime())) return { error: "expiresAt must be a valid date" }
    data.expiresAt = d.toISOString()
  } else if (data.expiresAt === "") {
    data.expiresAt = null
  }
  for (const [key, label] of [["usageLimit", "usageLimit"], ["maxUsesPerUser", "maxUsesPerUser"]]) {
    const parsed = parseNullableInt(data[key], label)
    if (parsed.error) return { error: parsed.error }
    if (parsed.value !== undefined) data[key] = parsed.value
  }
  if (data.isActive !== undefined) data.isActive = Boolean(data.isActive)
  if (data.description !== undefined) data.description = data.description ? String(data.description).trim() || null : null

  if (isCreate) {
    // Single-use defaults: one redemption total, one per user.
    if (data.usageLimit === undefined)     data.usageLimit     = 1
    if (data.maxUsesPerUser === undefined) data.maxUsesPerUser = 1
  }
  // Business rule: coupons are single-use per customer. An empty field on
  // create OR update used to store null, which disables the per-customer cap
  // entirely; null is never a valid value for this column.
  if (data.maxUsesPerUser === null) data.maxUsesPerUser = 1
  return { data }
}

const create = asyncHandler(async (req, res) => {
  const shaped = shapeCouponInput(req.body || {}, { isCreate: true })
  if (shaped.error) return bad(res, shaped.error)
  const coupon = await couponService.createCoupon(shaped.data)
  res.status(201).json({ success: true, data: coupon })
})

const update = asyncHandler(async (req, res) => {
  const shaped = shapeCouponInput(req.body || {}, { isCreate: false })
  if (shaped.error) return bad(res, shaped.error)
  const coupon = await couponService.updateCoupon(req.params.id, shaped.data)
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
