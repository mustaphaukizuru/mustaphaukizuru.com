// ─────────────────────────────────────────────────────────────────────────────
// mercadoPagoController.webhook — OXXO / SPEI pending flow (Tier 1 §5.2)
//
//   1. pending ticket webhook → order stays pending, ONE order.payment-pending
//      email, no fulfilment.
//   2. MP redelivers the same pending event → no second email.
//   3. approved webhook for the same payment → order.confirmed + fulfilment
//      fire even though the Payment row already existed (isFirstPaid).
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  paymentWebhook: {
    create: jest.fn().mockResolvedValue({ id: "wh_1", eventType: "payment.updated" }),
    update: jest.fn().mockResolvedValue({}),
  },
  payment: { findFirst: jest.fn() },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
jest.mock("../src/services/emailService", () => ({ sendTemplateEmail: jest.fn().mockResolvedValue({ ok: true }) }))
jest.mock("../src/utils/resolveUserLocale", () => ({ resolveUserLocale: jest.fn(() => "es") }))
jest.mock("../src/services/notificationService", () => ({ notifyOrderPaid: jest.fn().mockResolvedValue(null) }))
jest.mock("../src/services/orderFulfillmentService", () => ({
  fulfillOrder:     jest.fn().mockResolvedValue({ ok: true, entitlements: 1 }),
  recordOrderEvent: jest.fn().mockResolvedValue(null),
}))
jest.mock("../src/services/receiptPdfService", () => ({ generateReceiptPdf: jest.fn().mockResolvedValue(Buffer.from("pdf")) }))
jest.mock("../src/services/refundService", () => ({ processOrderRefund: jest.fn() }))

// Real service for markOrderPaidByMP (so pendingDetails is derived for real),
// mocked network lookup + signature.
jest.mock("../src/services/mercadoPagoService", () => {
  const actual = jest.requireActual("../src/services/mercadoPagoService")
  return {
    ...actual,
    getMercadoPagoPayment:        jest.fn(),
    verifyMercadoPagoSignature:   jest.fn(() => true),
    markOrderPaidByMP:            jest.fn(),
  }
})

const { sendTemplateEmail } = require("../src/services/emailService")
const { fulfillOrder, recordOrderEvent } = require("../src/services/orderFulfillmentService")
const mp = require("../src/services/mercadoPagoService")
const { webhook } = require("../src/controllers/mercadoPagoController")

const ORDER = {
  id: "order_1", orderNumber: "MU-1", status: "pending", totalAmount: 2000, currency: "MXN",
  userId: "user_1", customerName: "Ada Lovelace", customerEmail: "ada@example.com", items: [],
}

const OXXO_PAYMENT = {
  id: 777, status: "pending", payment_type_id: "ticket", payment_method_id: "oxxo",
  external_reference: "order_1", transaction_amount: 2000, currency_id: "MXN",
  date_of_expiration: "2026-08-29T10:00:00.000-06:00",
  transaction_details: { external_resource_url: "https://www.mercadopago.com.mx/payments/777/ticket" },
}

function mockRes() {
  const res = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}
function req(id = "777") {
  return { headers: { "x-request-id": `req-${Math.random()}` }, body: { type: "payment", data: { id } }, query: {} }
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.FRONTEND_URL = "https://mustaphaukizuru.com"
})

test("pending OXXO webhook: order stays pending, one pending email, no fulfilment", async () => {
  mp.getMercadoPagoPayment.mockResolvedValue(OXXO_PAYMENT)
  mp.markOrderPaidByMP.mockResolvedValue({
    order: ORDER, isFirstTransition: true, isFirstPaid: false, amountMismatch: null,
    pendingDetails: mp.describePendingPayment(OXXO_PAYMENT),
  })

  await webhook(req(), mockRes())

  expect(mp.markOrderPaidByMP).toHaveBeenCalledWith(expect.objectContaining({ orderId: "order_1", status: "pending" }))
  expect(sendTemplateEmail).toHaveBeenCalledTimes(1)
  const call = sendTemplateEmail.mock.calls[0][0]
  expect(call.templateKey).toBe("order.payment-pending")
  expect(call.to).toBe("ada@example.com")
  expect(call.locale).toBe("es")
  expect(call.variables).toMatchObject({
    orderNumber: "MU-1",
    methodLabel: "OXXO",
    voucherUrl:  "https://www.mercadopago.com.mx/payments/777/ticket",
  })
  expect(call.variables.expiresAt).toContain("2026")
  expect(fulfillOrder).not.toHaveBeenCalled()
  expect(recordOrderEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "order.payment_pending" }))
})

test("redelivered pending webhook (Payment row already exists) sends no second email", async () => {
  mp.getMercadoPagoPayment.mockResolvedValue(OXXO_PAYMENT)
  mp.markOrderPaidByMP.mockResolvedValue({
    order: ORDER, isFirstTransition: false, isFirstPaid: false, amountMismatch: null,
    pendingDetails: mp.describePendingPayment(OXXO_PAYMENT),
  })

  await webhook(req(), mockRes())

  expect(sendTemplateEmail).not.toHaveBeenCalled()
  expect(fulfillOrder).not.toHaveBeenCalled()
})

test("approved webhook for the same payment flips to paid: confirmation email + fulfilment fire once", async () => {
  const approved = { ...OXXO_PAYMENT, status: "approved" }
  mp.getMercadoPagoPayment.mockResolvedValue(approved)
  mp.markOrderPaidByMP.mockResolvedValue({
    order: { ...ORDER, status: "paid" }, isFirstTransition: false, isFirstPaid: true, amountMismatch: null,
    pendingDetails: null,
  })

  await webhook(req(), mockRes())

  expect(sendTemplateEmail).toHaveBeenCalledTimes(1)
  expect(sendTemplateEmail.mock.calls[0][0].templateKey).toBe("order.confirmed")
  expect(fulfillOrder).toHaveBeenCalledWith("order_1")
  expect(recordOrderEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "order.paid" }))
})

test("late approved redelivery on an already-paid order fires nothing", async () => {
  mp.getMercadoPagoPayment.mockResolvedValue({ ...OXXO_PAYMENT, status: "approved" })
  mp.markOrderPaidByMP.mockResolvedValue({
    order: { ...ORDER, status: "paid" }, isFirstTransition: false, isFirstPaid: false, amountMismatch: null, pendingDetails: null,
  })

  await webhook(req(), mockRes())

  expect(sendTemplateEmail).not.toHaveBeenCalled()
  expect(fulfillOrder).not.toHaveBeenCalled()
})
