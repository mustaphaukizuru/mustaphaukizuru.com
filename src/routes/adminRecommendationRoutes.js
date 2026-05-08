/* ════════════════════════════════════════════════════════════════════════
   adminRecommendationRoutes.js · /api/v1/admin/recommendations
   ────────────────────────────────────────────────────────────────────────
   protect + adminOnly gated. Mirrors the admin-services CRUD pattern.
   ════════════════════════════════════════════════════════════════════════ */

const express = require("express")
const c = require("../controllers/recommendationController")
const { protect, adminOnly } = require("../middleware/authMiddleware")

const router = express.Router()
router.use(protect, adminOnly)

router.get("/",       c.listForAdmin)
router.post("/",      c.create)
router.get("/:id",    c.getOneForAdmin)
router.patch("/:id",  c.update)
router.delete("/:id", c.remove)

module.exports = router
