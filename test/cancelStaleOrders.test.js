// ─────────────────────────────────────────────────────────────────────────────
// jobs/cancelStaleOrders — abandoned pending orders are cancelled and their
// coupons released; an order paid mid-sweep is left alone.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => {
  const tx = {
    order:       { updateMany: jest.fn() },
    couponUsage: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    coupon:      { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  }
  return {
    order: { findMany: jest.fn() },
    $transaction: jest.fn(async (cb) => cb(tx)),
    __tx: tx,
  }
})
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))

const prisma = require("../src/lib/prisma")
const { cancelStaleOrders } = require("../src/jobs/cancelStaleOrders")

beforeEach(() => jest.clearAllMocks())

test("cancels stale orders and releases coupons", async () => {
  prisma.order.findMany.mockResolvedValue([
    { id: "o1", orderNumber: "ORD-1", customerEmail: "a@b.c", couponId: "c1", createdAt: new Date(0) },
    { id: "o2", orderNumber: "ORD-2", customerEmail: "d@e.f", couponId: null, createdAt: new Date(0) },
  ])
  prisma.__tx.order.updateMany.mockResolvedValue({ count: 1 })

  const r = await cancelStaleOrders({ hours: 24 })

  expect(r).toEqual({ scanned: 2, cancelled: 2, couponsReleased: 1, held: 0 })
  expect(prisma.__tx.couponUsage.deleteMany).toHaveBeenCalledWith({ where: { orderId: "o1" } })
  expect(prisma.__tx.coupon.updateMany).toHaveBeenCalledWith({
    where: { id: "c1", usedCount: { gt: 0 } },
    data:  { usedCount: { decrement: 1 } },
  })
  const where = prisma.order.findMany.mock.calls[0][0].where
  expect(where.status).toBe("pending")
  expect(where.paidAt).toBeNull()
})

test("order paid between select and update is not cancelled and keeps its coupon", async () => {
  prisma.order.findMany.mockResolvedValue([
    { id: "o1", orderNumber: "ORD-1", customerEmail: "a@b.c", couponId: "c1", createdAt: new Date(0) },
  ])
  prisma.__tx.order.updateMany.mockResolvedValue({ count: 0 })

  const r = await cancelStaleOrders()

  expect(r).toEqual({ scanned: 1, cancelled: 0, couponsReleased: 0, held: 0 })
  expect(prisma.__tx.coupon.updateMany).not.toHaveBeenCalled()
})

// ── OXXO / SPEI: an unexpired voucher keeps the order alive ─────────────────

function offlinePayment({ expiresAt, createdAt = new Date(0) }) {
  return {
    paymentStatus: "pending",
    createdAt,
    failureReason: JSON.stringify({
      kind: "offline_pending", type: "ticket", methodId: "oxxo",
      voucherUrl: "https://www.mercadopago.com.mx/payments/1/ticket", expiresAt,
    }),
  }
}

test("order with an unexpired OXXO voucher is held, not cancelled", async () => {
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  prisma.order.findMany.mockResolvedValue([
    { id: "o1", orderNumber: "ORD-1", couponId: "c1", createdAt: new Date(0), payments: [offlinePayment({ expiresAt: future })] },
    { id: "o2", orderNumber: "ORD-2", couponId: null, createdAt: new Date(0), payments: [] },
  ])
  prisma.__tx.order.updateMany.mockResolvedValue({ count: 1 })

  const r = await cancelStaleOrders({ hours: 24 })

  expect(r).toEqual({ scanned: 2, cancelled: 1, couponsReleased: 0, held: 1 })
  expect(prisma.__tx.order.updateMany).toHaveBeenCalledTimes(1)
  expect(prisma.__tx.order.updateMany.mock.calls[0][0].where.id).toBe("o2")
  const select = prisma.order.findMany.mock.calls[0][0].select
  expect(select.payments.take).toBe(1)
})

test("order whose voucher expired past the grace window is cancelled", async () => {
  const past = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString() // 10 h ago > 6 h grace
  prisma.order.findMany.mockResolvedValue([
    { id: "o1", orderNumber: "ORD-1", couponId: null, createdAt: new Date(0), payments: [offlinePayment({ expiresAt: past })] },
  ])
  prisma.__tx.order.updateMany.mockResolvedValue({ count: 1 })

  const r = await cancelStaleOrders({ hours: 24 })
  expect(r).toEqual({ scanned: 1, cancelled: 1, couponsReleased: 0, held: 0 })
})

test("voucher without an expiry falls back to MP_CASH_EXPIRY_HOURS from the payment's creation", async () => {
  process.env.MP_CASH_EXPIRY_HOURS = "72"
  const recent = new Date(Date.now() - 30 * 60 * 60 * 1000) // 30 h old payment, 72 h window → held
  prisma.order.findMany.mockResolvedValue([
    { id: "o1", orderNumber: "ORD-1", couponId: null, createdAt: new Date(0), payments: [offlinePayment({ expiresAt: null, createdAt: recent })] },
  ])
  const r = await cancelStaleOrders({ hours: 24 })
  expect(r.held).toBe(1)
  expect(r.cancelled).toBe(0)
  delete process.env.MP_CASH_EXPIRY_HOURS
})

test("dry run writes nothing", async () => {
  prisma.order.findMany.mockResolvedValue([{ id: "o1", orderNumber: "ORD-1", couponId: null }])
  const r = await cancelStaleOrders({ dryRun: true })
  expect(r.cancelled).toBe(0)
  expect(prisma.$transaction).not.toHaveBeenCalled()
})
