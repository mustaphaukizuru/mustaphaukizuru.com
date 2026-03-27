// paymentRoutes.js — Stripe removed. This file is kept to prevent import errors.
// All payment logic is now in mercadoPagoRoutes.js and paypalRoutes.js
const express = require("express")
const router  = express.Router()

// No active routes — kept for backwards compatibility
module.exports = { router, stripeWebhook: null }
