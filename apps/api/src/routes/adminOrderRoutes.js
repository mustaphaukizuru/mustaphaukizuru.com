const express = require("express")
const {
  listAdminOrders,
  getAdminOrderById,
  updateAdminOrderStatus,
} = require("../controllers/adminOrderController")
const { protect, adminOnly } = require("../middleware/authMiddleware")

const router = express.Router()

router.get("/", protect, adminOnly, listAdminOrders)
router.get("/:id", protect, adminOnly, getAdminOrderById)
router.patch("/:id/status", protect, adminOnly, updateAdminOrderStatus)

module.exports = router