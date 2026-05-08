const asyncHandler  = require("../utils/asyncHandler")
const { validateCoupon } = require("../services/couponService")

/**
 * POST /api/coupons/validate
 * Public endpoint — lets the UI check a code before the user commits to
 * applying it to the cart (instant inline feedback on CartPage).
 *
 * Body: { code: string, cartTotal: number }
 *
 * Response (always 200 — invalid is a business outcome, not an HTTP error):
 *   { success: true, data: { valid, discount, message, coupon? } }
 */
const validate = asyncHandler(async (req, res) => {
  const { code, cartTotal } = req.body || {}

  if (!code || typeof code !== "string") {
    return res.status(400).json({
      success: false, code: "VALIDATION_ERROR",
      message: "Coupon code is required",
    })
  }

  const total = cartTotal !== undefined ? Number(cartTotal) : 0
  if (!Number.isFinite(total) || total < 0) {
    return res.status(400).json({
      success: false, code: "VALIDATION_ERROR",
      message: "cartTotal must be a non-negative number",
    })
  }

  // User context is optional — authenticated callers get the per-user limit
  // check, anonymous callers just get the public-validity check.
  const userId = req.user?.id

  const result = await validateCoupon(code, { cartTotal: total, userId })
  res.json({ success: true, data: result })
})

module.exports = { validate }
