const asyncHandler = require("../utils/asyncHandler")
const {
  getAdminOrders,
  getAdminOrderById,
  updateOrderStatus,
} = require("../services/adminOrderService")

const listAdminOrders = asyncHandler(async (req, res) => {
  const filters = {
    status: req.query.status || undefined,
    page:   req.query.page   || 1,
    limit:  req.query.limit  || 30,
  }
  const result = await getAdminOrders(filters)
  res.status(200).json({ success: true, data: result.orders, meta: result.meta })
})

const getSingleAdminOrder = asyncHandler(async (req, res) => {
  const order = await getAdminOrderById(req.params.id)

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    })
  }

  res.status(200).json({
    success: true,
    data: order,
  })
})

const patchAdminOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body

  const order = await updateOrderStatus(req.params.id, status)

  res.status(200).json({
    success: true,
    data: order,
  })
})

module.exports = {
  listAdminOrders,
  getAdminOrderById: getSingleAdminOrder,
  updateAdminOrderStatus: patchAdminOrderStatus,
}