// ─────────────────────────────────────────────────────────────────────────────
// Admin Refund Routes · M15
//
// Mounted in src/routes/index.js at:
//
//   /api/v1/admin/refunds                                    (list + detail)
//   /api/v1/admin/orders/:orderId/refund-eligibility         (eligibility check)
//   /api/v1/admin/orders/:orderId/refund                     (issue refund)
//
// All routes are admin-only and rate-limited via paymentRateLimiter so a
// runaway script can't fire off more than 10 refunds per hour per admin
// account.
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express")

const {
  getEligibility,
  issueRefund,
  listRefunds,
  getRefundById,
} = require("../controllers/refundController")

const { protect, adminOnly } = require("../middleware/authMiddleware")
const { paymentRateLimiter } = require("../middleware/rateLimiter")

const router = express.Router()

// ── Listing + detail (read-only — no rate limiter beyond the global one) ──
router.get("/refunds",      protect, adminOnly, listRefunds)
router.get("/refunds/:id",  protect, adminOnly, getRefundById)

// ── Order-scoped: eligibility + issue refund ──
//
// Eligibility is read-only. Issue is a state-changing, money-moving action,
// so we layer the payment rate limiter on top of admin auth.
router.get("/orders/:orderId/refund-eligibility", protect, adminOnly, getEligibility)
router.post("/orders/:orderId/refund",            protect, adminOnly, paymentRateLimiter, issueRefund)

module.exports = router
