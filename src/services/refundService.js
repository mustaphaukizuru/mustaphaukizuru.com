// @ts-check
// ─────────────────────────────────────────────────────────────────────────────
// Refund Orchestrator · M15
//
// Single source of truth for refunds across MercadoPago + PayPal. Every refund
// action that can be initiated by an admin (or, in future, a member-approved
// flow) MUST go through processOrderRefund() in this file.
//
// Why this exists, given that paypalController.issueRefund and
// mercadoPagoController.issueRefund already each persist a Refund row:
//
//   1. The legacy provider-specific endpoints expect the gateway transaction
//      id (capture id / payment id) — admins working from the order page
//      shouldn't have to know the difference.
//   2. They DO NOT revoke UserDownload entitlements on full refund — meaning
//      a customer can buy → download → refund → keep accessing files. This
//      service closes that hole.
//   3. They DO NOT enforce the Option A policy (no refund after download).
//   4. They DO NOT write AdminAuditLog rows — only ActivityLog.
//   5. They DO NOT fire the customer-facing refund email + notification.
//
// The legacy endpoints remain for backwards compatibility but new admin tooling
// goes through this service exclusively.
//
// Eligibility (Option A · refund policy):
//   - Order must be in `paid` status
//   - Refund window: 14 days from order.paidAt
//   - Per-OrderItem: ineligible if any UserDownload entitlement on that item
//     has downloadCount > 0 OR lastDownloadedAt is set
//   - Admin can OVERRIDE per-item ineligibility by passing { force: true }
//     — captured in the audit row so abuse is traceable
//
// Concurrency model:
//   - Provider call happens BEFORE the DB transaction (we can't roll back a
//     gateway-side refund — pretending we can would be a worse failure mode)
//   - DB writes (Refund row + Payment + Order + UserDownload + AdminAuditLog)
//     are wrapped in a single Prisma $transaction so partial state is
//     impossible
//   - Idempotency anchor is the gateway response id stored on the Refund row
//     in the future (Refund schema doesn't have that column today; we still
//     guard against double-refunds by checking sum-of-prior-refunds before
//     hitting the gateway).
// ─────────────────────────────────────────────────────────────────────────────

const prisma = require("../lib/prisma")
const logger = require("../utils/logger")

const { refundPaypalCapture }      = require("./paypalService")
const { refundMercadoPagoPayment } = require("./mercadoPagoService")
const { recordOrderEvent }         = require("./orderFulfillmentService")
const { sendOrderRefundedEmail }   = require("../utils/mailer")
const { notifyOrderRefunded }      = require("./notificationService")

/* ─────────────────────────────── constants ─────────────────────────────── */

// Option A refund window — start of business decision, not a hard MP/PayPal
// constraint. PayPal still allows refunds up to 180 days; MercadoPago up to
// 365 days. Our policy is stricter so we set our own gate.
const REFUND_WINDOW_DAYS = 14

// Mirrors the Prisma `RefundStatus` enum (prisma/schema.prisma). Keep these
// two in sync — any divergence causes silent write failures (Prisma rejects
// unknown enum values with P2024).
//
// The earlier "requested" sentinel lived in this list but was never persisted
// to Refund.refundStatus — a member's refund request is tracked on a
// SupportTicket row, not by a phantom Refund row. Including it here used to
// suggest the value was writable, so it's been removed to avoid that trap.
const VALID_REFUND_STATUSES = [
  "pending",     // intent recorded, gateway call not started
  "approved",    // admin clicked refund, Refund row created (legacy code path)
  "processing",  // gateway call in flight (this service)
  "succeeded",   // gateway accepted, local state flipped
  "failed",      // gateway rejected, no local state change
]

/* ─────────────────────── small numeric helper ──────────────────────────── */

function toNumber(value) {
  if (value == null) return 0
  if (typeof value === "number") return value
  if (typeof value.toNumber === "function") return value.toNumber()
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function round2(n) {
  // Decimal(12,2) — keep math in cents-like precision, never trust raw FP.
  return Math.round(Number(n) * 100) / 100
}

/* ─────────────────────── public — eligibility check ────────────────────── */

/**
 * checkRefundEligibility — never mutates state. Safe to expose as a GET.
 *
 * Returns the same shape consumed by the AdminOrderDetail refund modal:
 *
 *   {
 *     eligible:                 boolean   // overall verdict (any item refundable)
 *     orderId, orderNumber, status, currency, totalAmount,
 *     paidAt, paidWindowExpiresAt, withinWindow,
 *     alreadyRefunded:          number    // sum of prior succeeded/approved refund amounts
 *     refundableAmount:         number    // totalAmount - alreadyRefunded
 *     reason:                   string|null  // why the order itself is ineligible (if any)
 *     payments: [{ id, gateway, gatewayTransactionId, amount, status }]
 *     items: [{
 *       orderItemId, productId, title, quantity, lineTotal, itemType,
 *       eligible: boolean,
 *       downloadCount, lastDownloadedAt,
 *       reason: string|null
 *     }]
 *   }
 *
 * @param {string} orderId
 */
async function checkRefundEligibility(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items:    true,
      payments: { orderBy: { createdAt: "desc" } },
      refunds:  true,
      // Pull entitlements so we can correlate by orderItemId to mark each
      // line as downloaded / not-downloaded.
      userDownloads: true,
    },
  })

  if (!order) {
    const e = new Error("Order not found")
    e.code = "NOT_FOUND"
    throw e
  }

  // Pre-compute global gates first; per-item checks layered on top.
  const totalAmount     = round2(toNumber(order.totalAmount))
  const alreadyRefunded = round2(
    (order.refunds || [])
      // Only count refund rows that represent real money movement.
      .filter((r) => ["approved", "processing", "succeeded"].includes(r.refundStatus))
      .reduce((sum, r) => sum + toNumber(r.amount), 0)
  )
  const refundableAmount = round2(Math.max(0, totalAmount - alreadyRefunded))

  // Refund window — 14 days from paidAt. If paidAt is null but order is paid
  // (legacy data), fall back to createdAt.
  const paidAtMs   = order.paidAt ? new Date(order.paidAt).getTime() : null
  const anchorMs   = paidAtMs || new Date(order.createdAt).getTime()
  const windowEnds = new Date(anchorMs + REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const withinWindow = Date.now() <= windowEnds.getTime()

  let orderReason = null
  if (order.status !== "paid")            orderReason = `Order is in '${order.status}' state — only paid orders can be refunded`
  else if (refundableAmount <= 0)         orderReason = "Order has already been fully refunded"
  // We don't auto-fail on out-of-window — admin can still override. Surface
  // the fact and let the UI render a warning.

  // Index entitlements by orderItemId so the per-item loop is O(1) lookups.
  const downloadsByItemId = new Map()
  for (const ud of order.userDownloads || []) {
    downloadsByItemId.set(ud.orderItemId, ud)
  }

  const items = (order.items || []).map((item) => {
    const ud = downloadsByItemId.get(item.id)
    const downloadCount    = ud?.downloadCount    || 0
    const lastDownloadedAt = ud?.lastDownloadedAt  || null

    // Per-item eligibility: only product-type items with no downloads.
    // Service items don't have UserDownload entitlements, so we leave them
    // eligible (admin discretion still required).
    let eligible = true
    let reason   = null

    if (item.itemType === "product") {
      if (downloadCount > 0 || lastDownloadedAt) {
        eligible = false
        reason   = `Already downloaded${downloadCount ? ` (${downloadCount} time${downloadCount === 1 ? "" : "s"})` : ""}`
      }
    }

    return {
      orderItemId:      item.id,
      productId:        item.productId,
      serviceId:        item.serviceId,
      itemType:         item.itemType,
      title:            item.title || item.titleSnapshot || "Item",
      quantity:         item.quantity,
      lineTotal:        round2(toNumber(item.lineTotal || item.unitPrice || item.price || 0)),
      eligible,
      downloadCount,
      lastDownloadedAt,
      reason,
    }
  })

  // Order-level eligibility = no order-level blockers AND at least one item
  // is auto-eligible. Admins can still force a refund on a fully-downloaded
  // order — but the default UI affordance is disabled.
  const anyItemEligible = items.some((i) => i.eligible)
  const eligible = !orderReason && anyItemEligible

  return {
    eligible,
    orderId:             order.id,
    orderNumber:         order.orderNumber,
    status:              order.status,
    currency:            order.currency,
    totalAmount,
    paidAt:              order.paidAt,
    paidWindowExpiresAt: windowEnds,
    withinWindow,
    refundWindowDays:    REFUND_WINDOW_DAYS,
    alreadyRefunded,
    refundableAmount,
    reason:              orderReason,
    payments: (order.payments || []).map((p) => ({
      id:                   p.id,
      gateway:              p.paymentGateway,
      gatewayTransactionId: p.gatewayTransactionId,
      amount:               round2(toNumber(p.amount)),
      status:               p.paymentStatus,
      paidAt:               p.paidAt,
    })),
    items,
  }
}

/* ─────────────────────── public — issue a refund ───────────────────────── */

/**
 * processOrderRefund — canonical refund entry point.
 *
 * Does the following, atomically (provider call first, then DB transaction):
 *   1. Validate the order exists and is in 'paid' state
 *   2. Enforce eligibility — Option A policy. `force: true` bypasses the
 *      per-item download gate but is recorded in the audit row.
 *   3. Pick the latest paid Payment row, derive the gateway + transaction id
 *   4. Call the correct provider (PayPal / MercadoPago)
 *   5. In a single Prisma $transaction:
 *        - Create Refund row (status: succeeded)
 *        - Update Payment row (paymentStatus: refunded)
 *        - Update Order row (status: refunded)
 *        - Revoke ALL UserDownload entitlements for the order
 *        - Insert AdminAuditLog row
 *
 * Refunds are FULL only. The full remaining paid amount is always refunded;
 * `amount` / `orderItemIds` are rejected with INVALID_AMOUNT so a caller
 * can never issue a partial refund by accident.
 *   6. Best-effort post-commit side effects: email, in-app notification,
 *      ActivityLog entry. These never throw.
 *
 * @param {object}   input
 * @param {string}   input.orderId
 * @param {string}  [input.reason]            audit + email body
 * @param {boolean} [input.force=false]       override Option A per-item gate
 * @param {string}   input.adminUserId        for AdminAuditLog
 * @param {string}  [input.ipAddress]
 *
 * @returns {Promise<{
 *   refund:        object,
 *   isFull:        true,
 *   orderStatus:   string,
 *   providerRaw:   object
 * }>}
 *
 * @throws {Error} with .code one of:
 *   NOT_FOUND, INVALID_STATE, ALREADY_REFUNDED, INELIGIBLE_DOWNLOADED,
 *   NO_PAYMENT, GATEWAY_ERROR, INVALID_AMOUNT
 */
async function processOrderRefund({
  orderId,
  amount,
  orderItemIds,
  reason = null,
  force = false,
  adminUserId,
  ipAddress = null,
} = {}) {
  if (!orderId)     throw withCode("orderId is required", "VALIDATION", 400)
  if (!adminUserId) throw withCode("adminUserId is required", "VALIDATION", 400)
  // Partial refunds are not supported — reject explicit amounts / item subsets
  // before touching the DB so the failure is obvious to the caller.
  if (amount != null || (Array.isArray(orderItemIds) && orderItemIds.length > 0)) {
    throw withCode("Partial refunds are not supported — a refund always covers the full remaining amount", "INVALID_AMOUNT", 400)
  }

  // 1 · Load order + payments + refunds + downloads.
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items:         true,
      payments:      { orderBy: { createdAt: "desc" } },
      refunds:       true,
      userDownloads: true,
      user:          { select: { id: true, fullName: true, email: true } },
    },
  })
  if (!order) throw withCode("Order not found", "NOT_FOUND", 404)

  // 2 · Order-level guards.
  if (order.status !== "paid") {
    throw withCode(`Order is in '${order.status}' state — only paid orders can be refunded`, "INVALID_STATE", 409)
  }

  const totalAmount     = round2(toNumber(order.totalAmount))
  const alreadyRefunded = round2(
    (order.refunds || [])
      .filter((r) => ["approved", "processing", "succeeded"].includes(r.refundStatus))
      .reduce((sum, r) => sum + toNumber(r.amount), 0)
  )
  const refundableAmount = round2(Math.max(0, totalAmount - alreadyRefunded))
  if (refundableAmount <= 0) {
    throw withCode("Order has already been fully refunded", "ALREADY_REFUNDED", 409)
  }

  // 3 · Refund amount is always the full remaining paid balance.
  const requestedAmount = refundableAmount
  const isFull = true

  // 4 · Option A enforcement — block refund of any item that's been downloaded
  //     unless `force: true` is passed. Every product item is in scope.
  const targetItemIds = new Set((order.items || []).filter((i) => i.itemType === "product").map((i) => i.id))

  const downloadsByItemId = new Map()
  for (const ud of order.userDownloads || []) downloadsByItemId.set(ud.orderItemId, ud)

  const blockedItems = []
  for (const item of order.items || []) {
    if (item.itemType !== "product") continue
    if (!targetItemIds.has(item.id)) continue
    const ud = downloadsByItemId.get(item.id)
    if ((ud?.downloadCount || 0) > 0 || ud?.lastDownloadedAt) {
      blockedItems.push({
        orderItemId:      item.id,
        title:            item.title || item.titleSnapshot,
        downloadCount:    ud?.downloadCount || 0,
        lastDownloadedAt: ud?.lastDownloadedAt,
      })
    }
  }
  if (blockedItems.length > 0 && !force) {
    const titles = blockedItems.map((b) => `"${b.title}"`).join(", ")
    const err = withCode(
      `Items already downloaded: ${titles}. Use the override to refund anyway.`,
      "INELIGIBLE_DOWNLOADED",
      409,
    )
    err.details = { blockedItems }
    throw err
  }

  // 5 · Pick the Payment row to refund against. Use the most recent paid
  //     Payment for the order. In practice an order has one paid payment;
  //     edge case (a previous refund + re-pay) we still target the latest.
  const targetPayment = (order.payments || []).find((p) => p.paymentStatus === "paid")
    || (order.payments || [])[0]
  if (!targetPayment) {
    throw withCode("No payment record found for this order", "NO_PAYMENT", 409)
  }
  if (!targetPayment.gatewayTransactionId) {
    throw withCode("Payment has no gateway transaction id — cannot refund", "NO_PAYMENT", 409)
  }

  // 6 · Provider call — done BEFORE the DB transaction so we never hold a
  //     DB lock open across an external HTTP request. If the provider fails,
  //     we throw and no DB writes happen.
  let providerRaw
  try {
    if (targetPayment.paymentGateway === "paypal") {
      providerRaw = await refundPaypalCapture(targetPayment.gatewayTransactionId, {
        amount:   requestedAmount,
        currency: targetPayment.currency || order.currency || "MXN",
        note:     reason || undefined,
      })
    } else if (targetPayment.paymentGateway === "mercadopago") {
      providerRaw = await refundMercadoPagoPayment({
        paymentId: targetPayment.gatewayTransactionId,
        amount:    requestedAmount,
      })
    } else {
      throw withCode(`Unsupported payment gateway: ${targetPayment.paymentGateway}`, "GATEWAY_ERROR", 500)
    }
  } catch (providerErr) {
    logger.error(`[refund] provider call failed for order ${order.orderNumber} (${targetPayment.paymentGateway}): ${providerErr.message}`)
    const err = withCode(`Refund declined by ${targetPayment.paymentGateway}: ${providerErr.message}`, "GATEWAY_ERROR", 502)
    err.details = { provider: targetPayment.paymentGateway, raw: providerErr.message }
    throw err
  }

  // 7 · Transactional DB writes.
  const result = await prisma.$transaction(async (tx) => {
    const refund = await tx.refund.create({
      data: {
        paymentId:    targetPayment.id,
        orderId:      order.id,
        amount:       requestedAmount,
        reason:       reason || null,
        refundStatus: "succeeded",
        processedAt:  new Date(),
      },
    })

    await tx.payment.update({
      where: { id: targetPayment.id },
      data:  { paymentStatus: "refunded" },
    })

    await tx.order.update({
      where: { id: order.id },
      data:  { status: "refunded" },
    })

    // Revoke ALL active UserDownload entitlements for the order.
    const revoked = await tx.userDownload.updateMany({
      where: { orderId: order.id, downloadAccessStatus: "active" },
      data:  { downloadAccessStatus: "revoked" },
    })

    // Audit row — captures who, what, why, override usage, blocked items
    // they bypassed (if any), and the gateway response stub.
    await tx.adminAuditLog.create({
      data: {
        adminUserId,
        action:     "order.refund.full",
        targetType: "Order",
        targetId:   order.id,
        beforeJson: {
          orderStatus:     "paid",
          paymentStatus:   targetPayment.paymentStatus,
          totalAmount,
          alreadyRefunded,
        },
        afterJson: {
          orderStatus:     "refunded",
          paymentStatus:   "refunded",
          refundAmount:    requestedAmount,
          refundedItems:   Array.from(targetItemIds),
          revokedDownloads: revoked.count,
          force,
          blockedItemsBypassed: force ? blockedItems : [],
          provider:        targetPayment.paymentGateway,
          providerRefundId: providerRaw?.id || null,
        },
        ipAddress,
      },
    })

    return { refund, revokedCount: revoked.count }
  })

  // 8 · Best-effort side effects. Failures here MUST NOT roll back the refund.
  const customerName = order.customerName || order.user?.fullName || "Customer"
  const customerEmail = order.customerEmail || order.user?.email
  const emailOrder = {
    id:            order.orderNumber || order.id,
    orderNumber:   order.orderNumber,
    customerEmail,
    customerName,
    totalAmount,
    status:        "refunded",
    userId:        order.userId,
    items: (order.items || []).map((i) => ({
      title:    i.title || i.titleSnapshot || "Item",
      quantity: i.quantity || 1,
      price:    toNumber(i.unitPrice || i.price || 0),
    })),
  }

  sendOrderRefundedEmail(emailOrder).catch((e) =>
    logger.warn(`[refund] sendOrderRefundedEmail failed for ${order.orderNumber}: ${e.message}`),
  )
  notifyOrderRefunded(emailOrder).catch((e) =>
    logger.warn(`[refund] notifyOrderRefunded failed for ${order.orderNumber}: ${e.message}`),
  )
  recordOrderEvent({
    orderId:     order.id,
    userId:      order.userId,
    action:      "order.refunded",
    description: `Refund ${requestedAmount} ${order.currency || "MXN"} via ${targetPayment.paymentGateway}` +
                 `${reason ? ` — ${reason}` : ""}` +
                 `${force && blockedItems.length ? ` [override: ${blockedItems.length} downloaded item(s)]` : ""}`,
    ipAddress,
  }).catch(() => null)

  return {
    refund: {
      id:           result.refund.id,
      orderId:      order.id,
      paymentId:    targetPayment.id,
      amount:       requestedAmount,
      currency:     order.currency,
      reason,
      refundStatus: "succeeded",
      processedAt:  result.refund.processedAt,
      isFull,
      provider:     targetPayment.paymentGateway,
      providerRefundId: providerRaw?.id || null,
      revokedDownloads: result.revokedCount,
    },
    isFull,
    orderStatus:  "refunded",
    providerRaw,
  }
}

/* ─────────────────────── public — listing helpers ──────────────────────── */

/**
 * listAdminRefunds — admin-facing list with filters.
 *
 * Filters:
 *   - status:   refundStatus value (e.g. 'succeeded')
 *   - orderId:  scope to a single order
 *   - page, limit
 */
async function listAdminRefunds({ status, orderId, page = 1, limit = 30 } = {}) {
  const where = {}
  if (status)  where.refundStatus = status
  if (orderId) where.orderId      = orderId

  const skip  = Math.max(0, (Number(page)  - 1) * Number(limit))
  const take  = Math.min(100, Math.max(1, Number(limit)))

  const [rows, total] = await Promise.all([
    prisma.refund.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        order:   { select: { id: true, orderNumber: true, customerName: true, customerEmail: true, totalAmount: true, currency: true, status: true } },
        payment: { select: { id: true, paymentGateway: true, gatewayTransactionId: true } },
      },
    }),
    prisma.refund.count({ where }),
  ])

  return {
    refunds: rows.map((r) => ({
      id:           r.id,
      orderId:      r.orderId,
      orderNumber:  r.order?.orderNumber,
      customerName: r.order?.customerName,
      customerEmail:r.order?.customerEmail,
      paymentId:    r.paymentId,
      provider:     r.payment?.paymentGateway,
      gatewayTransactionId: r.payment?.gatewayTransactionId,
      amount:       round2(toNumber(r.amount)),
      currency:     r.order?.currency,
      reason:       r.reason,
      refundStatus: r.refundStatus,
      processedAt:  r.processedAt,
      createdAt:    r.createdAt,
    })),
    meta: {
      total,
      page:  Number(page),
      limit: take,
      pages: Math.ceil(total / take),
    },
  }
}

/**
 * listRefundsForOrder — used by both admin (full visibility) and member
 * (own-order check enforced by the controller).
 */
async function listRefundsForOrder(orderId) {
  const rows = await prisma.refund.findMany({
    where:   { orderId },
    orderBy: { createdAt: "desc" },
    include: {
      payment: { select: { paymentGateway: true } },
    },
  })
  return rows.map((r) => ({
    id:           r.id,
    paymentId:    r.paymentId,
    provider:     r.payment?.paymentGateway,
    amount:       round2(toNumber(r.amount)),
    reason:       r.reason,
    refundStatus: r.refundStatus,
    processedAt:  r.processedAt,
    createdAt:    r.createdAt,
  }))
}

/* ─────────────────────── small error builder ───────────────────────────── */

function withCode(message, code, status = 500) {
  const err = new Error(message)
  err.code   = code
  err.status = status
  return err
}

module.exports = {
  REFUND_WINDOW_DAYS,
  VALID_REFUND_STATUSES,
  checkRefundEligibility,
  processOrderRefund,
  listAdminRefunds,
  listRefundsForOrder,
}
