const express = require("express")

const {
  createOrder,
  captureOrder,
  issueRefund,
} = require("../controllers/paypalController")

const { paymentRateLimiter } = require("../middleware/rateLimiter")
const { protect, adminOnly } = require("../middleware/authMiddleware")

/**
 * PayPal routes · V3
 *
 * The webhook used to be mounted here with a per-route express.raw, but that
 * silently broke under the global express.json() (body-parser sets _body=true
 * and per-route parsers no-op). The webhook now lives at the app level in
 * src/app.js — registered BEFORE express.json() — so signature verification
 * receives a real Buffer. See the comment block in src/app.js for the why.
 */

const router = express.Router()

// Authenticated payment flow — JSON body, rate-limited per user.
router.post("/create-order/:orderId",  protect, paymentRateLimiter, createOrder)
router.post("/capture/:paypalOrderId", protect, paymentRateLimiter, captureOrder)

// Refunds — admin only.
router.post("/refund", protect, adminOnly, issueRefund)

module.exports = router
