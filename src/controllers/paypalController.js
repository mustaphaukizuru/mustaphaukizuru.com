const asyncHandler = require("../utils/asyncHandler")
const logger       = require("../utils/logger")
const prisma       = require("../lib/prisma")

const {
  createPaypalOrder,
  capturePaypalOrder,
  verifyPaypalWebhookSignature,
  // refundPaypalCapture is no longer called from this controller — the
  // legacy /api/paypal/refund endpoint now delegates to refundService,
  // which calls the provider helper directly. Left out of the import to
  // satisfy ESLint no-unused-vars.
} = require("../services/paypalService")

const { sendTemplateEmail } = require("../services/emailService")
const { resolveUserLocale } = require("../utils/resolveUserLocale")
const { notifyOrderPaid }   = require("../services/notificationService")
const { fulfillOrder, recordOrderEvent } = require("../services/orderFulfillmentService")
const { generateReceiptPdf } = require("../services/receiptPdfService")
// M15+M19 — refund orchestrator (Option A enforcement, audit logging,
// download revocation, email/notification side effects).
const { processOrderRefund } = require("../services/refundService")

/**
 * PayPal controller · V2
 *
 * Endpoints:
 *   POST /api/paypal/create-order/:orderId   — create PayPal Order (auth)
 *   POST /api/paypal/capture/:paypalOrderId  — capture after approval (auth)
 *   POST /api/paypal/webhook                  — async webhook (raw body)
 *   POST /api/paypal/refund                    — admin refund
 *
 * The webhook route MUST be mounted BEFORE express.json() so the body is a
 * Buffer for signature verification. See routes/paypalRoutes.js V2.
 */

/* ────────────────── POST /api/paypal/create-order/:orderId ─────────────── */

const createOrder = asyncHandler(async (req, res) => {
  const orderId = req.params.orderId || req.body?.orderId
  if (!orderId) return res.status(400).json({ success: false, message: "orderId is required" })

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, totalAmount: true, currency: true, userId: true, status: true },
  })
  if (!order) return res.status(404).json({ success: false, message: "Order not found" })

  // Block creating a PayPal order for an order that's already paid.
  if (order.status === "paid" || order.status === "completed") {
    return res.status(409).json({ success: false, message: "Order is already paid" })
  }

  const frontend = (process.env.FRONTEND_URL || "").replace(/\/$/, "") || "http://localhost:5173"
  const returnUrl = `${frontend}/checkout/success/${order.id}?gateway=paypal`
  const cancelUrl = `${frontend}/checkout?error=pp_cancelled&orderId=${order.id}`

  const paypalOrder = await createPaypalOrder({
    orderId:     order.id,
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount,
    currency:    order.currency,
    returnUrl,
    cancelUrl,
  })

  return res.status(200).json({
    success: true,
    data: {
      paypalOrderId: paypalOrder.id,
      status:        paypalOrder.status,
      links:         paypalOrder.links,
    },
  })
})

/* ─────────────── POST /api/paypal/capture/:paypalOrderId ───────────────── */

const captureOrder = asyncHandler(async (req, res) => {
  const { paypalOrderId } = req.params
  if (!paypalOrderId) return res.status(400).json({ success: false, message: "paypalOrderId is required" })

  const captureResult = await capturePaypalOrder(paypalOrderId)

  // Map PayPal payload to our internal Order.
  const purchase    = captureResult?.purchase_units?.[0]
  const orderId     = purchase?.reference_id || purchase?.custom_id
  const captureUnit = purchase?.payments?.captures?.[0]
  const captureId   = captureUnit?.id

  if (!orderId || !captureId) {
    return res.status(422).json({ success: false, message: "PayPal capture missing reference_id or captureId" })
  }

  // Hardening · validate the captured amount matches our local total
  // before flipping the order to paid. Drift > 1 cent is treated as a
  // verification failure (422) rather than silently accepting a smaller
  // capture. PayPal returns the captured amount in the first capture unit.
  const result = await transitionOrderToPaid({
    orderId,
    gatewayTransactionId: captureId,
    paymentGateway:       "paypal",
    payload:              captureResult,
    gatewayAmount:        captureUnit?.amount?.value,
    gatewayCurrency:      captureUnit?.amount?.currency_code,
  })

  if (result.amountMismatch) {
    logger.error(`[PayPal capture] amount mismatch order=${orderId}: ${JSON.stringify(result.amountMismatch)}`)
    return res.status(422).json({
      success: false,
      code:    "AMOUNT_MISMATCH",
      message: "PayPal capture amount does not match the order total",
      details: result.amountMismatch,
    })
  }

  // Side-effects only on first transition. Pass the request scope so
  // `fireSideEffects` can resolve the user's locale for the email template.
  if (result.isFirstTransition) {
    fireSideEffects(result.order, captureId, "PayPal", { req }).catch((e) => logger.error("[PayPal sideEffects]", e.message))
  }

  return res.status(200).json({
    success: true,
    data: {
      status:        captureResult.status,
      orderId,
      captureId,
      idempotent:    !!captureResult._idempotent,
    },
  })
})

/* ─────────────────────── POST /api/paypal/webhook ──────────────────────── */

const webhook = async (req, res) => {
  try {
    // The route mounts express.raw — req.body is a Buffer here.
    const verified = await verifyPaypalWebhookSignature({ headers: req.headers, body: req.body })

    // Audit row goes in regardless of verification result so we can debug.
    const event = (() => {
      try { return JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString("utf8") : req.body) }
      catch { return {} }
    })()

    // Audit row goes in regardless of verification result so we can debug.
    // Duplicate deliveries (same event.id) are dropped at the unique-index
    // level so PayPal retries don't spam the audit log.
    let auditRow = null
    try {
      auditRow = await prisma.paymentWebhook.create({
        data: {
          paymentGateway: "paypal",
          gatewayEventId: event?.id || null, // PayPal event id is the dedup key
          eventType:      event?.event_type || "unknown",
          payloadJson:    event,
          processed:      false,
        },
      })
    } catch (e) {
      if (e?.code === "P2002") {
        logger.info("[PayPal webhook] duplicate delivery, dropping", { eventId: event?.id })
        return res.status(200).json({ received: true, duplicate: true })
      }
      logger.warn("[PayPal webhook] audit insert failed:", e.message)
    }

    if (!verified) {
      logger.warn("[PayPal webhook] signature failed", { eventType: event?.event_type })
      return res.status(401).json({ received: true, error: "signature" })
    }

    // Handle the events that matter for our flow.
    const eventType = event?.event_type
    const resource  = event?.resource || {}

    if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
      const captureId = resource.id
      const orderId =
        resource?.custom_id ||
        resource?.invoice_id ||
        resource?.supplementary_data?.related_ids?.order_id ||
        null

      if (orderId && captureId) {
        const result = await transitionOrderToPaid({
          orderId,
          gatewayTransactionId: captureId,
          paymentGateway:       "paypal",
          payload:              event,
          gatewayAmount:        resource?.amount?.value,
          gatewayCurrency:      resource?.amount?.currency_code,
        })
        if (result.amountMismatch) {
          logger.error(`[PayPal webhook] amount mismatch order=${orderId}: ${JSON.stringify(result.amountMismatch)}`)
          // Don't fire side-effects — the order is NOT marked paid in this case.
        } else if (result.isFirstTransition) {
          // Webhook has no req scope — fireSideEffects falls back to the
          // user's profile locale via resolveUserLocale's default branch.
          fireSideEffects(result.order, captureId, "PayPal", { req: null }).catch((e) => logger.error("[PayPal sideEffects]", e.message))
        }
      }
    }

    if (eventType === "PAYMENT.CAPTURE.DENIED" || eventType === "PAYMENT.CAPTURE.REFUNDED") {
      const captureId = resource.id
      const payment = await prisma.payment.findFirst({
        where: { gatewayTransactionId: captureId, paymentGateway: "paypal" },
        select: { id: true, orderId: true, userId: true },
      })
      if (payment) {
        // For refund events, also persist a local Refund row so
        // out-of-band PayPal-dashboard refunds are reflected in our
        // order history. Idempotent on (orderId, gatewayTransactionId).
        if (eventType === "PAYMENT.CAPTURE.REFUNDED") {
          const refundAmount = Number(resource?.amount?.value || 0)
          const refundId     = resource?.id
          if (refundAmount > 0 && refundId) {
            await prisma.refund.upsert({
              where: {
                // No native unique on (paymentId, gatewayRefundId), so we
                // emulate via findFirst → create-if-missing pattern.
                id: refundId, // safe: refund.id is cuid by default but we override on upsert
              },
              create: {
                id:           refundId,
                paymentId:    payment.id,
                orderId:      payment.orderId,
                amount:       refundAmount,
                reason:       "PayPal webhook refund",
                refundStatus: "completed",
                processedAt:  new Date(),
              },
              update: {
                refundStatus: "completed",
                processedAt:  new Date(),
              },
            }).catch((e) => logger.warn("[PayPal webhook refund upsert]", e.message))
          }
        }
        await recordOrderEvent({
          orderId:     payment.orderId,
          userId:      payment.userId,
          action:      eventType === "PAYMENT.CAPTURE.REFUNDED" ? "order.refunded" : "order.payment_rejected",
          description: `PayPal ${eventType.replace("PAYMENT.CAPTURE.", "").toLowerCase()} (${captureId})`,
        })
      }
    }

    if (auditRow?.id) {
      await prisma.paymentWebhook.update({
        where: { id: auditRow.id }, data: { processed: true, processedAt: new Date() },
      }).catch(() => null)
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    logger.error("[PayPal webhook] unhandled:", err.message)
    return res.status(200).json({ received: true })
  }
}

/* ───────────────────── POST /api/paypal/refund (admin) ─────────────────── */
//
// LEGACY shim · M19 — delegates to the unified refund orchestrator
// (services/refundService.processOrderRefund) so Option A policy enforcement,
// download access revocation, AdminAuditLog rows, and the customer-facing
// email + notification all fire consistently — same as /admin/orders/:id/refund.
//
// Backwards-compat surface kept intact:
//   Body: { captureId, amount?, currency? (ignored — orchestrator derives), note?, force? }
//   Response: { success: true, data: <refund row from orchestrator> }
//
// Behavioural change worth noting:
//   - Previously this endpoint could refund a downloaded order silently.
//   - Now Option A applies: callers must pass `force: true` to override.
//   - Legacy clients that need the old "no-questions-asked" behaviour MUST
//     update to set `force: true` explicitly. This is the desired outcome.

const issueRefund = asyncHandler(async (req, res) => {
  const { captureId, amount, note, force } = req.body || {}
  if (!captureId) return res.status(400).json({ success: false, message: "captureId is required" })

  // Resolve the captureId to a local Payment + Order so the orchestrator
  // has the orderId it needs.
  const localPayment = await prisma.payment.findFirst({
    where:  { paymentGateway: "paypal", gatewayTransactionId: String(captureId) },
    select: { id: true, orderId: true },
  })
  if (!localPayment) {
    return res.status(404).json({
      success: false,
      code:    "NOT_FOUND",
      message: `No local payment found for PayPal captureId ${captureId}`,
    })
  }

  try {
    const result = await processOrderRefund({
      orderId:     localPayment.orderId,
      amount:      amount === "" || amount == null ? null : Number(amount),
      reason:      note ? String(note).slice(0, 1000) : null,
      force:       Boolean(force),
      adminUserId: req.user.id,
      ipAddress:   req.ip,
    })
    return res.status(200).json({ success: true, data: result.refund })
  } catch (err) {
    logger.error(`[PayPal legacy refund] order=${localPayment.orderId} admin=${req.user?.id}: ${err.message}`)
    return res.status(err.status || 500).json({
      success: false,
      code:    err.code || "REFUND_ERROR",
      message: err.message || "Refund failed",
      ...(err.details ? { details: err.details } : {}),
    })
  }
})

/* ─────────────────────── shared helpers ────────────────────────────────── */


/**
 * Atomic Order + Payment transition. Idempotent on gatewayTransactionId.
 */
async function transitionOrderToPaid({ orderId, gatewayTransactionId, paymentGateway, payload, gatewayAmount, gatewayCurrency }) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findFirst({
      where: { gatewayTransactionId: String(gatewayTransactionId), paymentGateway },
      select: { id: true, paymentStatus: true },
    })

    // Pre-flight read so we can validate amount + guard against state
    // regression without holding a write lock on the row first.
    const current = await tx.order.findUnique({
      where:  { id: orderId },
      select: { id: true, status: true, totalAmount: true, currency: true },
    })
    if (!current) throw Object.assign(new Error("Order not found"), { code: "ORDER_NOT_FOUND" })

    // Amount validation · REQUIRE a finite numeric amount on every paid
    // transition. A missing/non-finite value is a fail-closed reject so a
    // malformed webhook can never silently flip an order to paid.
    const reported = Number(gatewayAmount)
    const expected = Number(current.totalAmount)
    if (gatewayAmount == null || !Number.isFinite(reported)) {
      return {
        order: current,
        isFirstTransition: false,
        payload,
        amountMismatch: {
          reported: gatewayAmount ?? null,
          expected,
          drift: null,
          reportedCcy: String(gatewayCurrency || "").toUpperCase() || null,
          expectedCcy: String(current.currency || "MXN").toUpperCase(),
          reason: "missing_or_invalid_amount",
        },
      }
    }
    const drift       = Math.abs(reported - expected)
    const reportedCcy = String(gatewayCurrency || current.currency || "MXN").toUpperCase()
    const expectedCcy = String(current.currency || "MXN").toUpperCase()
    if (drift > 0.01 || reportedCcy !== expectedCcy) {
      return {
        order: current,
        isFirstTransition: false,
        payload,
        amountMismatch: { reported, expected, drift, reportedCcy, expectedCcy },
      }
    }

    // State-regression guard · if the order is already in a paid/completed
    // state, an out-of-order webhook arriving with the same captureId is a
    // no-op (returns existing data). Refuse to overwrite paidAt or regress.
    const isAlreadyPaid = current.status === "paid" || current.status === "completed"
    const order = isAlreadyPaid
      ? await tx.order.findUnique({ where: { id: orderId }, include: { items: true } })
      : await tx.order.update({
          where: { id: orderId },
          data:  { status: "paid", paidAt: new Date() },
          include: { items: true },
        })

    const data = {
      paymentGateway,
      gatewayTransactionId: String(gatewayTransactionId),
      gatewaySessionId:     String(gatewayTransactionId),
      amount:               order.totalAmount,
      currency:             (order.currency || "MXN").toUpperCase(),
      paymentStatus:        "paid",
      paidAt:               new Date(),
    }

    if (existing) {
      await tx.payment.update({ where: { id: existing.id }, data })
    } else {
      await tx.payment.create({ data: { ...data, orderId, userId: order.userId } })
    }

    return { order, isFirstTransition: !existing, payload, amountMismatch: null }
  })
}

async function fireSideEffects(order, gatewayTxId, gatewayLabel, opts = {}) {
  // Locale resolution: prefer the request scope when interactive (capture
  // endpoint), fall back to the user's stored profile locale via
  // resolveUserLocale's default branch when called from a webhook.
  // BUG FIX · the previous version referenced an undefined `req` here, which
  // silently broke order.confirmed emails for every PayPal capture.
  let locale = "en"
  try {
    locale = resolveUserLocale(opts.req ? { req: opts.req } : { user: { id: order.userId } })
  } catch { /* fall through to "en" */ }

  // PDF receipt — attached to the order.confirmed email. Generated in-memory
  // so we never touch disk. If generation fails the email still sends; we
  // log and continue rather than block the confirmation.
  let attachments
  try {
    const receiptBuffer = await generateReceiptPdf(order.id, { inMemory: true })
    attachments = [{
      filename:    `receipt-${order.orderNumber || order.id}.pdf`,
      content:     receiptBuffer,
      contentType: "application/pdf",
    }]
  } catch (e) {
    logger.warn(`[fireSideEffects] receipt PDF skipped: ${e.message}`)
  }

  try {
    await sendTemplateEmail({
      locale,
      to:          order.customerEmail || order.billingEmail,
      templateKey: "order.confirmed",
      userId:      order.userId,
      attachments,
      variables: {
        customerName: order.customerName?.split(" ")[0] || "there",
        orderNumber:  order.orderNumber,
        orderTotal:   formatMoney(order.totalAmount, order.currency),
        orderUrl:     `${(process.env.FRONTEND_URL || "").replace(/\/$/, "")}/dashboard/orders/${order.id}`,
        gateway:      gatewayLabel,
      },
    })
  } catch (e) { logger.error("[fireSideEffects] email:", e.message) }

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
    description: `Payment captured via ${gatewayLabel} (tx ${gatewayTxId})`,
  }).catch(() => null)
}

function formatMoney(amount, currency = "MXN") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(amount))
  } catch {
    return `$${Number(amount).toFixed(2)} ${currency}`
  }
}

module.exports = {
  createOrder,
  captureOrder,
  webhook,
  issueRefund,
  // Exported for Jest — the amount-validation + idempotency + state-regression
  // guarantees of this function are money-critical, and unit-testing them at
  // the controller level via supertest would require mocking the whole HTTP
  // boundary. The contract is documented above the function definition.
  transitionOrderToPaid,
}
