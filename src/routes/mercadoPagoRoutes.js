const express = require("express")
const { protect } = require("../middleware/authMiddleware")
const { createPreference, webhook, getPaymentStatus } = require("../controllers/mercadoPagoController")

const router = express.Router()

// Authenticated: create preference before redirecting to MP checkout
router.post("/create-preference",    protect, createPreference)

// Webhook from Mercado Pago (no auth — MP calls this directly)
router.post("/webhook",              webhook)
router.get("/webhook",               webhook)  // MP IPN sometimes sends GET

// Poll payment status after redirect back
router.get("/status/:orderId",       protect, getPaymentStatus)

module.exports = router
