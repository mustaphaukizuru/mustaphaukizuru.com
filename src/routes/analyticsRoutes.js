// =============================================================
// analyticsRoutes.js · public tracking (M14)
// Mount at: router.use("/analytics", analyticsRoutes)
// =============================================================

const { Router } = require("express")
const ctrl = require("../controllers/analyticsController")
const rateLimit = require("express-rate-limit")

// Tighter rate limit on public tracking — 60 req/min/IP is plenty for any
// legitimate browser, prevents abuse from scripts.
const trackLimiter = rateLimit({
  windowMs: 60_000,
  max:      60,
  standardHeaders: true,
  legacyHeaders:   false,
})

const router = Router()
router.post("/pageview", trackLimiter, ctrl.trackPageView)
router.post("/event",    trackLimiter, ctrl.trackEvent)

module.exports = router
