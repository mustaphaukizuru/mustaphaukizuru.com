const express = require("express")
const { listAdminUsers } = require("../controllers/adminUserController")
const { protect, adminOnly } = require("../middleware/authMiddleware")

const router = express.Router()

router.get("/", protect, adminOnly, listAdminUsers)

module.exports = router