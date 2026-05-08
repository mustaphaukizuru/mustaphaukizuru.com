// ─────────────────────────────────────────────────────────────────────────────
// availabilityRoutes.js  (mounted at /api/v1/availability — public read)
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express")
const { listSlots, listDays } = require("../controllers/availabilityController")

const router = express.Router()

// GET /api/v1/availability/slots — slots for a single date
router.get("/slots", listSlots)

// GET /api/v1/availability/days — calendar grid (which days have ≥1 slot)
router.get("/days", listDays)

module.exports = router
