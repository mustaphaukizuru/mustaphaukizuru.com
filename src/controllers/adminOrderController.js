const asyncHandler = require("../utils/asyncHandler")
const prisma = require("../lib/prisma")
const {
  getAdminOrders,
  getAdminOrderById,
  updateOrderStatus,
} = require("../services/adminOrderService")
const {
  sendOrderPaidEmail,
  sendOrderPendingEmail,
  sendOrderCancelledEmail,
  sendOrderFailedEmail,
  sendDownloadReadyEmail,
} = require("../utils/mailer")
const {
  notifyOrderPaid,
  notifyOrderFailed,
  notifyOrderCancelled,
  notifyDownloadReady,
} = require("../services/notificationService")

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

// PATCH /admin/orders/:id/status
//
// The service holds the transition table and writes the audit row; `paid`
// also runs fulfilment before it returns, so the download-ready emails
// below describe entitlements that already exist. `refunded` is refused
// here on purpose — only the refund endpoint may say a customer was
// refunded, because only it moves the money and revokes the downloads.
const patchAdminOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body

  const order = await updateOrderStatus(req.params.id, status, {
    adminUserId: req.user.id,
    ipAddress:   req.ip,
  })

  // Fetch full order with customer email for emails
  const fullOrder = await getAdminOrderById(req.params.id)

  if (fullOrder) {
    const emailOrder = {
      id: fullOrder.orderNumber || fullOrder.id,
      orderNumber: fullOrder.orderNumber,
      customerEmail: fullOrder.customerEmail || fullOrder.user?.email,
      customerName: fullOrder.customerName || fullOrder.user?.fullName || "Customer",
      totalAmount: fullOrder.totalAmount,
      status: fullOrder.status,
      userId: fullOrder.userId,
      items: (fullOrder.items || []).map((i) => ({
        title: i.title || i.titleSnapshot || "Item",
        quantity: i.quantity || 1,
        price: i.unitPrice || i.price || 0,
      })),
    }

    // Send status-specific email + notification (non-blocking)
    try {
      switch (status) {
        case "paid":
          sendOrderPaidEmail(emailOrder).catch(() => {})
          notifyOrderPaid(emailOrder).catch(() => {})
          // Also send download-ready for each product item
          if (fullOrder.items) {
            for (const item of fullOrder.items) {
              if (item.product && fullOrder.userId) {
                sendDownloadReadyEmail(emailOrder, item.product).catch(() => {})
                notifyDownloadReady(fullOrder.userId, item.product.title || item.title, fullOrder.orderNumber).catch(() => {})
              }
            }
          }
          break
        case "pending":
          sendOrderPendingEmail(emailOrder).catch(() => {})
          break
        case "failed":
          sendOrderFailedEmail(emailOrder).catch(() => {})
          notifyOrderFailed(emailOrder).catch(() => {})
          break
        case "cancelled":
          sendOrderCancelledEmail(emailOrder).catch(() => {})
          notifyOrderCancelled(emailOrder).catch(() => {})
          break
      }
    } catch (_) { /* email/notification failures must not break the response */ }
  }

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