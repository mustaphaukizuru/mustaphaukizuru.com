/* ════════════════════════════════════════════════════════════════════════
   adminCampaignRoutes.js · /api/v1/admin/campaigns
   ────────────────────────────────────────────────────────────────────────
   protect + adminOnly. State-changing send actions are layered with the
   payment-style rate limiter so a runaway script can't blast subscribers.
   ════════════════════════════════════════════════════════════════════════ */

const express = require("express")
const c = require("../controllers/adminCampaignController")
const { protect, adminOnly } = require("../middleware/authMiddleware")
const { paymentRateLimiter } = require("../middleware/rateLimiter")

const router = express.Router()
router.use(protect, adminOnly)

router.get("/",                       c.list)
router.post("/",                      c.create)
router.post("/audience-count",        c.audienceCount)        // peek count for any audience config

router.get("/:id",                    c.get)
router.patch("/:id",                  c.update)
router.delete("/:id",                 c.remove)

router.get("/:id/preview",            c.preview)              // returns wrapped HTML
router.post("/:id/test",              paymentRateLimiter, c.testSend)
router.post("/:id/send-now",          paymentRateLimiter, c.sendNow)

module.exports = router
