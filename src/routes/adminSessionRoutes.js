/* ════════════════════════════════════════════════════════════════════════
   adminSessionRoutes.js · /api/v1/admin/sessions
   ════════════════════════════════════════════════════════════════════════ */

const express = require("express")
const c = require("../controllers/adminSessionController")
const { protect, adminOnly } = require("../middleware/authMiddleware")

const router = express.Router()
router.use(protect, adminOnly)

router.get("/",                c.list)
router.delete("/:id",          c.revoke)
router.post("/users/:userId/revoke-all", c.revokeAll)

module.exports = router
