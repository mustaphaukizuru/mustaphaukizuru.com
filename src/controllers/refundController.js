// ─────────────────────────────────────────────────────────────────────────────
// Refund Controller · M15
//
// HTTP layer over services/refundService.js. All real logic lives in the
// service — the controller is responsible only for parsing the request,
// authorising the caller, and translating service-level errors into HTTP
// responses that match the rest of the API.
//
// Endpoints (mounted in routes/adminRefundRoutes.js + index.js):
//
//   Admin:
//     GET    /api/v1/admin/refunds                       — paginated list
//     GET    /api/v1/admin/refunds/:id                    — single refund
//     GET    /api/v1/admin/orders/:orderId/refund-eligibility
//     POST   /api/v1/admin/orders/:orderId/refund        — issue refund
//
//   Member:
//     GET    /api/v1/member/orders/:orderId/refunds      — own-order history
// ─────────────────────────────────────────────────────────────────────────────

const asyncHandler = require("../utils/asyncHandler")
const prisma       = require("../lib/prisma")
const logger       = require("../utils/logger")

const {
  checkRefundEligibility,
  processOrderRefund,
  listAdminRefunds,
  listRefundsForOrder,
} = require("../services/refundService")

const { sendSupportTicketEmail }      = require("../utils/mailer")
const { notifySupportTicketCreated }  = require("../services/notificationService")

/* ─────────────────────── shared error → HTTP map ───────────────────────── */

function sendServiceError(res, err, fallback = 500) {
  const status =
    err?.status ||
    (err?.code === "NOT_FOUND"             ? 404 :
     err?.code === "VALIDATION"            ? 400 :
     err?.code === "INVALID_AMOUNT"        ? 400 :
     err?.code === "INVALID_STATE"         ? 409 :
     err?.code === "ALREADY_REFUNDED"      ? 409 :
     err?.code === "INELIGIBLE_DOWNLOADED" ? 409 :
     err?.code === "NO_PAYMENT"            ? 409 :
     err?.code === "GATEWAY_ERROR"         ? 502 : fallback)

  return res.status(status).json({
    success: false,
    code:    err?.code || "REFUND_ERROR",
    message: err?.message || "Refund operation failed",
    ...(err?.details ? { details: err.details } : {}),
  })
}

/* ───────────────── GET /admin/orders/:orderId/refund-eligibility ───────── */

const getEligibility = asyncHandler(async (req, res) => {
  try {
    const data = await checkRefundEligibility(req.params.orderId)
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return sendServiceError(res, err)
  }
})

/* ───────────────── POST /admin/orders/:orderId/refund ──────────────────── */

const issueRefund = asyncHandler(async (req, res) => {
  const { orderId } = req.params
  const {
    amount,
    orderItemIds,
    reason,
    force,
  } = req.body || {}

  // Light input shaping — service does the heavy validation.
  const normalisedItemIds = Array.isArray(orderItemIds)
    ? orderItemIds.map((s) => String(s)).filter(Boolean)
    : []
  const normalisedReason = typeof reason === "string"
    ? reason.trim().slice(0, 1000) || null
    : null

  try {
    const result = await processOrderRefund({
      orderId,
      amount:       amount === "" || amount == null ? null : Number(amount),
      orderItemIds: normalisedItemIds,
      reason:       normalisedReason,
      force:        Boolean(force),
      adminUserId:  req.user.id,
      ipAddress:    req.ip,
    })

    logger.info(`[refund] admin=${req.user.id} order=${orderId} amount=${result.refund.amount} ${result.isFull ? "FULL" : "PARTIAL"} provider=${result.refund.provider}`)

    return res.status(200).json({ success: true, data: result.refund })
  } catch (err) {
    // Provider failures are noisy — log them with the admin id so support
    // can correlate the chargeback aftermath.
    if (err?.code === "GATEWAY_ERROR") {
      logger.error(`[refund] gateway error admin=${req.user.id} order=${orderId}: ${err.message}`)
    }
    return sendServiceError(res, err)
  }
})

/* ──────────────────────── GET /admin/refunds ───────────────────────────── */

const listRefunds = asyncHandler(async (req, res) => {
  const { status, orderId, page, limit } = req.query
  const result = await listAdminRefunds({ status, orderId, page, limit })
  return res.status(200).json({ success: true, data: result.refunds, meta: result.meta })
})

/* ──────────────────────── GET /admin/refunds/:id ───────────────────────── */

const getRefundById = asyncHandler(async (req, res) => {
  const refund = await prisma.refund.findUnique({
    where: { id: req.params.id },
    include: {
      order:   { select: { id: true, orderNumber: true, customerName: true, customerEmail: true, totalAmount: true, currency: true, status: true } },
      payment: { select: { id: true, paymentGateway: true, gatewayTransactionId: true, amount: true } },
    },
  })
  if (!refund) {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Refund not found" })
  }

  return res.status(200).json({
    success: true,
    data: {
      id:           refund.id,
      orderId:      refund.orderId,
      paymentId:    refund.paymentId,
      amount:       Number(refund.amount),
      reason:       refund.reason,
      refundStatus: refund.refundStatus,
      processedAt:  refund.processedAt,
      createdAt:    refund.createdAt,
      order:        refund.order,
      payment: refund.payment ? {
        ...refund.payment,
        amount: Number(refund.payment.amount),
      } : null,
    },
  })
})

/* ─────────────── GET /member/orders/:orderId/refunds ───────────────────── */

const getMemberOrderRefunds = asyncHandler(async (req, res) => {
  const { orderId } = req.params

  // Authorisation: member must own the order. Admins can read any.
  const order = await prisma.order.findUnique({
    where:  { id: orderId },
    select: { id: true, userId: true },
  })
  if (!order) {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Order not found" })
  }
  const isOwner = order.userId && req.user?.id === order.userId
  const isAdmin = req.user?.role === "admin"
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ success: false, code: "FORBIDDEN", message: "Access denied" })
  }

  const refunds = await listRefundsForOrder(orderId)
  return res.status(200).json({ success: true, data: refunds })
})

/* ─────────── POST /member/orders/:orderId/refund-request ───────────────── */
//
// M16 — member-initiated refund request flow.
//
// Creates a SupportTicket with category='refund_request' and orderId set to
// the order in question, so the admin lands on a structured ticket with one
// click to the order's refund modal. We attach an eligibility snapshot to
// the FIRST SupportMessage so the admin sees Option A status without having
// to reload the order page.
//
// We deliberately DO NOT issue the refund here — only an admin can do that
// via the existing /admin/orders/:id/refund endpoint. This keeps the audit
// trail clean and the policy enforcement centralised.

const requestRefund = asyncHandler(async (req, res) => {
  const { orderId } = req.params
  const userId      = req.user?.id
  if (!userId) {
    return res.status(401).json({ success: false, code: "AUTH_MISSING", message: "Authentication required" })
  }

  const reason = String(req.body?.reason || "").trim()
  if (reason.length < 10 || reason.length > 2000) {
    return res.status(400).json({
      success: false,
      code:    "VALIDATION",
      message: "Please describe the reason for your refund request (10–2000 characters).",
    })
  }

  // 1 · Authorise: the order must exist and belong to the requester.
  const order = await prisma.order.findUnique({
    where:  { id: orderId },
    select: {
      id: true, userId: true, orderNumber: true, status: true,
      totalAmount: true, currency: true, paidAt: true,
      customerName: true, customerEmail: true,
    },
  })
  if (!order) {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Order not found" })
  }
  if (!order.userId || order.userId !== userId) {
    return res.status(403).json({ success: false, code: "FORBIDDEN", message: "This is not your order" })
  }

  // 2 · Block duplicate open requests — at most ONE active refund_request per
  //     order. Members must wait for admin response on existing tickets.
  const existingOpen = await prisma.supportTicket.findFirst({
    where: {
      userId,
      orderId,
      category: "refund_request",
      status:   { in: ["open", "in_progress"] },
    },
    select: { id: true, ticketNumber: true, status: true },
  })
  if (existingOpen) {
    return res.status(409).json({
      success: false,
      code:    "DUPLICATE_REQUEST",
      message: `You already have an open refund request for this order (${existingOpen.ticketNumber}).`,
      details: { ticketId: existingOpen.id, ticketNumber: existingOpen.ticketNumber, status: existingOpen.status },
    })
  }

  // 3 · Snapshot eligibility so the admin sees policy status in the ticket
  //     without opening a second tab. Best-effort — refund eligibility check
  //     can fail (e.g. if the order is no longer paid). We surface that in
  //     the ticket message rather than blocking the request.
  let eligibilitySnapshot = null
  try {
    eligibilitySnapshot = await checkRefundEligibility(orderId)
  } catch (e) {
    eligibilitySnapshot = { eligible: false, reason: e.message || "Eligibility check failed" }
  }

  // 4 · Build a structured ticket subject/body so the admin sees the order
  //     context immediately on AdminSupportPage.
  const subject = `Refund request — Order ${order.orderNumber}`
  const adminContextLines = [
    `Order: ${order.orderNumber} (${order.id})`,
    `Total: ${order.totalAmount} ${order.currency}`,
    `Status: ${order.status}`,
    `Paid at: ${order.paidAt ? new Date(order.paidAt).toISOString() : "—"}`,
    "",
    "Customer reason:",
    reason,
    "",
    "Eligibility (auto-checked at submission):",
    eligibilitySnapshot?.eligible
      ? `✓ Eligible — refundable balance ${eligibilitySnapshot.refundableAmount} ${order.currency}`
      : `✗ ${eligibilitySnapshot?.reason || "Ineligible — review per Option A policy"}`,
  ]
  // Per-item annotations so the admin sees which items are blocked.
  if (Array.isArray(eligibilitySnapshot?.items) && eligibilitySnapshot.items.length) {
    adminContextLines.push("", "Items:")
    for (const item of eligibilitySnapshot.items) {
      adminContextLines.push(
        `  • ${item.title} — ${item.eligible ? "eligible" : `BLOCKED (${item.reason})`}`,
      )
    }
  }
  const messageBody = adminContextLines.join("\n")

  // 5 · Persist the ticket + first message in one transaction so the thread
  //     is never partially created.
  const ticketNumber = `RFD-${Date.now().toString(36).toUpperCase()}`
  const ticket = await prisma.supportTicket.create({
    data: {
      ticketNumber,
      userId,
      subject,
      message:  messageBody,
      category: "refund_request",
      orderId,
      // Refund disputes are higher-stakes than general questions; queue them
      // with priority='high' so they surface in the admin inbox immediately.
      priority: "high",
      status:   "open",
      messages: {
        create: {
          senderId:   userId,
          message:    messageBody,
          senderRole: "member",
        },
      },
    },
    include: { _count: { select: { messages: true } } },
  })

  // 6 · Best-effort side effects.
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { email: true, fullName: true },
  }).catch(() => null)
  sendSupportTicketEmail(ticket, user).catch((e) =>
    logger.warn(`[refund-request] support email failed for ${ticket.ticketNumber}: ${e.message}`),
  )
  notifySupportTicketCreated(userId, ticket.ticketNumber).catch(() => null)

  logger.info(`[refund-request] user=${userId} order=${order.orderNumber} ticket=${ticket.ticketNumber} eligible=${!!eligibilitySnapshot?.eligible}`)

  return res.status(201).json({
    success: true,
    data: {
      ticketId:     ticket.id,
      ticketNumber: ticket.ticketNumber,
      status:       ticket.status,
      orderId,
      orderNumber:  order.orderNumber,
      eligibilitySnapshot,
    },
  })
})

module.exports = {
  getEligibility,
  issueRefund,
  listRefunds,
  getRefundById,
  getMemberOrderRefunds,
  requestRefund,
}
