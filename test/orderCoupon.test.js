// ─────────────────────────────────────────────────────────────────────────────
// orderService.createOrder — coupon consumption is race-safe and atomic.
//
//   1. Coupon consumed via optimistic lock on usedCount (updateMany with the
//      value validateCoupon read). If 0 rows are touched, the whole order
//      transaction throws 409 COUPON_RACE — nothing is half-written.
//   2. CouponUsage row is written for signed-in buyers (per-user limits).
//   3. Price/discount are computed server-side from product price + coupon.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => {
  const tx = {
    order:       { create: jest.fn() },
    coupon:      { updateMany: jest.fn() },
    couponUsage: { create: jest.fn() },
  }
  return {
    product: { findMany: jest.fn() },
    order:   { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn(async (cb) => cb(tx)),
    __tx: tx,
  }
})

jest.mock("../src/services/couponService", () => ({
  validateCoupon:    jest.fn(),
  calculateDiscount: jest.fn(),
}))

const prisma = require("../src/lib/prisma")
const { validateCoupon } = require("../src/services/couponService")
const { createOrder } = require("../src/services/orderService")

const PRODUCT = { id: "p1", title: "Template", price: "100.00", isActive: true, images: [], files: [] }
const COUPON  = { id: "c1", code: "SAVE10", usedCount: 3, usageLimit: 5 }

function primeHappyPath() {
  prisma.product.findMany.mockResolvedValue([PRODUCT])
  prisma.__tx.order.create.mockImplementation(async ({ data }) => ({
    id: "o1", ...data, items: [], createdAt: new Date(),
  }))
  prisma.__tx.couponUsage.create.mockResolvedValue({})
}

beforeEach(() => {
  jest.clearAllMocks()
  primeHappyPath()
})

const basePayload = {
  customerName: "Ana", customerEmail: "ana@example.com", userId: "u1",
  items: [{ productId: "p1", quantity: 2 }],
}

test("coupon consumed with optimistic lock and usage row written", async () => {
  validateCoupon.mockResolvedValue({ valid: true, discount: 20, coupon: COUPON })
  prisma.__tx.coupon.updateMany.mockResolvedValue({ count: 1 })

  const order = await createOrder({ ...basePayload, couponCode: "SAVE10" })

  expect(prisma.__tx.coupon.updateMany).toHaveBeenCalledWith({
    where: { id: "c1", usedCount: 3 },
    data:  { usedCount: { increment: 1 } },
  })
  expect(prisma.__tx.couponUsage.create).toHaveBeenCalledWith({
    data: { couponId: "c1", userId: "u1", orderId: "o1" },
  })
  expect(order.subtotalAmount).toBe(200)
  expect(order.discountAmount).toBe(20)
  expect(order.totalAmount).toBe(180)
})

test("concurrent consumption (0 rows updated) aborts the order with 409", async () => {
  validateCoupon.mockResolvedValue({ valid: true, discount: 20, coupon: COUPON })
  prisma.__tx.coupon.updateMany.mockResolvedValue({ count: 0 })

  await expect(createOrder({ ...basePayload, couponCode: "SAVE10" }))
    .rejects.toMatchObject({ code: "COUPON_RACE", statusCode: 409 })
  expect(prisma.__tx.couponUsage.create).not.toHaveBeenCalled()
})

test("invalid coupon rejects with 400 before any write", async () => {
  validateCoupon.mockResolvedValue({ valid: false, message: "This coupon has expired" })

  await expect(createOrder({ ...basePayload, couponCode: "OLD" }))
    .rejects.toMatchObject({ code: "COUPON_INVALID", statusCode: 400 })
  expect(prisma.$transaction).not.toHaveBeenCalled()
})

test("no coupon: total equals subtotal, no coupon writes", async () => {
  const order = await createOrder(basePayload)
  expect(order.totalAmount).toBe(200)
  expect(prisma.__tx.coupon.updateMany).not.toHaveBeenCalled()
})
