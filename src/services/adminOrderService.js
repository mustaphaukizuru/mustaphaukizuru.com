// @ts-check
const prisma   = require("../lib/prisma")
const AppError = require("../utils/AppError")
const { fulfillOrder } = require("./orderFulfillmentService")

/**
 * The moves an admin may make by hand from the order page.
 *
 * Money-moving states are deliberately absent: `paid` is left only through
 * `POST /admin/orders/:id/refund`, which refunds at the gateway, writes the
 * Refund row and revokes every download entitlement — a bare status write
 * would do none of that while telling the customer they were refunded.
 * `cancelled` and `refunded` are terminal. Anything not listed here is a
 * 409, and a status that is not a key at all is a 400 rather than a 500.
 */
const ADMIN_TRANSITIONS = Object.freeze({
  pending:   ["paid", "failed", "cancelled"],
  failed:    ["pending", "cancelled"],
  paid:      [],
  cancelled: [],
  refunded:  [],
})
const KNOWN_STATUSES = Object.keys(ADMIN_TRANSITIONS)

function allowedTransitionsFor(status) {
  return ADMIN_TRANSITIONS[status] || []
}

function safeNum(val) {
  const n = Number(val); return Number.isFinite(n) ? n : 0
}

function serializeOrder(order) {
  if (!order) return null
  return {
    ...order,
    subtotalAmount:   safeNum(order.subtotalAmount),
    discountAmount:   safeNum(order.discountAmount),
    serviceFeeAmount: safeNum(order.serviceFeeAmount),
    totalAmount:      safeNum(order.totalAmount),
    // The status control on AdminOrderDetailPage renders only these.
    allowedTransitions: allowedTransitionsFor(order.status),
    items: (order.items || []).map((item) => ({
      ...item,
      price:     safeNum(item.price),
      unitPrice: safeNum(item.unitPrice),
      lineTotal: safeNum(item.lineTotal),
    })),
    payments: (order.payments || []).map((p) => ({
      ...p,
      amount: safeNum(p.amount),
    })),
  }
}

async function getAdminOrders(filters = {}) {
  const where = {}
  if (filters.status) where.status = filters.status

  const page  = Math.max(1, Number(filters.page  || 1))
  const limit = Math.min(100, Math.max(10, Number(filters.limit || 30)))

  // Single round-trip: paginated list + total count
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip:  (page - 1) * limit,
      take:  limit,
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        items: { include: { product: { select: { id: true, title: true, slug: true } } } },
        payments: { select: { id: true, paymentGateway: true, paymentStatus: true, amount: true, paidAt: true } },
      },
    }),
    prisma.order.count({ where }),
  ])

  return {
    orders: orders.map(serializeOrder),
    meta:   { total, page, limit, pages: Math.ceil(total / limit) },
  }
}

async function getAdminOrderById(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { id: true, fullName: true, email: true, phone: true } },
      items: { include: { product: { include: { images: { orderBy: { sortOrder: "asc" } }, files: { orderBy: { isPrimary: "desc" } } } } } },
      payments: true,
    },
  })
  return serializeOrder(order)
}

/**
 * Move an order between admin-settable statuses.
 *
 *   - validates the target against ADMIN_TRANSITIONS from the CURRENT status
 *   - writes with an optimistic guard (`where: { id, status: current }`), so
 *     a concurrent move — another admin, or a gateway webhook landing in
 *     between — is a 409, never a silent overwrite
 *   - stamps `paidAt` only when it is null: the 14-day refund window keys
 *     off it and must not be reset by a later status edit
 *   - writes an AdminAuditLog row in the same transaction, matching the
 *     shape refundService writes
 *   - on `paid`, awaits `fulfillOrder` (idempotent) before returning, so the
 *     controller's download-ready emails describe entitlements that exist
 *
 * @param {string} orderId
 * @param {string} status
 * @param {{ adminUserId: string, ipAddress?: string|null }} actor
 */
async function updateOrderStatus(orderId, status, { adminUserId, ipAddress = null } = {}) {
  if (!KNOWN_STATUSES.includes(status)) {
    throw AppError.badRequest(`Unknown order status: ${status}`, "INVALID_STATUS", { allowed: KNOWN_STATUSES })
  }
  if (status === "refunded") {
    throw AppError.badRequest(
      "Use POST /admin/orders/:id/refund — it refunds at the gateway and revokes downloads",
      "USE_REFUND_ENDPOINT",
    )
  }
  if (!adminUserId) throw AppError.badRequest("adminUserId is required", "VALIDATION")

  const current = await prisma.order.findUnique({
    where:  { id: orderId },
    select: { id: true, status: true, paidAt: true, orderNumber: true },
  })
  if (!current) throw AppError.notFound("Order not found", "ORDER_NOT_FOUND")

  const allowed = allowedTransitionsFor(current.status)
  if (!allowed.includes(status)) {
    throw AppError.conflict(
      `Order ${current.orderNumber || current.id} is '${current.status}' and cannot be moved to '${status}'`,
      "INVALID_TRANSITION",
      { from: current.status, to: status, allowed },
    )
  }

  const order = await prisma.$transaction(async (tx) => {
    let updated
    try {
      updated = await tx.order.update({
        where: { id: orderId, status: current.status },
        data: {
          status,
          ...(status === "paid" && !current.paidAt ? { paidAt: new Date() } : {}),
        },
        include: { items: true, payments: true },
      })
    } catch (e) {
      if (e?.code === "P2025") {
        throw AppError.conflict(
          "Order changed while you were editing it — reload and try again",
          "INVALID_TRANSITION",
          { from: current.status, to: status },
        )
      }
      throw e
    }

    await tx.adminAuditLog.create({
      data: {
        adminUserId,
        action:     "order.status.set",
        targetType: "Order",
        targetId:   orderId,
        beforeJson: { status: current.status, paidAt: current.paidAt },
        afterJson:  { status, paidAt: updated.paidAt },
        ipAddress,
      },
    })

    return updated
  })

  // Idempotent (P2002 swallowed, ensureInvoice idempotent), so awaiting it
  // here is safe even if fulfillmentReconcileJob also runs.
  const fulfillment = status === "paid" ? await fulfillOrder(orderId) : null

  return { ...serializeOrder(order), fulfillment }
}

module.exports = {
  ADMIN_TRANSITIONS,
  allowedTransitionsFor,
  getAdminOrders,
  getAdminOrderById,
  updateOrderStatus,
}
