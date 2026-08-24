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

  expect(r).toEqual({ scanned: 2, cancelled: 2, couponsReleased: 1 })
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

  expect(r).toEqual({ scanned: 1, cancelled: 0, couponsReleased: 0 })
  expect(prisma.__tx.coupon.updateMany).not.toHaveBeenCalled()
})

test("dry run writes nothing", async () => {
  prisma.order.findMany.mockResolvedValue([{ id: "o1", orderNumber: "ORD-1", couponId: null }])
  const r = await cancelStaleOrders({ dryRun: true })
  expect(r.cancelled).toBe(0)
  expect(prisma.$transaction).not.toHaveBeenCalled()
})
