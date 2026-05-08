const express = require("express")
const {
  listAdminUsers,
  patchUserStatus,
  patchUserRole,
} = require("../controllers/adminUserController")
const { protect, adminOnly } = require("../middleware/authMiddleware")

const router = express.Router()

router.use(protect, adminOnly)

router.get  ("/",            listAdminUsers)
router.patch("/:id/status",  patchUserStatus)
router.patch("/:id/role",    patchUserRole)

module.exports = router
