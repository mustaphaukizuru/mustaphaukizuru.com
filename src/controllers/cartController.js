const asyncHandler = require("../utils/asyncHandler")
const cartService  = require("../services/cartService")

/* ────────────────────────────────────────────────────────────────────────────
 * Cart handlers
 * Every handler assumes `protect` middleware has populated req.user.
 * ──────────────────────────────────────────────────────────────────────────── */

const getCart = asyncHandler(async (req, res) => {
  const cart = await cartService.getCart(req.user.id)
  res.json({ success: true, data: cart })
})

const addItem = asyncHandler(async (req, res) => {
  const { productId, serviceId, quantity } = req.body || {}

  if (!productId && !serviceId) {
    return res.status(400).json({
      success: false, code: "VALIDATION_ERROR",
      message: "productId or serviceId is required",
    })
  }
  if (productId && serviceId) {
    return res.status(400).json({
      success: false, code: "VALIDATION_ERROR",
      message: "Pass productId OR serviceId, not both",
    })
  }
  if (quantity !== undefined) {
    const n = Number(quantity)
    if (!Number.isFinite(n) || n < 1 || n > 999) {
      return res.status(400).json({
        success: false, code: "VALIDATION_ERROR",
        message: "quantity must be between 1 and 999",
      })
    }
  }

  const cart = await cartService.addItem(req.user.id, { productId, serviceId, quantity })
  res.status(201).json({ success: true, data: cart })
})

const updateItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params
  const { quantity } = req.body || {}

  if (quantity === undefined || quantity === null) {
    return res.status(400).json({
      success: false, code: "VALIDATION_ERROR",
      message: "quantity is required",
    })
  }
  const n = Number(quantity)
  if (!Number.isFinite(n) || n < 0 || n > 999) {
    return res.status(400).json({
      success: false, code: "VALIDATION_ERROR",
      message: "quantity must be between 0 and 999",
    })
  }

  const cart = await cartService.updateItemQuantity(req.user.id, itemId, n)
  res.json({ success: true, data: cart })
})

const removeItem = asyncHandler(async (req, res) => {
  const cart = await cartService.removeItem(req.user.id, req.params.itemId)
  res.json({ success: true, data: cart })
})

const clearCart = asyncHandler(async (req, res) => {
  const cart = await cartService.clearCart(req.user.id)
  res.json({ success: true, data: cart })
})

const mergeGuestCart = asyncHandler(async (req, res) => {
  const { items } = req.body || {}
  if (!Array.isArray(items)) {
    return res.status(400).json({
      success: false, code: "VALIDATION_ERROR",
      message: "items must be an array",
    })
  }
  const result = await cartService.mergeGuestCart(req.user.id, items)
  res.json({
    success: true,
    data:    result.cart,
    merged:  result.merged,
    skipped: result.skipped,
  })
})

/* ────────────────────────────────────────────────────────────────────────────
 * Coupon on cart — apply / remove
 * ──────────────────────────────────────────────────────────────────────────── */

const applyCoupon = asyncHandler(async (req, res) => {
  const { code } = req.body || {}
  if (!code || typeof code !== "string") {
    return res.status(400).json({
      success: false, code: "VALIDATION_ERROR",
      message: "Coupon code is required",
    })
  }
  const cart = await cartService.applyCoupon(req.user.id, code)
  res.json({ success: true, data: cart })
})

const removeCoupon = asyncHandler(async (req, res) => {
  const cart = await cartService.removeCoupon(req.user.id)
  res.json({ success: true, data: cart })
})

module.exports = {
  getCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
  mergeGuestCart,
  applyCoupon,
  removeCoupon,
}
