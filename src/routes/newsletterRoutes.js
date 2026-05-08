const express = require("express")
const { newsletterRateLimiter } = require("../middleware/rateLimiter")
const c = require("../controllers/newsletterController")

const router = express.Router()

/**
 * Public newsletter endpoints (B07).
 *
 *   POST /api/newsletter/subscribe       → email + optional name + source
 *   GET  /api/newsletter/unsubscribe/:token  → redirects to /unsubscribed
 */

router.post("/subscribe",          newsletterRateLimiter, c.subscribe)
router.get("/unsubscribe/:token",  c.unsubscribe)

module.exports = router
