// @ts-check
/* ════════════════════════════════════════════════════════════════════════
   adminReviewRoutes.js · /api/v1/admin/reviews
   ────────────────────────────────────────────────────────────────────────
   Mounted in src/routes/index.js. All routes behind protect + adminOnly.

   Specific paths (/stats, /bulk) declared BEFORE /:id wildcards.
   ════════════════════════════════════════════════════════════════════════ */

const express = require("express")
const c = require("../controllers/adminReviewController")
const { protect, adminOnly } = require("../middleware/authMiddleware")

const router = express.Router()
router.use(protect, adminOnly)

// Read-only review queue
router.get("/stats", c.stats)
router.get("/",      c.list)
router.get("/:id",   c.getOne)

// Mutating actions
router.post("/bulk",   c.bulk)
router.patch("/:id",   c.update)
router.delete("/:id",  c.remove)

module.exports = router
