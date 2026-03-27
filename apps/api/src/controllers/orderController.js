const asyncHandler = require("../utils/asyncHandler")
const {
  createOrder: createOrderService,
  getOrderById: getOrderByIdService,
  getOrdersByUserId,
} = require("../services/orderService")
const { sendOrderPlacedEmail } = require("../utils/mailer")

// POST /api/orders — requires auth (userId needed for download entitlement)
const createOrder = asyncHandler(async (req, res) => {
  const { customerName, customerEmail, items } = req.body
  const userId = req.user?.id   // protected route — always present

  if (!customerName || !customerEmail) {
    return res.status(400).json({ success: false, message: "customerName and customerEmail are required" })
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: "At least one order item is required" })
  }

  const order = await createOrderService({ customerName, customerEmail, userId, items })

  // Send confirmation email (non-blocking)
  sendOrderPlacedEmail(order).catch((err) =>
    console.error("[createOrder] email failed:", err.message)
  )

  return res.status(201).json({ success: true, message: "Order created successfully", data: order })
})

// GET /api/orders/my
const getMyOrders = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, message: "Authentication required" })

  const orders = await getOrdersByUserId(userId)
  return res.status(200).json({ success: true, data: orders })
})

// GET /api/orders/:id
const getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params
  const order   = await getOrderByIdService(id)

  if (!order) return res.status(404).json({ success: false, message: "Order not found" })

  const isAdmin = req.user?.role === "admin"
  const isOwner = order.userId && req.user?.id === order.userId

  if (!isAdmin && !isOwner) {
    return res.status(403).json({ success: false, message: "You do not have access to this order" })
  }

  return res.status(200).json({ success: true, data: order })
})

module.exports = { createOrder, getMyOrders, getOrderById }
