/* ════════════════════════════════════════════════════════════════════════
   recommendationRoutes.js · /api/v1/recommendations (public reads)
   ────────────────────────────────────────────────────────────────────────
   Specific paths first; /:slug last so it doesn't capture other words.
   ════════════════════════════════════════════════════════════════════════ */

const express = require("express")
const c = require("../controllers/recommendationController")

const router = express.Router()

router.get("/",       c.listPublic)
router.get("/:slug",  c.getBySlug)

module.exports = router
