const express  = require("express")
const { protect, attachUserIfPresent } = require("../middleware/authMiddleware")
const { paymentRateLimiter } = require("../middleware/rateLimiter")
const { createOrder, getMyOrders, getOrderById } = require("../controllers/orderController")

const router = express.Router()

// Guest checkout: POST works for both signed-in and anonymous buyers.
// attachUserIfPresent populates req.user when a valid token is sent;
// otherwise the controller falls back to findOrCreateUserForCheckout.
//
// Rate limit · paymentRateLimiter applies a 10/hour bucket. For signed-in
// users it keys by userId; for guests it falls back to IP. Stops the guest
// checkout endpoint from being weaponised as a User-creation + email-spam
// vector behind the global 100/15min limiter.
router.post("/",    attachUserIfPresent, paymentRateLimiter, createOrder)

// Read endpoints stay protected — only the buyer (or admin) can list/view
// their own orders.
router.get("/my",   protect, getMyOrders)
router.get("/:id",  protect, getOrderById)

module.exports = router
