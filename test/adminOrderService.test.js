// ─────────────────────────────────────────────────────────────────────────────
// adminOrderService.updateOrderStatus — unit tests (Jest)
//
// PATCH /admin/orders/:id/status used to accept any of the five statuses
// from any state with a bare `prisma.order.update`: `refunded → paid`
// resurrected a refunded order, `paid → refunded` sent the "you've been
// refunded" email without moving any money or revoking downloads, and a
// typo in the status was a 500. This pins the transition table, the
// optimistic write, the audit row, and awaited fulfilment on `paid`.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => {
  const tx = {
    order:         { update: jest.fn() },
    adminAuditLog: { create: jest.fn() },
  }
  return {
    order: { findUnique: jest.fn() },
    $transaction: jest.fn(async (cb) => {
      tx.order.update.mockClear()
      tx.adminAuditLog.create.mockClear()
      tx.adminAuditLog.create.mockResolvedValue({})
      return cb(tx)
    }),
    __tx: tx,
  }
})
jest.mock("../src/services/orderFulfillmentService", () => ({
  fulfillOrder: jest.fn(async () => ({ ok: true, entitlements: 1, invoice: null })),
}))

const prisma = require("../src/lib/prisma")
const { fulfillOrder } = require("../src/services/orderFulfillmentService")
const {
  ADMIN_TRANSITIONS,
  allowedTransitionsFor,
  updateOrderStatus,
  getAdminOrderById,
} = require("../src/services/adminOrderService")

const actor = { adminUserId: "admin_1", ipAddress: "203.0.113.9" }

function current({ status = "pending", paidAt = null } = {}) {
  return { id: "order_1", status, paidAt, orderNumber: "ORD-1" }
}

beforeEach(() => {
  jest.clearAllMocks()
  prisma.__tx.order.update.mockImplementation(async ({ where, data }) => ({
    id: "order_1", orderNumber: "ORD-1", status: data.status, paidAt: data.paidAt ?? null,
    totalAmount: 100, items: [], payments: [], _where: where,
  }))
})

describe("transition table", () => {
  test("money-moving states are not admin-settable; terminal states have no exits", () => {
    expect(ADMIN_TRANSITIONS).toEqual({
      pending:   ["paid", "failed", "cancelled"],
      failed:    ["pending", "cancelled"],
      paid:      [],
      cancelled: [],
      refunded:  [],
    })
    expect(allowedTransitionsFor("nonsense")).toEqual([])
  })

  test("serialised orders carry allowedTransitions for the UI", async () => {
    prisma.order.findUnique.mockResolvedValueOnce({ id: "order_1", status: "failed", totalAmount: "10", items: [], payments: [] })
    const order = await getAdminOrderById("order_1")
    expect(order.allowedTransitions).toEqual(["pending", "cancelled"])
  })
})

describe("rejections happen before any write", () => {
  test("unknown status → 400 INVALID_STATUS, no lookup", async () => {
    await expect(updateOrderStatus("order_1", "shipped", actor))
      .rejects.toMatchObject({ statusCode: 400, code: "INVALID_STATUS" })
    expect(prisma.order.findUnique).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  test("refunded → 400 USE_REFUND_ENDPOINT, even from paid", async () => {
    await expect(updateOrderStatus("order_1", "refunded", actor))
      .rejects.toMatchObject({ statusCode: 400, code: "USE_REFUND_ENDPOINT" })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  test("missing admin id → 400 VALIDATION", async () => {
    await expect(updateOrderStatus("order_1", "paid", {}))
      .rejects.toMatchObject({ statusCode: 400, code: "VALIDATION" })
  })

  test("unknown order → 404 ORDER_NOT_FOUND", async () => {
    prisma.order.findUnique.mockResolvedValueOnce(null)
    await expect(updateOrderStatus("nope", "paid", actor))
      .rejects.toMatchObject({ statusCode: 404, code: "ORDER_NOT_FOUND" })
  })

  test.each([
    ["refunded", "paid"],
    ["cancelled", "pending"],
    ["paid", "pending"],
    ["paid", "cancelled"],
    ["pending", "pending"],
  ])("%s → %s is 409 INVALID_TRANSITION with the allowed list in details", async (from, to) => {
    prisma.order.findUnique.mockResolvedValueOnce(current({ status: from }))
    await expect(updateOrderStatus("order_1", to, actor)).rejects.toMatchObject({
      statusCode: 409, code: "INVALID_TRANSITION",
      details: { from, to, allowed: ADMIN_TRANSITIONS[from] },
    })
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(fulfillOrder).not.toHaveBeenCalled()
  })
})

describe("legal moves", () => {
  test("pending → paid: optimistic write, paidAt stamped, audit row, fulfilment awaited", async () => {
    prisma.order.findUnique.mockResolvedValueOnce(current())

    const result = await updateOrderStatus("order_1", "paid", actor)

    expect(prisma.__tx.order.update).toHaveBeenCalledTimes(1)
    const call = prisma.__tx.order.update.mock.calls[0][0]
    expect(call.where).toEqual({ id: "order_1", status: "pending" })
    expect(call.data).toEqual({ status: "paid", paidAt: expect.any(Date) })

    expect(prisma.__tx.adminAuditLog.create).toHaveBeenCalledTimes(1)
    expect(prisma.__tx.adminAuditLog.create.mock.calls[0][0].data).toMatchObject({
      adminUserId: "admin_1",
      action:      "order.status.set",
      targetType:  "Order",
      targetId:    "order_1",
      beforeJson:  { status: "pending", paidAt: null },
      afterJson:   { status: "paid", paidAt: expect.any(Date) },
      ipAddress:   "203.0.113.9",
    })

    expect(fulfillOrder).toHaveBeenCalledWith("order_1")
    expect(result).toMatchObject({ status: "paid", allowedTransitions: [], fulfillment: { ok: true, entitlements: 1 } })
  })

  test("paidAt is not re-stamped when already set", async () => {
    const earlier = new Date("2026-01-01T00:00:00Z")
    prisma.order.findUnique.mockResolvedValueOnce(current({ status: "pending", paidAt: earlier }))
    await updateOrderStatus("order_1", "paid", actor)
    expect(prisma.__tx.order.update.mock.calls[0][0].data).toEqual({ status: "paid" })
  })

  test("failed → pending: no fulfilment, no paidAt", async () => {
    prisma.order.findUnique.mockResolvedValueOnce(current({ status: "failed" }))
    const result = await updateOrderStatus("order_1", "pending", actor)
    expect(prisma.__tx.order.update.mock.calls[0][0].data).toEqual({ status: "pending" })
    expect(fulfillOrder).not.toHaveBeenCalled()
    expect(result).toMatchObject({ status: "pending", allowedTransitions: ["paid", "failed", "cancelled"], fulfillment: null })
  })

  test("a concurrent change (P2025 on the guarded write) → 409, nothing fulfilled", async () => {
    prisma.order.findUnique.mockResolvedValueOnce(current())
    const gone = new Error("Record to update not found."); gone.code = "P2025"
    prisma.__tx.order.update.mockRejectedValueOnce(gone)

    await expect(updateOrderStatus("order_1", "paid", actor))
      .rejects.toMatchObject({ statusCode: 409, code: "INVALID_TRANSITION" })
    expect(prisma.__tx.adminAuditLog.create).not.toHaveBeenCalled()
    expect(fulfillOrder).not.toHaveBeenCalled()
  })
})
