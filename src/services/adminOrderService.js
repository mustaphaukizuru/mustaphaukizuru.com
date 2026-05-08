// @ts-check
const prisma = require("../lib/prisma")

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

async function updateOrderStatus(orderId, status) {
  const VALID = ["pending", "paid", "failed", "cancelled", "refunded"]
  if (!VALID.includes(status)) throw new Error(`Invalid status: ${status}`)
  const order = await prisma.order.update({
    where: { id: orderId },
    data:  {
      status,
      ...(status === "paid" ? { paidAt: new Date() } : {}),
    },
  })
  return serializeOrder(order)
}

module.exports = { getAdminOrders, getAdminOrderById, updateOrderStatus }
