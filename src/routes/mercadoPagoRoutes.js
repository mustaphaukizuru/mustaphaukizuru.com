const express = require("express")

const {
  createPreference,
  webhook,
  getPaymentStatus,
  issueRefund,
} = require("../controllers/mercadoPagoController")

const { paymentRateLimiter } = require("../middleware/rateLimiter")
const { protect, adminOnly } = require("../middleware/authMiddleware")

const router = express.Router()

// Authenticated checkout flow.
router.post("/create-preference", protect, paymentRateLimiter, createPreference)
router.get("/status/:orderId",    protect,                     getPaymentStatus)

// Refunds — admin only.
router.post("/refund", protect, adminOnly, issueRefund)

// Webhook — exempt from auth + rate limiter (MP retries for 24h).
// MP sends POST (body) and sometimes GET (query); accept both.
router.post("/webhook", webhook)
router.get("/webhook",  webhook)

module.exports = router
