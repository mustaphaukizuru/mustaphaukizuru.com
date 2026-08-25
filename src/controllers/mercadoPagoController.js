const asyncHandler = require("../utils/asyncHandler")
const logger       = require("../utils/logger")
const prisma       = require("../lib/prisma")

const {
  createMercadoPagoPreference,
  getMercadoPagoPayment,
  markOrderPaidByMP,
  verifyMercadoPagoSignature,
  // refundMercadoPagoPayment is no longer called from this controller —
  // the legacy /api/mercadopago/refund endpoint now delegates to
  // refundService, which calls the provider helper directly.
} = require("../services/mercadoPagoService")

const { sendTemplateEmail } = require("../services/emailService")
const { resolveUserLocale } = require("../utils/resolveUserLocale")
const { notifyOrderPaid }   = require("../services/notificationService")
const { fulfillOrder, recordOrderEvent } = require("../services/orderFulfillmentService")
const { generateReceiptPdf } = require("../services/receiptPdfService")
// M19 — refund orchestrator with Option A enforcement.
const { processOrderRefund } = require("../services/refundService")

/**
 * Mercado Pago controller · V2
 *
 * Changes from V1:
 *   • Webhook now verifies the x-signature header before doing anything,
 *     so an attacker can't forge a "your order is paid" notification.
 *   • markOrderPaidByMP is idempotent — duplicate webhook deliveries are
 *     handled silently and post-payment side-effects (email, notification,
 *     fulfilment) only fire on the FIRST transition to paid.
 *   • Email send swapped from the legacy `sendOrderPaidEmail` (hard-coded
 *     HTML in mailer.js) to `sendTemplateEmail({
      locale: resolveUserLocale({ req }), templateKey: "order.confirmed" })`
 *     so the admin can edit the template without a code change.
 */

/* ─────────────────── POST /api/mercadopago/create-preference ───────────── */

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

/* ─────────────────────────── POST /webhook ─────────────────────────────── */

const webhook = async (req, res) => {
  // Always reply 200 — MP retries non-200 for 24 hours.
  // Side-effects inside the try are best-effort.
  try {
    const signatureHeader = req.headers["x-signature"]
    const requestId       = req.headers["x-request-id"]
    const notifData       = req.body?.data || {}
    const paymentId =
      notifData?.id ||
      req.query?.["data.id"] ||
      req.query?.id ||
      null

    // 1. Signature verification FIRST (skipped in dev when MP_WEBHOOK_SECRET
    //    is unset). This used to run *after* the audit insert below, which
    //    handed any unauthenticated caller a write primitive: every spoofed
    //    POST created a paymentWebhook row before we ever checked the HMAC,
    //    so the table could be grown without limit. Verifying first costs
    //    nothing — signatureHeader, requestId and paymentId are all read
    //    from the request above — and it means only authentic events reach
    //    the database.
    //
    //    Trade-off, deliberate: forged deliveries are no longer persisted to
    //    the audit table. They are still logged (logger.warn below), which is
    //    the right place for them — an attacker-controlled row in a payments
    //    table is worse than a log line.
    const verified = verifyMercadoPagoSignature({ signatureHeader, requestId, dataId: paymentId })
    if (!verified) {
      logger.warn("[MP webhook] signature verification failed", { paymentId, requestId })
      return res.status(401).json({ received: true, error: "signature" })
    }

    // 2. Persist the raw event for audit before any processing.
    //    The (paymentGateway, gatewayEventId) unique constraint causes a
    //    P2002 on duplicate deliveries — we treat that as a no-op so MP
    //    retries within the dedup window don't spam the audit log.
    let auditRow = null
    try {
      auditRow = await prisma.paymentWebhook.create({
        data: {
          paymentGateway: "mercadopago",
          gatewayEventId: requestId || null, // x-request-id is MP's idempotency key
          eventType:      req.body?.action || req.body?.type || req.query?.type || "unknown",
          payloadJson:    { headers: { "x-request-id": requestId }, body: req.body || {}, query: req.query || {} },
          processed:      false,
        },
      })
    } catch (e) {
      if (e?.code === "P2002") {
        logger.info("[MP webhook] duplicate delivery, dropping", { requestId })
        return res.status(200).json({ received: true, duplicate: true })
      }
      // any other DB error — log and continue, audit is best-effort
      logger.warn("[MP webhook] audit insert failed:", e.message)
    }

    if (!paymentId) return res.status(200).json({ received: true })

    const isPaymentEvent =
      (req.body?.type   || "").startsWith("payment") ||
      (req.body?.action || "").startsWith("payment")

    if (!isPaymentEvent) return res.status(200).json({ received: true })

    // 3. Pull authoritative payment record from MP API.
    const mpPayment = await getMercadoPagoPayment(paymentId)
    if (!mpPayment) return res.status(200).json({ received: true })

    const orderId = mpPayment.external_reference || mpPayment.metadata?.orderId
    if (!orderId) return res.status(200).json({ received: true })

    // 4. Apply state transition (idempotent inside the service).
    //    Hardening · pass MP's reported transaction_amount so the service
    //    can validate against our local total and refuse to mark paid on
    //    a mismatch. The destructure also picks up any amountMismatch
    //    returned by the service.
    const { order, isFirstTransition, amountMismatch } = await markOrderPaidByMP({
      orderId,
      paymentId,
      status:           mpPayment.status,
      payload:          mpPayment,
      gatewayAmount:    mpPayment.transaction_amount,
      gatewayCurrency:  mpPayment.currency_id,
    })

    if (amountMismatch) {
      logger.error(`[MP webhook] amount mismatch order=${orderId}: ${JSON.stringify(amountMismatch)}`)
      // Update audit row with the mismatch so ops can pick it up later.
      if (auditRow?.id) {
        await prisma.paymentWebhook.update({
          where: { id: auditRow.id },
          data:  { processed: true, processedAt: new Date(),
                   eventType: `${auditRow.eventType}.amount_mismatch` },
        }).catch(() => null)
      }
      // Return 200 so MP doesn't retry — this is a permanent rejection,
      // not a transient failure.
      return res.status(200).json({ received: true, error: "amount_mismatch" })
    }

    // 5. Fire side-effects ONLY on the first paid transition.
    if (mpPayment.status === "approved" && isFirstTransition) {
      // PDF receipt — attached to the email. Generated in-memory; if it
      // fails we still send the email without an attachment rather than
      // block the customer-facing confirmation.
      let attachments
      try {
        const receiptBuffer = await generateReceiptPdf(order.id, { inMemory: true })
        attachments = [{
          filename:    `receipt-${order.orderNumber || order.id}.pdf`,
          content:     receiptBuffer,
          contentType: "application/pdf",
        }]
      } catch (e) {
        logger.warn(`[MP webhook] receipt PDF skipped: ${e.message}`)
      }

      // Email — template lives in DB, admin can edit without a redeploy.
      sendTemplateEmail({
        locale: resolveUserLocale({ req }),
        to:          order.customerEmail || order.billingEmail,
        templateKey: "order.confirmed",
        userId:      order.userId,
        attachments,
        variables: {
          customerName: order.customerName?.split(" ")[0] || "there",
          orderNumber:  order.orderNumber,
          orderTotal:   formatMoney(order.totalAmount, order.currency),
          orderUrl:     `${(process.env.FRONTEND_URL || "").replace(/\/$/, "")}/dashboard/orders/${order.id}`,
          gateway:      "Mercado Pago",
        },
      }).catch((e) => logger.error("[MP webhook] order.confirmed email:", e.message))

      notifyOrderPaid(order).catch(() => {})

      fulfillOrder(order.id)
        .then((r) => r.ok
          ? logger.info(`[fulfillOrder] ${order.orderNumber} → ${r.entitlements} entitlement(s)`)
          : logger.error("[fulfillOrder]", r.error))
        .catch((e) => logger.error("[fulfillOrder] unexpected:", e.message))

      recordOrderEvent({
        orderId:     order.id,
        userId:      order.userId,
        action:      "order.paid",
        description: `Payment approved via Mercado Pago (tx ${paymentId})`,
      }).catch(() => null)
    }

    // 6. Cancellation / rejection bookkeeping.
    if (mpPayment.status === "cancelled" || mpPayment.status === "rejected") {
      recordOrderEvent({
        orderId:     order.id,
        userId:      order.userId,
        action:      mpPayment.status === "cancelled" ? "order.cancelled" : "order.payment_rejected",
        description: `Payment ${mpPayment.status} via Mercado Pago`,
      }).catch(() => null)
    }

    // 7. Mark webhook as processed.
    if (auditRow?.id) {
      await prisma.paymentWebhook.update({
        where: { id: auditRow.id },
        data:  { processed: true, processedAt: new Date() },
      }).catch(() => null)
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    logger.error("[MP webhook] unhandled:", err.message, err.stack?.split("\n")[1])
    return res.status(200).json({ received: true })
  }
}

/* ───────────────── GET /api/mercadopago/status/:orderId ────────────────── */

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

/* ────────────── POST /api/mercadopago/refund (admin) ───────────────────── */
//
// LEGACY shim · M19 — delegates to the unified refund orchestrator
// (services/refundService.processOrderRefund) so Option A policy enforcement,
// download access revocation, AdminAuditLog rows, and the customer-facing
// email + notification all fire consistently.
//
// Body: { paymentId (gateway tx id), amount?, reason?, force? }
// Response: { success: true, data: <refund row from orchestrator> }

const issueRefund = asyncHandler(async (req, res) => {
  const { paymentId, amount, reason, force } = req.body || {}
  if (!paymentId) return res.status(400).json({ success: false, message: "paymentId is required" })

  const localPayment = await prisma.payment.findFirst({
    where:  { paymentGateway: "mercadopago", gatewayTransactionId: String(paymentId) },
    select: { id: true, orderId: true },
  })
  if (!localPayment) {
    return res.status(404).json({
      success: false,
      code:    "NOT_FOUND",
      message: `No local payment found for Mercado Pago paymentId ${paymentId}`,
    })
  }

  try {
    const result = await processOrderRefund({
      orderId:     localPayment.orderId,
      amount:      amount === "" || amount == null ? null : Number(amount),
      reason:      reason ? String(reason).slice(0, 1000) : null,
      force:       Boolean(force),
      adminUserId: req.user.id,
      ipAddress:   req.ip,
    })
    return res.status(200).json({ success: true, data: result.refund })
  } catch (err) {
    logger.error(`[MP legacy refund] order=${localPayment.orderId} admin=${req.user?.id}: ${err.message}`)
    return res.status(err.status || 500).json({
      success: false,
      code:    err.code || "REFUND_ERROR",
      message: err.message || "Refund failed",
      ...(err.details ? { details: err.details } : {}),
    })
  }
})

/* ─────────────────────────── helper ────────────────────────────────────── */

function formatMoney(amount, currency = "MXN") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(amount))
  } catch {
    return `$${Number(amount).toFixed(2)} ${currency}`
  }
}

module.exports = { createPreference, webhook, getPaymentStatus, issueRefund }
