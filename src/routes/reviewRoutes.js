/* ════════════════════════════════════════════════════════════════════════
   reviewRoutes.js · subject-agnostic review actions
   ────────────────────────────────────────────────────────────────────────
   Mounted at /api/v1/reviews. Per-subject CRUD lives on the product and
   service routers (e.g. /api/v1/products/:slug/reviews); this file owns
   the actions that don't depend on the subject — currently the helpful
   vote, with future flag/edit endpoints landing here too.
   ════════════════════════════════════════════════════════════════════════ */

const express = require("express")
const c = require("../controllers/reviewController")
const { protect } = require("../middleware/authMiddleware")

const router = express.Router()

// Public — specific path declared before /:id wildcards
router.get("/featured",      c.listFeatured)

// Auth-gated actions
router.post("/:id/helpful",  protect, c.voteHelpful)

module.exports = router
