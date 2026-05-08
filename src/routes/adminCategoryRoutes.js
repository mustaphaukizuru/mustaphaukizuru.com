const express = require("express")
const {
  listAdminCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require("../controllers/adminCategoryController")
const { protect, adminOnly } = require("../middleware/authMiddleware")

const router = express.Router()

router.use(protect, adminOnly)

router.get   ("/",     listAdminCategories)
router.post  ("/",     createCategory)
router.patch ("/:id",  updateCategory)
router.delete("/:id",  deleteCategory)

module.exports = router