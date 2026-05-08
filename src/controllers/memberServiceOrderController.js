const asyncHandler = require("../utils/asyncHandler")
const serviceOrderService = require("../services/serviceOrderService")

/**
 * GET /api/member/service-orders — user's service orders (summary list)
 */
const listMine = asyncHandler(async (req, res) => {
  const items = await serviceOrderService.listUserServiceOrders(req.user.id)
  res.json({ success: true, data: items })
})

/**
 * GET /api/member/service-orders/:id — detailed view (includes consultations,
 * client project, milestones, recent files)
 */
const getMine = asyncHandler(async (req, res) => {
  const item = await serviceOrderService.getUserServiceOrderById(req.user.id, req.params.id)
  if (!item) {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Service order not found" })
  }
  res.json({ success: true, data: item })
})

module.exports = { listMine, getMine }
