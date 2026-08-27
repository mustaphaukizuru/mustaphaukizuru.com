// ─────────────────────────────────────────────────────────────────────────────
// paypalController.transitionOrderToPaid — unit tests (Jest)
//
// Exercises the atomic Order + Payment transition that runs inside every
// PayPal webhook + capture call. The guarantees this function carries are
// money-critical:
//
//   1. Amount validation · missing/non-finite gatewayAmount → fail-closed.
//      Returns amountMismatch with reason="missing_or_invalid_amount" so the
//      caller can audit-log and 200 the webhook without flipping the order.
//   2. Drift / currency mismatch · |reported - expected| > 0.01 or currency
//      doesn't match → also returns amountMismatch (without flipping status).
//   3. Idempotency · running twice with the same captureId creates exactly
//      one Payment row and never regresses an already-paid order.
//   4. State-regression guard · if the order is already paid/completed, a
//      late webhook is a no-op (existing data returned, no order.update).
//
// Mock everything around the function so the test exercises ONLY the
// transition logic — no DB, no PayPal API, no network. Same pattern as
// refundService.test.js so future maintainers can pattern-match.
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
      // Clear per-call so cross-test state never leaks.
      tx.payment.findFirst.mockClear()
      tx.payment.update.mockClear()
      tx.payment.create.mockClear()
      tx.order.findUnique.mockClear()
      tx.order.update.mockClear()

      // Sensible defaults — overridden per test via mockResolvedValueOnce.
      tx.payment.findFirst.mockResolvedValue(null)         // no prior payment
      tx.payment.update.mockResolvedValue({})
      tx.payment.create.mockResolvedValue({})
      tx.order.update.mockResolvedValue({})

      return cb(tx)
    }),
    __tx: tx,
  }
})

// PayPal service is touched by the surrounding controller (webhook handler,
// capture endpoint) but transitionOrderToPaid itself never calls it. Mock
// the module anyway so the controller's top-level requires resolve.
jest.mock("../src/services/paypalService", () => ({
  createPaypalOrder:           jest.fn(),
  capturePaypalOrder:          jest.fn(),
  verifyPaypalWebhookSignature: jest.fn(),
}))

// Same idea for the downstream services — the function under test doesn't
// invoke them, but the controller module needs them to require cleanly.
jest.mock("../src/services/emailService",       () => ({ sendTemplateEmail: jest.fn() }))
jest.mock("../src/utils/resolveUserLocale",     () => ({ resolveUserLocale: jest.fn(() => "en") }))
jest.mock("../src/services/notificationService", () => ({ notifyOrderPaid:   jest.fn() }))
jest.mock("../src/services/orderFulfillmentService", () => ({
  fulfillOrder:     jest.fn(),
  recordOrderEvent: jest.fn(),
}))
jest.mock("../src/services/refundService", () => ({ processOrderRefund: jest.fn(), recordExternalRefund: jest.fn() }))
jest.mock("../src/services/receiptPdfService", () => ({ generateReceiptPdf: jest.fn() }))
jest.mock("../src/utils/logger", () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(),
}))

/* ───────────────────────── system-under-test ───────────────────────────── */

const prisma = require("../src/lib/prisma")
const { transitionOrderToPaid } = require("../src/controllers/paypalController")

/* ─────────────────────────── fixtures ──────────────────────────────────── */

function buildCurrentOrder({
  id          = "order_1",
  status      = "pending",
  totalAmount = 129,
  currency    = "MXN",
} = {}) {
  return { id, status, totalAmount, currency }
}

function buildPaidOrderWithItems({
  id          = "order_1",
  totalAmount = 129,
  currency    = "MXN",
  userId      = "user_1",
} = {}) {
  return {
    id,
    totalAmount,
    currency,
    userId,
    status: "paid",
    items: [
      { id: "item_1", itemType: "product", productId: "p1", quantity: 1, lineTotal: 129 },
    ],
  }
}

beforeEach(() => {
  jest.clearAllMocks()
})

/* ─────────────────────────── tests ─────────────────────────────────────── */

describe("transitionOrderToPaid — amount validation (Phase 1 hardening)", () => {
  test("missing gatewayAmount returns amountMismatch with reason and does NOT flip status", async () => {
    prisma.__tx.order.findUnique.mockResolvedValueOnce(buildCurrentOrder())

    const result = await transitionOrderToPaid({
      orderId:              "order_1",
      gatewayTransactionId: "CAP-XYZ",
      paymentGateway:       "paypal",
      payload:              { resource: { /* no amount */ } },
      gatewayAmount:        undefined,            // ← the bug class we fixed
      gatewayCurrency:      "MXN",
    })

    expect(result.amountMismatch).toMatchObject({
      reported: null,
      expected: 129,
      reason:   "missing_or_invalid_amount",
    })
    expect(result.isFirstTransition).toBe(false)
    expect(prisma.__tx.order.update).not.toHaveBeenCalled()
    expect(prisma.__tx.payment.update).not.toHaveBeenCalled()
    expect(prisma.__tx.payment.create).not.toHaveBeenCalled()
  })

  test("null gatewayAmount blocks the transition (same fail-closed branch)", async () => {
    prisma.__tx.order.findUnique.mockResolvedValueOnce(buildCurrentOrder())

    const result = await transitionOrderToPaid({
      orderId:              "order_1",
      gatewayTransactionId: "CAP-XYZ",
      paymentGateway:       "paypal",
      gatewayAmount:        null,
      gatewayCurrency:      "MXN",
    })

    expect(result.amountMismatch.reason).toBe("missing_or_invalid_amount")
    expect(prisma.__tx.order.update).not.toHaveBeenCalled()
  })

  test("non-finite gatewayAmount (NaN) blocks the transition", async () => {
    prisma.__tx.order.findUnique.mockResolvedValueOnce(buildCurrentOrder())

    const result = await transitionOrderToPaid({
      orderId:              "order_1",
      gatewayTransactionId: "CAP-XYZ",
      paymentGateway:       "paypal",
      gatewayAmount:        "not-a-number",
      gatewayCurrency:      "MXN",
    })

    expect(result.amountMismatch.reason).toBe("missing_or_invalid_amount")
    expect(prisma.__tx.order.update).not.toHaveBeenCalled()
  })

  test("drift > 1 cent returns amountMismatch (no status flip)", async () => {
    prisma.__tx.order.findUnique.mockResolvedValueOnce(buildCurrentOrder({ totalAmount: 129 }))

    const result = await transitionOrderToPaid({
      orderId:              "order_1",
      gatewayTransactionId: "CAP-XYZ",
      paymentGateway:       "paypal",
      gatewayAmount:        "100.00",   // ≠ 129
      gatewayCurrency:      "MXN",
    })

    expect(result.amountMismatch).toMatchObject({
      reported: 100,
      expected: 129,
      drift:    29,
    })
    expect(prisma.__tx.order.update).not.toHaveBeenCalled()
  })

  test("drift ≤ 1 cent is treated as a match (rounding-tolerant)", async () => {
    prisma.__tx.order.findUnique.mockResolvedValueOnce(buildCurrentOrder({ totalAmount: 129 }))
    prisma.__tx.order.update.mockResolvedValueOnce(buildPaidOrderWithItems({ totalAmount: 129 }))

    const result = await transitionOrderToPaid({
      orderId:              "order_1",
      gatewayTransactionId: "CAP-XYZ",
      paymentGateway:       "paypal",
      gatewayAmount:        "128.995",  // floats can do this, accept it
      gatewayCurrency:      "MXN",
    })

    expect(result.amountMismatch).toBeNull()
    expect(prisma.__tx.order.update).toHaveBeenCalledTimes(1)
  })

  test("currency mismatch returns amountMismatch even when numeric drift is zero", async () => {
    prisma.__tx.order.findUnique.mockResolvedValueOnce(buildCurrentOrder({
      totalAmount: 129, currency: "MXN",
    }))

    const result = await transitionOrderToPaid({
      orderId:              "order_1",
      gatewayTransactionId: "CAP-XYZ",
      paymentGateway:       "paypal",
      gatewayAmount:        129,
      gatewayCurrency:      "USD",         // ← reported in a different ccy
    })

    expect(result.amountMismatch).toMatchObject({
      reportedCcy: "USD",
      expectedCcy: "MXN",
    })
    expect(prisma.__tx.order.update).not.toHaveBeenCalled()
  })
})

describe("transitionOrderToPaid — happy path", () => {
  test("first valid webhook flips status, creates Payment, returns isFirstTransition=true", async () => {
    prisma.__tx.order.findUnique.mockResolvedValueOnce(buildCurrentOrder())
    prisma.__tx.order.update.mockResolvedValueOnce(buildPaidOrderWithItems())

    const result = await transitionOrderToPaid({
      orderId:              "order_1",
      gatewayTransactionId: "CAP-XYZ",
      paymentGateway:       "paypal",
      payload:              { resource: { id: "CAP-XYZ" } },
      gatewayAmount:        "129.00",
      gatewayCurrency:      "MXN",
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
      paymentGateway:       "paypal",
      gatewayTransactionId: "CAP-XYZ",
      paymentStatus:        "paid",
      orderId:              "order_1",
    })
    expect(prisma.__tx.payment.update).not.toHaveBeenCalled()
  })
})

describe("transitionOrderToPaid — idempotency + state-regression guard", () => {
  test("replay with same captureId updates existing Payment, does NOT flip order again", async () => {
    // Existing Payment found — webhook is a replay.
    prisma.__tx.payment.findFirst.mockResolvedValueOnce({ id: "pay_1", paymentStatus: "paid" })
    // Order is already paid.
    prisma.__tx.order.findUnique
      .mockResolvedValueOnce(buildCurrentOrder({ status: "paid" }))  // first findUnique (pre-flight)
      .mockResolvedValueOnce(buildPaidOrderWithItems())              // second findUnique (already-paid branch)

    const result = await transitionOrderToPaid({
      orderId:              "order_1",
      gatewayTransactionId: "CAP-XYZ",
      paymentGateway:       "paypal",
      gatewayAmount:        "129.00",
      gatewayCurrency:      "MXN",
    })

    // Idempotent — existing payment found, no double-flip
    expect(result.isFirstTransition).toBe(false)
    expect(prisma.__tx.order.update).not.toHaveBeenCalled()
    // Payment row updated (refresh metadata) not re-created
    expect(prisma.__tx.payment.update).toHaveBeenCalledTimes(1)
    expect(prisma.__tx.payment.create).not.toHaveBeenCalled()
  })

  test("late webhook on already-paid order is a no-op (no regress, no recreate)", async () => {
    // No existing payment for this captureId — but order is already paid.
    prisma.__tx.payment.findFirst.mockResolvedValueOnce(null)
    prisma.__tx.order.findUnique
      .mockResolvedValueOnce(buildCurrentOrder({ status: "paid" }))
      .mockResolvedValueOnce(buildPaidOrderWithItems())

    const result = await transitionOrderToPaid({
      orderId:              "order_1",
      gatewayTransactionId: "CAP-LATE",
      paymentGateway:       "paypal",
      gatewayAmount:        "129.00",
      gatewayCurrency:      "MXN",
    })

    // Order not regressed; Payment row IS created (different captureId, valid record)
    expect(result.isFirstTransition).toBe(true)
    expect(prisma.__tx.order.update).not.toHaveBeenCalled()
    expect(prisma.__tx.payment.create).toHaveBeenCalledTimes(1)
  })

  test("throws ORDER_NOT_FOUND when the orderId doesn't exist", async () => {
    prisma.__tx.order.findUnique.mockResolvedValueOnce(null)

    await expect(transitionOrderToPaid({
      orderId:              "missing",
      gatewayTransactionId: "CAP-XYZ",
      paymentGateway:       "paypal",
      gatewayAmount:        "129.00",
      gatewayCurrency:      "MXN",
    })).rejects.toMatchObject({ code: "ORDER_NOT_FOUND" })

    expect(prisma.__tx.order.update).not.toHaveBeenCalled()
    expect(prisma.__tx.payment.create).not.toHaveBeenCalled()
  })
})
