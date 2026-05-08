const asyncHandler = require("../utils/asyncHandler")
const wishlistService = require("../services/wishlistService")

/**
 * Wishlist controller (B08)
 *
 * All routes require auth — mounted under `/api/member/wishlist` with the
 * `protect` middleware applied at the router level. Uses req.user.id as the
 * source of truth for ownership.
 *
 * Note on move-to-cart: the cart is client-side (localStorage, via
 * CartContext). So this controller just removes the item and returns the
 * product snapshot — the frontend calls `addToCart(product)` with the
 * returned product data. No server-side cart writes needed.
 */

const list = asyncHandler(async (req, res) => {
  const items = await wishlistService.listItems(req.user.id)
  res.json({ success: true, data: items })
})

const add = asyncHandler(async (req, res) => {
  const { productId } = req.body || {}
  try {
    const item = await wishlistService.addItem(req.user.id, productId)
    res.status(201).json({ success: true, data: item })
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return res.status(err.statusCode || 400).json({
        success: false, code: err.code, message: err.message,
      })
    }
    throw err
  }
})

const remove = asyncHandler(async (req, res) => {
  const result = await wishlistService.removeItem(req.user.id, req.params.id)
  if (!result) {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Wishlist item not found" })
  }
  res.json({ success: true, data: result })
})

/**
 * POST /api/member/wishlist/items/:id/move-to-cart
 *
 * Since the cart is client-side, this endpoint:
 *   1. Looks up the item + attached product snapshot
 *   2. Removes the wishlist item
 *   3. Returns the product snapshot in the response so the frontend can
 *      pass it to `addToCart()` immediately
 *
 * The frontend treats this as: request → await → addToCart(product) → done.
 */
const moveToCart = asyncHandler(async (req, res) => {
  const item = await wishlistService.getItemById(req.user.id, req.params.id)
  if (!item) {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Wishlist item not found" })
  }

  if (!item.product) {
    // Product was deleted — remove the dangling wishlist item but tell the frontend.
    await wishlistService.removeItem(req.user.id, item.id).catch(() => {})
    return res.status(410).json({
      success: false, code: "PRODUCT_UNAVAILABLE",
      message: "Product is no longer available",
    })
  }

  if (item.product.isActive === false) {
    return res.status(409).json({
      success: false, code: "PRODUCT_INACTIVE",
      message: "Product is not currently available for purchase",
    })
  }

  const product = item.product
  await wishlistService.removeItem(req.user.id, item.id)

  res.json({
    success: true,
    message: "Moved to cart",
    data: { product },
  })
})

module.exports = { list, add, remove, moveToCart }
