// ─────────────────────────────────────────────────────────────────────────────
// Member Refund Routes · M15 + M16
//
// Mounted in src/routes/index.js at /api/v1/member/orders.
//
// Endpoints (relative to that mount):
//   GET  /:orderId/refunds           — refund history for an own order
//   POST /:orderId/refund-request    — open a refund-request support ticket
//
// Authorisation: handler enforces "owner or admin" — see refundController.
// Rate limit: paymentRateLimiter caps refund-request POSTs at 10/hour/user
// to prevent ticket spam.
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express")

const {
  getMemberOrderRefunds,
  requestRefund,
} = require("../controllers/refundController")
const { protect }            = require("../middleware/authMiddleware")
const { paymentRateLimiter } = require("../middleware/rateLimiter")

const router = express.Router()

router.get("/:orderId/refunds",         protect,                     getMemberOrderRefunds)
router.post("/:orderId/refund-request", protect, paymentRateLimiter, requestRefund)

module.exports = router
