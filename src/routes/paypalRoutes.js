const express = require("express")

const {
  createOrder,
  captureOrder,
  webhook,
  issueRefund,
} = require("../controllers/paypalController")

const { paymentRateLimiter } = require("../middleware/rateLimiter")
const { protect, adminOnly } = require("../middleware/authMiddleware")

/**
 * PayPal routes · V2
 *
 * The webhook route mounts express.raw per-route so the inbound bytes survive
 * intact for signature verification. This works alongside the global
 * express.json() middleware in app.js — Express picks the body parser based
 * on the route's own configuration.
 */

const router = express.Router()

// Authenticated payment flow — JSON body, rate-limited per user.
router.post("/create-order/:orderId",  protect, paymentRateLimiter, createOrder)
router.post("/capture/:paypalOrderId", protect, paymentRateLimiter, captureOrder)

// Refunds — admin only.
router.post("/refund", protect, adminOnly, issueRefund)

// Webhook — RAW body for signature verify, NOT rate-limited (PayPal retries).
router.post("/webhook", express.raw({ type: "application/json" }), webhook)

module.exports = router
