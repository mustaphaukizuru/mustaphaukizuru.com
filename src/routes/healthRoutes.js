const express = require("express")
const { getHealth, getDeepHealth, getJobsHealth, requireHealthAccess } = require("../controllers/healthController")
const { attachUserIfPresent } = require("../middleware/authMiddleware")
const { healthDeepRateLimiter } = require("../middleware/rateLimiter")

const router = express.Router()

// Liveness — fast, single DB check. Used by load balancers + uptime monitors.
router.get("/",     getHealth)

// Cron dead-man switch — 503 while any scheduled job is overdue.
router.get("/jobs", getJobsHealth)

// Deep health — probes DB + SMTP + MercadoPago + PayPal in parallel. Used by
// the hourly uptime probe (X-Health-Token) and the deploy gate. Authenticated
// and separately rate-limited: it opens real provider connections.
router.get("/deep", healthDeepRateLimiter, attachUserIfPresent, requireHealthAccess, getDeepHealth)

module.exports = router
