// ─────────────────────────────────────────────────────────────────────────────
// paymentTransitionService.transitionOrderPayment — unit tests (Jest)
//
// The gateway-agnostic core shared by paypalController.transitionOrderToPaid
// and mercadoPagoService.markOrderPaidByMP. Covers the shared guards:
//
//   1. Amount / currency drift check (only for the "paid" target).
//   2. Terminal-state guard — paid / completed / refunded / cancelled orders
//      are never rewritten, regardless of gateway or target status.
//   3. Idempotent Payment upsert keyed on [paymentGateway, gatewayTransactionId].
//   4. onFirstPaid hook fires exactly once, only on a real first paid transition.
//   5. ORDER_NOT_FOUND is an AppError (404) so errorHandler maps it cleanly.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => {
  const tx = {
    payment: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
    order:   { findUnique: jest.fn(), update: jest.fn() },
  }
  return {
    $transaction: jest.fn(async (cb) => cb(tx)),
    __tx: tx,
  }
})

const prisma   = require("../src/lib/prisma")
const AppError = require("../src/utils/AppError")
const {
  transitionOrderPayment,
  checkAmount,
  TERMINAL_ORDER_STATES,
} = require("../src/services/paymentTransitionService")

const tx = prisma.__tx

function current({ status = "pending", totalAmount = 129, currency = "MXN" } = {}) {
  return { id: "order_1", status, totalAmount, currency, userId: "user_1" }
}
function full(status = "paid") {
  return { ...current({ status }), items: [{ id: "item_1" }] }
}

beforeEach(() => {
  jest.resetAllMocks()
  prisma.$transaction.mockImplementation(async (cb) => cb(tx))
  tx.payment.findFirst.mockResolvedValue(null)
  tx.payment.update.mockResolvedValue({})
  tx.payment.create.mockResolvedValue({})
  tx.order.findUnique.mockResolvedValue(current())
  tx.order.update.mockResolvedValue(full("paid"))
})

const base = {
  orderId: "order_1",
  gatewayTransactionId: "TX-1",
  paymentGateway: "paypal",
  gatewayAmount: "129.00",
  gatewayCurrency: "MXN",
}

describe("checkAmount", () => {
  test("null when amount and currency match within 1 cent", () => {
    expect(checkAmount(current(), "129.005", "mxn")).toBeNull()
  })
  test("missing_or_invalid_amount for undefined / NaN", () => {
    expect(checkAmount(current(), undefined, "MXN")).toMatchObject({ reason: "missing_or_invalid_amount", drift: null })
    expect(checkAmount(current(), "abc", "MXN")).toMatchObject({ reason: "missing_or_invalid_amount" })
  })
  test("drift descriptor on > 1 cent difference or currency mismatch", () => {
    expect(checkAmount(current(), "128.50", "MXN")).toMatchObject({ reported: 128.5, expected: 129, drift: 0.5 })
    expect(checkAmount(current(), "129.00", "USD")).toMatchObject({ reportedCcy: "USD", expectedCcy: "MXN" })
  })
})

describe("transitionOrderPayment — shared guards", () => {
  test("TERMINAL_ORDER_STATES covers paid, completed, refunded, cancelled", () => {
    expect([...TERMINAL_ORDER_STATES].sort()).toEqual(["cancelled", "completed", "paid", "refunded"])
  })

  test("amount mismatch on paid target: no order write, no payment row, mismatch returned", async () => {
    const result = await transitionOrderPayment({ ...base, gatewayAmount: "10.00" })
    expect(result.amountMismatch).toMatchObject({ reported: 10, expected: 129 })
    expect(result.isFirstTransition).toBe(false)
    expect(tx.order.update).not.toHaveBeenCalled()
    expect(tx.payment.create).not.toHaveBeenCalled()
  })

  test("amount check is skipped for non-paid targets", async () => {
    tx.order.update.mockResolvedValue(full("pending"))
    const result = await transitionOrderPayment({ ...base, targetStatus: "pending", gatewayAmount: undefined })
    expect(result.amountMismatch).toBeNull()
    expect(tx.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "pending", paidAt: null } }))
  })

  test.each(["paid", "completed", "refunded", "cancelled"])(
    "terminal order '%s' is never rewritten by a later paid webhook (any gateway)",
    async (status) => {
      tx.order.findUnique.mockResolvedValueOnce(current({ status })).mockResolvedValueOnce(full(status))
      const result = await transitionOrderPayment({ ...base, paymentGateway: "mercadopago" })
      expect(result.order.status).toBe(status)
      expect(tx.order.update).not.toHaveBeenCalled()
      // The Payment row is still recorded for audit.
      expect(tx.payment.create).toHaveBeenCalledTimes(1)
    },
  )

  test("a NEW capture id on an already-paid order records the Payment but is not a first transition", async () => {
    // Regression: isFirstTransition was `!existing` (payment-row keyed), so a
    // second capture id re-sent the order-confirmed email and re-ran
    // fulfilment. It must be keyed on the order's prior state.
    const hook = jest.fn()
    tx.payment.findFirst.mockResolvedValue(null)
    tx.order.findUnique.mockResolvedValueOnce(current({ status: "paid" })).mockResolvedValueOnce(full("paid"))
    const result = await transitionOrderPayment({ ...base, gatewayTransactionId: "TX-2", onFirstPaid: hook })
    expect(tx.payment.create).toHaveBeenCalledTimes(1)
    expect(result.isFirstTransition).toBe(false)
    expect(hook).not.toHaveBeenCalled()
  })

  test("'refunded' target never touches the Order (owned by refundService)", async () => {
    tx.order.findUnique.mockResolvedValueOnce(current({ status: "pending" })).mockResolvedValueOnce(full("pending"))
    const result = await transitionOrderPayment({ ...base, targetStatus: "refunded" })
    expect(tx.order.update).not.toHaveBeenCalled()
    expect(result.order.status).toBe("pending")
    expect(tx.payment.create.mock.calls[0][0].data.paymentStatus).toBe("refunded")
  })

  test("idempotent upsert: existing [gateway, txId] payment is updated, not re-created", async () => {
    tx.payment.findFirst.mockResolvedValue({ id: "pay_1", paymentStatus: "paid", orderId: "order_1" })
    const result = await transitionOrderPayment(base)
    expect(tx.payment.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { gatewayTransactionId: "TX-1", paymentGateway: "paypal" },
    }))
    expect(result.isFirstTransition).toBe(false)
    expect(tx.payment.update).toHaveBeenCalledTimes(1)
    expect(tx.payment.create).not.toHaveBeenCalled()
  })

  test("failed target stores failureReason on the Payment row", async () => {
    tx.order.update.mockResolvedValue(full("failed"))
    await transitionOrderPayment({ ...base, targetStatus: "failed", failureReason: "MP status: rejected" })
    expect(tx.payment.create.mock.calls[0][0].data).toMatchObject({ paymentStatus: "failed", failureReason: "MP status: rejected", paidAt: null })
  })

  test("onFirstPaid fires once on the first paid transition, after the transaction", async () => {
    const hook = jest.fn()
    const result = await transitionOrderPayment({ ...base, onFirstPaid: hook })
    expect(result.isFirstTransition).toBe(true)
    expect(hook).toHaveBeenCalledTimes(1)
    expect(hook).toHaveBeenCalledWith(expect.objectContaining({ status: "paid" }))
  })

  test("onFirstPaid does NOT fire on replay, mismatch, or non-paid target", async () => {
    const hook = jest.fn()
    tx.payment.findFirst.mockResolvedValueOnce({ id: "pay_1" })
    await transitionOrderPayment({ ...base, onFirstPaid: hook })
    await transitionOrderPayment({ ...base, gatewayAmount: "1.00", onFirstPaid: hook })
    tx.order.update.mockResolvedValue(full("pending"))
    await transitionOrderPayment({ ...base, targetStatus: "pending", onFirstPaid: hook })
    expect(hook).not.toHaveBeenCalled()
  })

  test("unknown orderId throws an AppError 404 with code ORDER_NOT_FOUND", async () => {
    tx.order.findUnique.mockResolvedValue(null)
    const err = await transitionOrderPayment(base).catch((e) => e)
    expect(err).toBeInstanceOf(AppError)
    expect(err).toMatchObject({ code: "ORDER_NOT_FOUND", statusCode: 404 })
    expect(tx.payment.create).not.toHaveBeenCalled()
  })

  test("unsupported targetStatus is rejected before any DB work", async () => {
    await expect(transitionOrderPayment({ ...base, targetStatus: "bogus" })).rejects.toMatchObject({ code: "INVALID_TRANSITION", statusCode: 400 })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
