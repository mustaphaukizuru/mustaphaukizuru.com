const express = require("express")
const { listAdminCategories } = require("../controllers/adminCategoryController")
const { protect, adminOnly } = require("../middleware/authMiddleware")

const router = express.Router()

router.get("/", protect, adminOnly, listAdminCategories)

module.exports = router