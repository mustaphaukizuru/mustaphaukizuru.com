const express = require("express")
const { protect, adminOnly } = require("../middleware/authMiddleware")
const c = require("../controllers/adminLeadController")

const router = express.Router()
router.use(protect, adminOnly)

/**
 * Admin unified leads inbox (Tier 3).
 *
 *   GET /          → merged leads (contact · diagnostic · newsletter · booking)
 *   GET /:email    → single lead + full timeline
 */
router.get("/",       c.list)
router.get("/:email", c.timeline)

module.exports = router
