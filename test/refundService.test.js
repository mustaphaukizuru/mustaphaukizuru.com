// ─────────────────────────────────────────────────────────────────────────────
// refundService — unit tests (Jest)
//
// Strategy: mock every external collaborator with jest.mock so the tests
// exercise ONLY the orchestrator's logic (eligibility math, Option A gate,
// transaction body, error mapping). No DB, no network, no email.
//
// Run:
//   npm test                     # all tests
//   npm test -- refundService    # this file only
//   npm run test:coverage
// ─────────────────────────────────────────────────────────────────────────────

/* ────────────────────────────── mocks ──────────────────────────────────── */

// Prisma client — every method we touch is jest.fn() so we can assert on
// call arguments and stub return values per-test.
jest.mock("../src/lib/prisma", () => {
  const tx = {
    refund:        { create: jest.fn() },
    payment:       { update: jest.fn() },
    order:         { update: jest.fn() },
    userDownload:  { updateMany: jest.fn() },
    adminAuditLog: { create: jest.fn() },
  }
  return {
    order: {
      findUnique: jest.fn(),
    },
    refund: {
      findMany: jest.fn(),
      count:    jest.fn(),
    },
    // $transaction(callback) — invoke with our `tx` mock so the orchestrator's
    // tx.<model>.<method> calls are captured for assertions.
    $transaction: jest.fn(async (cb) => {
      // Reset per-call so assertions don't accumulate across tests.
      tx.refund.create.mockClear()
      tx.payment.update.mockClear()
      tx.order.update.mockClear()
      tx.userDownload.updateMany.mockClear()
      tx.adminAuditLog.create.mockClear()

      // Default stub returns — tests can override via mockResolvedValueOnce.
      tx.refund.create.mockResolvedValue({ id: "refund_x", processedAt: new Date() })
      tx.payment.update.mockResolvedValue({})
      tx.order.update.mockResolvedValue({})
      tx.userDownload.updateMany.mockResolvedValue({ count: 0 })
      tx.adminAuditLog.create.mockResolvedValue({})

      return cb(tx)
    }),
    __tx: tx,
  }
})

jest.mock("../src/services/paypalService", () => ({
  refundPaypalCapture: jest.fn(),
}))
jest.mock("../src/services/mercadoPagoService", () => ({
  refundMercadoPagoPayment: jest.fn(),
}))
jest.mock("../src/services/orderFulfillmentService", () => ({
  recordOrderEvent: jest.fn().mockResolvedValue(null),
}))
jest.mock("../src/utils/mailer", () => ({
  sendOrderRefundedEmail: jest.fn().mockResolvedValue(null),
}))
jest.mock("../src/services/notificationService", () => ({
  notifyOrderRefunded: jest.fn().mockResolvedValue(null),
}))
jest.mock("../src/utils/logger", () => ({
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
}))

/* ───────────────────────── system-under-test ───────────────────────────── */

const prisma = require("../src/lib/prisma")
const { refundPaypalCapture }      = require("../src/services/paypalService")
const { refundMercadoPagoPayment } = require("../src/services/mercadoPagoService")

const {
  processOrderRefund,
  checkRefundEligibility,
} = require("../src/services/refundService")

/* ───────────────────────── fixtures ────────────────────────────────────── */

function buildOrder({
  status              = "paid",
  totalAmount         = 100,
  currency            = "MXN",
  paidAt              = new Date(),
  refunds             = [],
  payments,
  items,
  userDownloads       = [],
  userId              = "user_1",
} = {}) {
  return {
    id:           "order_1",
    orderNumber:  "ORD-1",
    status,
    currency,
    totalAmount,
    paidAt,
    customerName:  "Buyer Test",
    customerEmail: "buyer@example.com",
    userId,
    items: items || [
      { id: "item_1", itemType: "product", productId: "prod_1", title: "Product One", quantity: 1, lineTotal: 60, unitPrice: 60 },
      { id: "item_2", itemType: "product", productId: "prod_2", title: "Product Two", quantity: 1, lineTotal: 40, unitPrice: 40 },
    ],
    payments: payments || [
      {
        id:                   "pay_1",
        paymentGateway:       "paypal",
        gatewayTransactionId: "CAP-XYZ",
        amount:               totalAmount,
        currency,
        paymentStatus:        "paid",
        createdAt:            new Date(),
      },
    ],
    refunds,
    userDownloads,
    user: { id: userId, fullName: "Buyer Test", email: "buyer@example.com" },
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  refundPaypalCapture.mockResolvedValue({ id: "PAYPAL-REFUND-1", status: "COMPLETED" })
  refundMercadoPagoPayment.mockResolvedValue({ id: "MP-REFUND-1", status: "approved" })
})

/* ─────────────────────────── tests ─────────────────────────────────────── */

describe("checkRefundEligibility", () => {
  test("marks order eligible when paid, in window, no downloads", async () => {
    prisma.order.findUnique.mockResolvedValueOnce(buildOrder())

    const result = await checkRefundEligibility("order_1")

    expect(result.eligible).toBe(true)
    expect(result.reason).toBeNull()
    expect(result.refundableAmount).toBe(100)
    expect(result.alreadyRefunded).toBe(0)
    expect(result.withinWindow).toBe(true)
    expect(result.items.every((i) => i.eligible)).toBe(true)
  })

  test("marks an item ineligible when downloadCount > 0", async () => {
    prisma.order.findUnique.mockResolvedValueOnce(buildOrder({
      userDownloads: [
        { orderItemId: "item_1", downloadCount: 2, lastDownloadedAt: new Date(), downloadAccessStatus: "active" },
      ],
    }))

    const result = await checkRefundEligibility("order_1")

    const downloaded = result.items.find((i) => i.orderItemId === "item_1")
    const fresh      = result.items.find((i) => i.orderItemId === "item_2")
    expect(downloaded.eligible).toBe(false)
    expect(downloaded.reason).toMatch(/downloaded/i)
    expect(fresh.eligible).toBe(true)
    // Order overall is still eligible because at least one item is.
    expect(result.eligible).toBe(true)
  })

  test("flags out-of-window when paidAt > 14 days ago", async () => {
    const oldPaidAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    prisma.order.findUnique.mockResolvedValueOnce(buildOrder({ paidAt: oldPaidAt }))

    const result = await checkRefundEligibility("order_1")

    expect(result.withinWindow).toBe(false)
    // Out-of-window does NOT auto-block — admin can override per policy.
    expect(result.eligible).toBe(true)
  })

  test("blocks order entirely when status is not 'paid'", async () => {
    prisma.order.findUnique.mockResolvedValueOnce(buildOrder({ status: "pending" }))

    const result = await checkRefundEligibility("order_1")

    expect(result.eligible).toBe(false)
    expect(result.reason).toMatch(/only paid orders/i)
  })

  test("blocks when already fully refunded", async () => {
    prisma.order.findUnique.mockResolvedValueOnce(buildOrder({
      refunds: [{ amount: 100, refundStatus: "succeeded" }],
    }))

    const result = await checkRefundEligibility("order_1")

    expect(result.eligible).toBe(false)
    expect(result.reason).toMatch(/already.*fully refunded/i)
    expect(result.alreadyRefunded).toBe(100)
    expect(result.refundableAmount).toBe(0)
  })

  test("throws NOT_FOUND when order doesn't exist", async () => {
    prisma.order.findUnique.mockResolvedValueOnce(null)
    await expect(checkRefundEligibility("nope")).rejects.toMatchObject({ code: "NOT_FOUND" })
  })
})

describe("processOrderRefund — happy paths", () => {
  test("full PayPal refund: provider called, transaction writes, downloads revoked", async () => {
    prisma.order.findUnique.mockResolvedValueOnce(buildOrder())
    prisma.__tx.userDownload.updateMany.mockResolvedValueOnce({ count: 2 })

    const result = await processOrderRefund({
      orderId:     "order_1",
      reason:      "Customer service exception",
      adminUserId: "admin_1",
    })

    // Provider called with correct args
    expect(refundPaypalCapture).toHaveBeenCalledWith("CAP-XYZ", {
      amount:   100,
      currency: "MXN",
      note:     "Customer service exception",
    })
    expect(refundMercadoPagoPayment).not.toHaveBeenCalled()

    // Transaction writes
    expect(prisma.__tx.refund.create).toHaveBeenCalledTimes(1)
    expect(prisma.__tx.refund.create.mock.calls[0][0].data).toMatchObject({
      paymentId:    "pay_1",
      orderId:      "order_1",
      amount:       100,
      reason:       "Customer service exception",
      refundStatus: "succeeded",
    })

    expect(prisma.__tx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "pay_1" }, data: { paymentStatus: "refunded" } }),
    )
    expect(prisma.__tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "order_1" }, data: { status: "refunded" } }),
    )

    // Full refund ⇒ revoke ALL active UserDownloads for the order
    expect(prisma.__tx.userDownload.updateMany).toHaveBeenCalledWith({
      where: { orderId: "order_1", downloadAccessStatus: "active" },
      data:  { downloadAccessStatus: "revoked" },
    })

    // Audit row written
    expect(prisma.__tx.adminAuditLog.create).toHaveBeenCalledTimes(1)
    expect(prisma.__tx.adminAuditLog.create.mock.calls[0][0].data).toMatchObject({
      adminUserId: "admin_1",
      action:      "order.refund.full",
      targetType:  "Order",
      targetId:    "order_1",
    })

    // Result shape
    expect(result.isFull).toBe(true)
    expect(result.orderStatus).toBe("refunded")
    expect(result.refund).toMatchObject({
      provider:         "paypal",
      providerRefundId: "PAYPAL-REFUND-1",
      isFull:           true,
      revokedDownloads: 2,
    })
  })

  test("full MercadoPago refund: MP helper called with full amount, order + payment flipped to refunded", async () => {
    prisma.order.findUnique.mockResolvedValueOnce(buildOrder({
      payments: [{
        id:                   "pay_1",
        paymentGateway:       "mercadopago",
        gatewayTransactionId: "MP-PAY-1",
        amount:               100,
        currency:             "MXN",
        paymentStatus:        "paid",
        createdAt:            new Date(),
      }],
    }))

    const result = await processOrderRefund({
      orderId:     "order_1",
      reason:      "Duplicate purchase",
      adminUserId: "admin_1",
    })

    expect(refundMercadoPagoPayment).toHaveBeenCalledWith({ paymentId: "MP-PAY-1", amount: 100 })
    expect(refundPaypalCapture).not.toHaveBeenCalled()
    expect(prisma.__tx.refund.create.mock.calls[0][0].data.amount).toBe(100)
    expect(prisma.__tx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "pay_1" }, data: { paymentStatus: "refunded" } }),
    )
    expect(prisma.__tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "order_1" }, data: { status: "refunded" } }),
    )
    expect(result.isFull).toBe(true)
    expect(result.orderStatus).toBe("refunded")
    expect(result.refund.provider).toBe("mercadopago")
  })

  test("refunds only the REMAINING balance when a prior refund exists", async () => {
    prisma.order.findUnique.mockResolvedValueOnce(buildOrder({
      refunds: [{ amount: 30, refundStatus: "succeeded" }],
    }))

    const result = await processOrderRefund({ orderId: "order_1", adminUserId: "admin_1" })

    expect(refundPaypalCapture).toHaveBeenCalledWith("CAP-XYZ", expect.objectContaining({ amount: 70 }))
    expect(result.refund.amount).toBe(70)
    expect(result.isFull).toBe(true)
  })
})

describe("processOrderRefund — Option A enforcement", () => {
  test("blocks refund of a downloaded item with INELIGIBLE_DOWNLOADED when force=false", async () => {
    prisma.order.findUnique.mockResolvedValueOnce(buildOrder({
      userDownloads: [
        { orderItemId: "item_1", downloadCount: 1, lastDownloadedAt: new Date(), downloadAccessStatus: "active" },
      ],
    }))

    await expect(processOrderRefund({
      orderId:     "order_1",
      adminUserId: "admin_1",
    })).rejects.toMatchObject({ code: "INELIGIBLE_DOWNLOADED" })

    // CRITICAL — no provider call, no DB writes
    expect(refundPaypalCapture).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  test("force=true bypasses the gate and records bypassed items in the audit row", async () => {
    prisma.order.findUnique.mockResolvedValueOnce(buildOrder({
      userDownloads: [
        { orderItemId: "item_1", downloadCount: 3, lastDownloadedAt: new Date(), downloadAccessStatus: "active" },
      ],
    }))

    await processOrderRefund({
      orderId:     "order_1",
      reason:      "VIP exception — duplicate purchase",
      force:       true,
      adminUserId: "admin_1",
    })

    expect(refundPaypalCapture).toHaveBeenCalled()
    const auditData = prisma.__tx.adminAuditLog.create.mock.calls[0][0].data
    expect(auditData.afterJson.force).toBe(true)
    expect(auditData.afterJson.blockedItemsBypassed).toEqual([
      expect.objectContaining({ orderItemId: "item_1", title: "Product One", downloadCount: 3 }),
    ])
  })

  test("a downloaded item blocks the whole (full) refund — no per-item carve-out", async () => {
    prisma.order.findUnique.mockResolvedValueOnce(buildOrder({
      userDownloads: [
        { orderItemId: "item_1", downloadCount: 1, lastDownloadedAt: new Date(), downloadAccessStatus: "active" },
      ],
    }))

    await expect(processOrderRefund({
      orderId:     "order_1",
      adminUserId: "admin_1",
    })).rejects.toMatchObject({ code: "INELIGIBLE_DOWNLOADED", details: { blockedItems: [expect.objectContaining({ orderItemId: "item_1" })] } })

    expect(refundPaypalCapture).not.toHaveBeenCalled()
  })
})

describe("processOrderRefund — validation errors", () => {
  test("INVALID_STATE when order is not paid", async () => {
    prisma.order.findUnique.mockResolvedValueOnce(buildOrder({ status: "pending" }))

    await expect(processOrderRefund({
      orderId:     "order_1",
      adminUserId: "admin_1",
    })).rejects.toMatchObject({ code: "INVALID_STATE" })

    expect(refundPaypalCapture).not.toHaveBeenCalled()
  })

  test("ALREADY_REFUNDED when refundable balance is zero", async () => {
    prisma.order.findUnique.mockResolvedValueOnce(buildOrder({
      refunds: [{ amount: 100, refundStatus: "succeeded" }],
    }))

    await expect(processOrderRefund({
      orderId:     "order_1",
      adminUserId: "admin_1",
    })).rejects.toMatchObject({ code: "ALREADY_REFUNDED" })
  })

  test("INVALID_AMOUNT when a partial `amount` is supplied — no DB read, no provider call", async () => {
    await expect(processOrderRefund({
      orderId:     "order_1",
      amount:      40,
      adminUserId: "admin_1",
    })).rejects.toMatchObject({ code: "INVALID_AMOUNT", status: 400 })

    expect(prisma.order.findUnique).not.toHaveBeenCalled()
    expect(refundPaypalCapture).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  test("INVALID_AMOUNT when `orderItemIds` subset is supplied", async () => {
    await expect(processOrderRefund({
      orderId:      "order_1",
      orderItemIds: ["item_2"],
      adminUserId:  "admin_1",
    })).rejects.toMatchObject({ code: "INVALID_AMOUNT" })

    expect(refundPaypalCapture).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  test("an empty orderItemIds array is NOT treated as a partial request", async () => {
    prisma.order.findUnique.mockResolvedValueOnce(buildOrder())

    const result = await processOrderRefund({
      orderId:      "order_1",
      orderItemIds: [],
      adminUserId:  "admin_1",
    })
    expect(result.isFull).toBe(true)
  })

  test("NOT_FOUND when order doesn't exist", async () => {
    prisma.order.findUnique.mockResolvedValueOnce(null)
    await expect(processOrderRefund({
      orderId:     "missing",
      adminUserId: "admin_1",
    })).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  test("NO_PAYMENT when no payment row exists", async () => {
    prisma.order.findUnique.mockResolvedValueOnce(buildOrder({ payments: [] }))
    await expect(processOrderRefund({
      orderId:     "order_1",
      adminUserId: "admin_1",
    })).rejects.toMatchObject({ code: "NO_PAYMENT" })
  })
})

describe("processOrderRefund — gateway errors", () => {
  test("provider failure throws GATEWAY_ERROR and writes nothing", async () => {
    prisma.order.findUnique.mockResolvedValueOnce(buildOrder())
    refundPaypalCapture.mockRejectedValueOnce(new Error("PayPal: refund failed (422): INSUFFICIENT_FUNDS"))

    await expect(processOrderRefund({
      orderId:     "order_1",
      adminUserId: "admin_1",
    })).rejects.toMatchObject({ code: "GATEWAY_ERROR" })

    // No DB writes happened
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  test("unsupported gateway returns GATEWAY_ERROR", async () => {
    prisma.order.findUnique.mockResolvedValueOnce(buildOrder({
      payments: [{
        id:                   "pay_1",
        paymentGateway:       "stripe",                // not supported
        gatewayTransactionId: "ch_x",
        amount:               100,
        currency:             "MXN",
        paymentStatus:        "paid",
        createdAt:            new Date(),
      }],
    }))

    await expect(processOrderRefund({
      orderId:     "order_1",
      adminUserId: "admin_1",
    })).rejects.toMatchObject({ code: "GATEWAY_ERROR" })
  })
})

describe("processOrderRefund — input validation", () => {
  test("requires orderId", async () => {
    await expect(processOrderRefund({ adminUserId: "admin_1" }))
      .rejects.toMatchObject({ code: "VALIDATION" })
  })

  test("requires adminUserId", async () => {
    await expect(processOrderRefund({ orderId: "order_1" }))
      .rejects.toMatchObject({ code: "VALIDATION" })
  })
})
