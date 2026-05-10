// ─────────────────────────────────────────────────────────────────────────────
// mercadoPagoService.markOrderPaidByMP — unit tests (Jest)
//
// Mirror of paypalTransition.test.js for the MercadoPago side. Same
// guarantees apply:
//   1. Amount validation (only on status === "approved") — missing/non-finite
//      gatewayAmount → fail-closed, returns amountMismatch.
//   2. Drift / currency mismatch on approved → amountMismatch.
//   3. Idempotency on gatewayTransactionId.
//   4. State-regression guard — a late "pending" or "failed" webhook on an
//      already-paid order does NOT downgrade the order.
//
// Behavioural difference vs PayPal: MP carries a `status` enum (approved /
// pending / in_process / cancelled / rejected) instead of just "captured" —
// so the amount-validation branch is conditional on `status === "approved"`,
// and the order's final status is derived from the MP status. Both
// nuances get test coverage below.
// ─────────────────────────────────────────────────────────────────────────────

/* ────────────────────────────── mocks ──────────────────────────────────── */

jest.mock("../src/lib/prisma", () => {
  const tx = {
    payment: {
      findFirst: jest.fn(),
      update:    jest.fn(),
      create:    jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
      update:     jest.fn(),
    },
  }
  return {
    $transaction: jest.fn(async (cb) => {
      tx.payment.findFirst.mockClear()
      tx.payment.update.mockClear()
      tx.payment.create.mockClear()
      tx.order.findUnique.mockClear()
      tx.order.update.mockClear()

      tx.payment.findFirst.mockResolvedValue(null)
      tx.payment.update.mockResolvedValue({})
      tx.payment.create.mockResolvedValue({})
      tx.order.update.mockResolvedValue({})

      return cb(tx)
    }),
    __tx: tx,
  }
})

jest.mock("../src/utils/logger", () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(),
}))

/* ───────────────────────── system-under-test ───────────────────────────── */

const prisma = require("../src/lib/prisma")
const { markOrderPaidByMP } = require("../src/services/mercadoPagoService")

/* ─────────────────────────── fixtures ──────────────────────────────────── */

function buildCurrentOrder({
  id          = "order_1",
  status      = "pending",
  totalAmount = 129,
  currency    = "MXN",
  userId      = "user_1",
} = {}) {
  return { id, status, totalAmount, currency, userId }
}

function buildPaidOrderWithItems({
  id          = "order_1",
  totalAmount = 129,
  currency    = "MXN",
  userId      = "user_1",
  status      = "paid",
} = {}) {
  return {
    id, totalAmount, currency, userId, status,
    items: [
      { id: "item_1", itemType: "product", productId: "p1", quantity: 1, lineTotal: 129 },
    ],
  }
}

beforeEach(() => {
  jest.clearAllMocks()
})

/* ─────────────────────────── tests ─────────────────────────────────────── */

describe("markOrderPaidByMP — amount validation (Phase 1 hardening)", () => {
  test("approved with missing gatewayAmount returns amountMismatch + does NOT flip status", async () => {
    prisma.__tx.order.findUnique.mockResolvedValueOnce(buildCurrentOrder())

    const result = await markOrderPaidByMP({
      orderId:         "order_1",
      paymentId:       "MP-PAY-1",
      status:          "approved",
      gatewayAmount:   undefined,
      gatewayCurrency: "MXN",
    })

    expect(result.amountMismatch).toMatchObject({
      reported: null,
      expected: 129,
      reason:   "missing_or_invalid_amount",
    })
    expect(result.isFirstTransition).toBe(false)
    expect(prisma.__tx.order.update).not.toHaveBeenCalled()
    expect(prisma.__tx.payment.create).not.toHaveBeenCalled()
  })

  test("approved with null gatewayAmount blocks the transition", async () => {
    prisma.__tx.order.findUnique.mockResolvedValueOnce(buildCurrentOrder())

    const result = await markOrderPaidByMP({
      orderId:         "order_1",
      paymentId:       "MP-PAY-1",
      status:          "approved",
      gatewayAmount:   null,
      gatewayCurrency: "MXN",
    })

    expect(result.amountMismatch.reason).toBe("missing_or_invalid_amount")
    expect(prisma.__tx.order.update).not.toHaveBeenCalled()
  })

  test("approved with NaN-coercible amount blocks the transition", async () => {
    prisma.__tx.order.findUnique.mockResolvedValueOnce(buildCurrentOrder())

    const result = await markOrderPaidByMP({
      orderId:         "order_1",
      paymentId:       "MP-PAY-1",
      status:          "approved",
      gatewayAmount:   "not-a-number",
      gatewayCurrency: "MXN",
    })

    expect(result.amountMismatch.reason).toBe("missing_or_invalid_amount")
  })

  test("approved with currency mismatch returns amountMismatch even when number matches", async () => {
    prisma.__tx.order.findUnique.mockResolvedValueOnce(buildCurrentOrder({
      totalAmount: 129, currency: "MXN",
    }))

    const result = await markOrderPaidByMP({
      orderId:         "order_1",
      paymentId:       "MP-PAY-1",
      status:          "approved",
      gatewayAmount:   129,
      gatewayCurrency: "USD",
    })

    expect(result.amountMismatch).toMatchObject({ reportedCcy: "USD", expectedCcy: "MXN" })
    expect(prisma.__tx.order.update).not.toHaveBeenCalled()
  })

  test("pending status skips amount validation — write the row even without an amount", async () => {
    // Pending webhook can legitimately arrive without a transaction_amount
    // (preference created, payment not yet attempted). We mark the order
    // pending and store the payment record without an amount check.
    prisma.__tx.order.findUnique.mockResolvedValueOnce(buildCurrentOrder())
    prisma.__tx.order.update.mockResolvedValueOnce(buildPaidOrderWithItems({ status: "pending" }))

    const result = await markOrderPaidByMP({
      orderId:         "order_1",
      paymentId:       "MP-PAY-1",
      status:          "pending",
      gatewayAmount:   undefined,
      gatewayCurrency: "MXN",
    })

    expect(result.amountMismatch).toBeNull()
    expect(prisma.__tx.order.update).toHaveBeenCalled()
    expect(prisma.__tx.payment.create).toHaveBeenCalledTimes(1)
    expect(prisma.__tx.payment.create.mock.calls[0][0].data.paymentStatus).toBe("pending")
  })
})

describe("markOrderPaidByMP — happy path (approved)", () => {
  test("approved + matching amount flips status to paid, creates Payment, isFirstTransition=true", async () => {
    prisma.__tx.order.findUnique.mockResolvedValueOnce(buildCurrentOrder())
    prisma.__tx.order.update.mockResolvedValueOnce(buildPaidOrderWithItems())

    const result = await markOrderPaidByMP({
      orderId:         "order_1",
      paymentId:       "MP-PAY-1",
      status:          "approved",
      gatewayAmount:   "129.00",
      gatewayCurrency: "MXN",
    })

    expect(result.amountMismatch).toBeNull()
    expect(result.isFirstTransition).toBe(true)
    expect(result.order.status).toBe("paid")
    expect(prisma.__tx.order.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "order_1" },
      data:  expect.objectContaining({ status: "paid" }),
    }))
    expect(prisma.__tx.payment.create).toHaveBeenCalledTimes(1)
    expect(prisma.__tx.payment.create.mock.calls[0][0].data).toMatchObject({
      paymentGateway:       "mercadopago",
      gatewayTransactionId: "MP-PAY-1",
      paymentStatus:        "paid",
    })
  })
})

describe("markOrderPaidByMP — idempotency + state-regression guard", () => {
  test("replay with same paymentId updates existing Payment, no double-flip", async () => {
    prisma.__tx.payment.findFirst.mockResolvedValueOnce({ id: "pay_1", paymentStatus: "paid", orderId: "order_1" })
    prisma.__tx.order.findUnique.mockResolvedValueOnce(buildCurrentOrder({ status: "paid" }))
    prisma.__tx.order.update.mockResolvedValueOnce(buildPaidOrderWithItems())

    const result = await markOrderPaidByMP({
      orderId:         "order_1",
      paymentId:       "MP-PAY-1",
      status:          "approved",
      gatewayAmount:   "129.00",
      gatewayCurrency: "MXN",
    })

    expect(result.isFirstTransition).toBe(false)
    expect(prisma.__tx.payment.update).toHaveBeenCalledTimes(1)
    expect(prisma.__tx.payment.create).not.toHaveBeenCalled()
  })

  test("late 'pending' webhook on already-paid order does NOT downgrade the order", async () => {
    prisma.__tx.order.findUnique
      .mockResolvedValueOnce(buildCurrentOrder({ status: "paid" }))  // pre-flight
      .mockResolvedValueOnce(buildPaidOrderWithItems())              // regression branch

    const result = await markOrderPaidByMP({
      orderId:         "order_1",
      paymentId:       "MP-PAY-1",
      status:          "pending",            // ← would regress if allowed
      gatewayAmount:   undefined,            // ← legitimate for pending
      gatewayCurrency: "MXN",
    })

    // Order stays paid; Payment row created with status=pending though
    expect(result.order.status).toBe("paid")
    expect(prisma.__tx.order.update).not.toHaveBeenCalled()
    expect(prisma.__tx.payment.create).toHaveBeenCalledTimes(1)
    expect(prisma.__tx.payment.create.mock.calls[0][0].data.paymentStatus).toBe("pending")
  })

  test("late 'rejected' webhook on already-paid order does NOT downgrade the order to failed", async () => {
    prisma.__tx.order.findUnique
      .mockResolvedValueOnce(buildCurrentOrder({ status: "paid" }))
      .mockResolvedValueOnce(buildPaidOrderWithItems())

    const result = await markOrderPaidByMP({
      orderId:         "order_1",
      paymentId:       "MP-PAY-1",
      status:          "rejected",
      gatewayAmount:   "129.00",
      gatewayCurrency: "MXN",
    })

    expect(result.order.status).toBe("paid")
    expect(prisma.__tx.order.update).not.toHaveBeenCalled()
    expect(prisma.__tx.payment.create.mock.calls[0][0].data.paymentStatus).toBe("failed")
  })

  test("throws ORDER_NOT_FOUND when the orderId doesn't exist", async () => {
    prisma.__tx.order.findUnique.mockResolvedValueOnce(null)

    await expect(markOrderPaidByMP({
      orderId:         "missing",
      paymentId:       "MP-PAY-1",
      status:          "approved",
      gatewayAmount:   "129.00",
      gatewayCurrency: "MXN",
    })).rejects.toMatchObject({ code: "ORDER_NOT_FOUND" })

    expect(prisma.__tx.order.update).not.toHaveBeenCalled()
    expect(prisma.__tx.payment.create).not.toHaveBeenCalled()
  })
})
