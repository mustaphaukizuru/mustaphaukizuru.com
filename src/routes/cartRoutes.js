const express = require("express")
const { protect } = require("../middleware/authMiddleware")
const cartController = require("../controllers/cartController")

const router = express.Router()

// All cart routes require authentication.
router.use(protect)

// Read the current user's active cart.
router.get("/", cartController.getCart)

// Clear the whole cart.
router.delete("/", cartController.clearCart)

// Merge guest localStorage cart on login.
router.post("/merge", cartController.mergeGuestCart)

// Coupon on cart (must come before /items/:itemId wildcards).
router.post("/coupon",   cartController.applyCoupon)
router.delete("/coupon", cartController.removeCoupon)

// Line items.
router.post("/items",            cartController.addItem)
router.patch("/items/:itemId",   cartController.updateItem)
router.delete("/items/:itemId",  cartController.removeItem)

module.exports = router
