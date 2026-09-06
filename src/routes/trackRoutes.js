/**
 * Public project tracking (T5-2).
 *
 *   GET /api/v1/track/:code   → phase, milestones, public events, open-request count
 *
 * No auth by design, which is why the surface is narrow (ADR 0006) and the
 * limiter is tight. Mounted in routes/index.js.
 */
const express = require("express")
const { trackRateLimiter } = require("../middleware/rateLimiter")
const c = require("../controllers/trackController")

const router = express.Router()

router.get("/:code", trackRateLimiter, c.getByCode)
// T5-15 · the opt-out link at the foot of the weekly digest. Same limiter:
// it takes the same code and must not become a way around the other one.
router.get("/:code/digest-opt-out", trackRateLimiter, c.optOutOfDigest)

module.exports = router
