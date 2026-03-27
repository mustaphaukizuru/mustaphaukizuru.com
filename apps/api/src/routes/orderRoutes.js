const express  = require("express")
const { protect } = require("../middleware/authMiddleware")
const { createOrder, getMyOrders, getOrderById } = require("../controllers/orderController")

const router = express.Router()

router.post("/",    protect, createOrder)    // ← protect added: userId required for entitlement
router.get("/my",   protect, getMyOrders)
router.get("/:id",  protect, getOrderById)

module.exports = router
