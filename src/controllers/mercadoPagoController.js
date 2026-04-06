const asyncHandler = require("../utils/asyncHandler")
const prisma       = require("../lib/prisma")
const {
  createMercadoPagoPreference,
  getMercadoPagoPayment,
  markOrderPaidByMP,
} = require("../services/mercadoPagoService")
const { sendOrderPaidEmail } = require("../utils/mailer")
const { notifyOrderPaid, notifyDownloadReady } = require("../services/notificationService")

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/mercadopago/create-preference
// Creates a Checkout Pro preference and returns init_point URL
// ─────────────────────────────────────────────────────────────────────────────
const createPreference = asyncHandler(async (req, res) => {
  const { orderId } = req.body

  if (!orderId) {
    return res.status(400).json({ success: false, message: "orderId is required" })
  }

  const result = await createMercadoPagoPreference({ orderId })

  return res.status(200).json({
    success: true,
    data: {
      preferenceId: result.preferenceId,
      initPoint:    result.initPoint,
      sandboxPoint: result.sandboxPoint,
    },
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/mercadopago/webhook
// Receives IPN / webhook notifications from Mercado Pago
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/mercadopago/webhook  (MP IPN notification)
// MP sends: POST body { type, action, data: { id } }
// OR GET query: ?type=payment&data.id=1234
// ─────────────────────────────────────────────────────────────────────────────
const webhook = async (req, res) => {
  try {
    // Log the raw event for audit
    await prisma.paymentWebhook.create({
      data: {
        paymentGateway: "mercadopago",
        eventType:      req.query?.type || req.body?.type || "unknown",
        payloadJson:    req.body || {},
        processed:      false,
      },
    }).catch(() => null)

    // MP IPN: check body first, then query params
    const bodyType  = req.body?.type   || req.body?.action
    const queryType = req.query?.type
    const type      = bodyType || queryType || "unknown"
    const action    = req.body?.action || ""

    // Payment ID can come from body data.id or query data.id
    const notifData = req.body?.data || {}
    const paymentId = notifData?.id
      || req.query?.["data.id"]
      || req.query?.id
      || null

    // Handle payment notifications
    const isPaymentEvent = type?.startsWith("payment") || action?.startsWith("payment")
    if (isPaymentEvent && paymentId) {
      const mpPayment = await getMercadoPagoPayment(paymentId)
      if (!mpPayment) {
        return res.status(200).json({ received: true })
      }

      const orderId = mpPayment.external_reference
        || mpPayment.metadata?.orderId
        || null

      if (!orderId) {
        return res.status(200).json({ received: true })
      }

      // Idempotency: skip if order already in final state
      const existingOrd = await prisma.order.findUnique({
        where: { id: orderId },
        select: { status: true },
      }).catch(() => null)

      if (existingOrd?.status === "paid" && mpPayment.status !== "approved") {
        return res.status(200).json({ received: true })
      }

      const updated = await markOrderPaidByMP({
        orderId,
        paymentId,
        status: mpPayment.status,
      })

      if (mpPayment.status === "approved") {
        // Fire-and-forget email
        sendOrderPaidEmail(updated).catch((e) => console.error('[email]', e.message))
        notifyOrderPaid(updated).catch(() => {})
      }

      // Mark webhook as processed
      await prisma.paymentWebhook.updateMany({
        where: { paymentGateway: "mercadopago", processed: false },
        data:  { processed: true, processedAt: new Date() },
      }).catch(() => null)
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    console.error("[MercadoPago webhook]", err.message)
    return res.status(200).json({ received: true }) // Always 200 to MP
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/mercadopago/status/:orderId
// Poll order payment status (used after redirect back from MP)
// ─────────────────────────────────────────────────────────────────────────────
const getPaymentStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params
  const userId = req.user?.id

  const order = await prisma.order.findUnique({
    where:  { id: orderId },
    select: { id: true, status: true, userId: true, totalAmount: true, paidAt: true },
  })

  if (!order) return res.status(404).json({ success: false, message: "Order not found" })
  if (order.userId && userId && order.userId !== userId && req.user?.role !== "admin") {
    return res.status(403).json({ success: false, message: "Access denied" })
  }

  return res.status(200).json({ success: true, data: { status: order.status, paidAt: order.paidAt } })
})

module.exports = { createPreference, webhook, getPaymentStatus }
