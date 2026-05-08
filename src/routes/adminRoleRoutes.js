/* ════════════════════════════════════════════════════════════════════════
   adminRoleRoutes.js · /api/v1/admin/roles
   ════════════════════════════════════════════════════════════════════════ */

const express = require("express")
const c = require("../controllers/adminRoleController")
const { protect, adminOnly } = require("../middleware/authMiddleware")

const router = express.Router()
router.use(protect, adminOnly)

router.get("/",             c.list)
router.get("/permissions",  c.permissions)
router.post("/",            c.create)
router.patch("/:id",        c.update)
router.delete("/:id",       c.remove)

module.exports = router
