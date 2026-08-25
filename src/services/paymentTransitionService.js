/**
 * paymentTransitionService · gateway-agnostic Order + Payment transition.
 *
 * Shared core behind paypalController.transitionOrderToPaid and
 * mercadoPagoService.markOrderPaidByMP. Guarantees (money-critical):
 *
 *   1. Amount validation on every transition to `paid` — a missing / non-
 *      finite gateway amount, > 1 cent drift, or a currency mismatch is a
 *      fail-closed reject: returns `amountMismatch`, never flips the order.
 *   2. Terminal-state guard — once an order is paid / completed / refunded /
 *      cancelled, a late or out-of-order webhook never rewrites it. The
 *      Payment row is still recorded. `refunded` is never applied to the
 *      Order here either (refund bookkeeping is owned by refundService).
 *   3. Idempotent Payment upsert keyed on [paymentGateway, gatewayTransactionId].
 *   4. Optional `onFirstPaid(order)` hook fired AFTER the transaction commits,
 *      only on the first transition to paid (entitlement fulfilment).
 */

const prisma   = require("../lib/prisma")
const AppError = require("../utils/AppError")

const TERMINAL_ORDER_STATES = new Set(["paid", "completed", "refunded", "cancelled"])
const AMOUNT_TOLERANCE      = 0.01

const PAYMENT_STATUS_FOR = {
  paid:     "paid",
  pending:  "pending",
  refunded: "refunded",
  failed:   "failed",
}

function ccy(value, fallback = "MXN") {
  return String(value || fallback).toUpperCase()
}

/**
 * Validate the gateway-reported amount/currency against the local order.
 * Returns null when they match, otherwise an `amountMismatch` descriptor.
 */
function checkAmount(current, gatewayAmount, gatewayCurrency) {
  const reported = Number(gatewayAmount)
  const expected = Number(current.totalAmount)
  const expectedCcy = ccy(current.currency)

  if (gatewayAmount == null || !Number.isFinite(reported)) {
    return {
      reported:    gatewayAmount ?? null,
      expected,
      drift:       null,
      reportedCcy: String(gatewayCurrency || "").toUpperCase() || null,
      expectedCcy,
      reason:      "missing_or_invalid_amount",
    }
  }

  const drift       = Math.abs(reported - expected)
  const reportedCcy = ccy(gatewayCurrency || current.currency)
  if (drift > AMOUNT_TOLERANCE || reportedCcy !== expectedCcy) {
    return { reported, expected, drift, reportedCcy, expectedCcy }
  }
  return null
}

/**
 * @param {object} args
 * @param {string} args.orderId
 * @param {string} args.gatewayTransactionId
 * @param {"paypal"|"mercadopago"|string} args.paymentGateway
 * @param {"paid"|"pending"|"refunded"|"failed"} [args.targetStatus="paid"]
 * @param {*}      [args.payload]          raw gateway payload, echoed back
 * @param {*}      [args.gatewayAmount]
 * @param {string} [args.gatewayCurrency]
 * @param {string} [args.failureReason]    stored on the Payment when failed
 * @param {(order) => any} [args.onFirstPaid]
 */
async function transitionOrderPayment({
  orderId,
  gatewayTransactionId,
  paymentGateway,
  targetStatus = "paid",
  payload = null,
  gatewayAmount,
  gatewayCurrency,
  failureReason = null,
  onFirstPaid,
}) {
  if (!PAYMENT_STATUS_FOR[targetStatus]) {
    throw AppError.badRequest(`Unsupported payment transition target: ${targetStatus}`, "INVALID_TRANSITION")
  }
  const txId = String(gatewayTransactionId)

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findFirst({
      where:  { gatewayTransactionId: txId, paymentGateway },
      select: { id: true, paymentStatus: true, orderId: true },
    })

    const current = await tx.order.findUnique({
      where:  { id: orderId },
      select: { id: true, status: true, totalAmount: true, currency: true, userId: true },
    })
    if (!current) throw AppError.notFound("Order not found", "ORDER_NOT_FOUND")

    if (targetStatus === "paid") {
      const amountMismatch = checkAmount(current, gatewayAmount, gatewayCurrency)
      if (amountMismatch) {
        return { order: current, isFirstTransition: false, payload, amountMismatch }
      }
    }

    const skipOrderWrite = TERMINAL_ORDER_STATES.has(current.status) || targetStatus === "refunded"
    const order = skipOrderWrite
      ? (await tx.order.findUnique({ where: { id: orderId }, include: { items: true } })) || current
      : await tx.order.update({
          where: { id: orderId },
          data:  {
            status: targetStatus,
            paidAt: targetStatus === "paid" ? new Date() : null,
          },
          include: { items: true },
        })

    const paymentData = {
      paymentGateway,
      gatewayTransactionId: txId,
      gatewaySessionId:     txId,
      amount:               order.totalAmount,
      currency:             ccy(order.currency),
      paymentStatus:        PAYMENT_STATUS_FOR[targetStatus],
      paidAt:               targetStatus === "paid" ? new Date() : null,
      failureReason:        targetStatus === "failed" ? (failureReason || null) : null,
    }

    if (existing) {
      await tx.payment.update({ where: { id: existing.id }, data: paymentData })
    } else {
      await tx.payment.create({ data: { ...paymentData, orderId, userId: order.userId } })
    }

    return { order, isFirstTransition: !existing, payload, amountMismatch: null }
  })

  if (
    typeof onFirstPaid === "function" &&
    result.isFirstTransition &&
    !result.amountMismatch &&
    targetStatus === "paid"
  ) {
    await onFirstPaid(result.order)
  }

  return result
}

module.exports = { transitionOrderPayment, checkAmount, TERMINAL_ORDER_STATES }
