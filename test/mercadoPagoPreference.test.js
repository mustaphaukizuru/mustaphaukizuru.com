// ─────────────────────────────────────────────────────────────────────────────
// mercadoPagoService.createMercadoPagoPreference — domestic payment methods
// (Tier 1 §5.2): installments (MSI), OXXO cash, SPEI transfer, voucher expiry.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  order: {
    findUnique: jest.fn(),
    update:     jest.fn().mockResolvedValue({}),
  },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))

const prisma = require("../src/lib/prisma")
const {
  createMercadoPagoPreference,
  buildPaymentMethodsConfig,
  describePendingPayment,
  parsePendingPaymentDetails,
  formatMpDate,
} = require("../src/services/mercadoPagoService")

const ENV_KEYS = [
  "MP_MAX_INSTALLMENTS", "MP_DEFAULT_INSTALLMENTS", "MP_MSI_MIN_AMOUNT",
  "MP_ENABLE_CASH", "MP_ENABLE_BANK_TRANSFER", "MP_CASH_EXPIRY_HOURS",
]

function order({ totalAmount = 2000 } = {}) {
  return {
    id: "order_1", totalAmount, currency: "MXN", customerName: "Ada Lovelace", customerEmail: "ada@example.com",
    items: [{ id: "i1", productId: "p1", title: "Template", quantity: 1, unitPrice: totalAmount }],
  }
}

async function createAndCaptureBody(o = order()) {
  prisma.order.findUnique.mockResolvedValueOnce(o)
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: "pref_1", init_point: "https://mp/init", sandbox_init_point: "https://mp/sandbox" }),
  })
  await createMercadoPagoPreference({ orderId: o.id })
  return JSON.parse(global.fetch.mock.calls[0][1].body)
}

beforeEach(() => {
  jest.clearAllMocks()
  for (const k of ENV_KEYS) delete process.env[k]
  process.env.MP_ACCESS_TOKEN = "TEST-token"
  process.env.FRONTEND_URL = "http://localhost:5173"
})

describe("buildPaymentMethodsConfig", () => {
  test("defaults: 12 installments above the MSI floor, 1 default, nothing excluded, 72 h expiry", () => {
    const now = new Date("2026-08-26T10:00:00.000Z")
    const cfg = buildPaymentMethodsConfig({ amount: 1500, now })
    expect(cfg.payment_methods).toEqual({ installments: 12, default_installments: 1, excluded_payment_types: [] })
    expect(cfg.expiresAt.getTime() - now.getTime()).toBe(72 * 60 * 60 * 1000)
    expect(cfg.date_of_expiration).toBe(formatMpDate(cfg.expiresAt))
  })

  test("below MP_MSI_MIN_AMOUNT installments collapse to 1", () => {
    const cfg = buildPaymentMethodsConfig({ amount: 1499.99 })
    expect(cfg.payment_methods.installments).toBe(1)
    expect(cfg.payment_methods.default_installments).toBe(1)
  })

  test("env overrides drive ceiling, default, floor and expiry", () => {
    process.env.MP_MAX_INSTALLMENTS = "6"
    process.env.MP_DEFAULT_INSTALLMENTS = "3"
    process.env.MP_MSI_MIN_AMOUNT = "500"
    process.env.MP_CASH_EXPIRY_HOURS = "24"
    const now = new Date("2026-08-26T10:00:00.000Z")
    const cfg = buildPaymentMethodsConfig({ amount: 600, now })
    expect(cfg.payment_methods.installments).toBe(6)
    expect(cfg.payment_methods.default_installments).toBe(3)
    expect(cfg.expiresAt.getTime() - now.getTime()).toBe(24 * 60 * 60 * 1000)
  })

  test("MP_ENABLE_CASH=false / MP_ENABLE_BANK_TRANSFER=false exclude ticket / bank_transfer", () => {
    process.env.MP_ENABLE_CASH = "false"
    expect(buildPaymentMethodsConfig({ amount: 100 }).payment_methods.excluded_payment_types).toEqual([{ id: "ticket" }])

    process.env.MP_ENABLE_BANK_TRANSFER = "0"
    const both = buildPaymentMethodsConfig({ amount: 100 })
    expect(both.payment_methods.excluded_payment_types).toEqual([{ id: "ticket" }, { id: "bank_transfer" }])
    // Nothing left to expire → no date_of_expiration on the preference.
    expect(both.date_of_expiration).toBeUndefined()
    expect(both.expiresAt).toBeNull()
  })

  test("formatMpDate emits ISO-8601 with milliseconds and a numeric UTC offset (no Z)", () => {
    const s = formatMpDate(new Date("2026-08-26T10:00:00.000Z"))
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/)
    expect(new Date(s).getTime()).toBe(Date.UTC(2026, 7, 26, 10, 0, 0))
  })
})

describe("createMercadoPagoPreference", () => {
  test("preference carries payment_methods + date_of_expiration", async () => {
    const body = await createAndCaptureBody(order({ totalAmount: 2000 }))
    expect(body.payment_methods).toEqual({ installments: 12, default_installments: 1, excluded_payment_types: [] })
    expect(body.date_of_expiration).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/)
    const expires = new Date(body.date_of_expiration).getTime()
    expect(expires - Date.now()).toBeGreaterThan(71 * 60 * 60 * 1000)
    expect(expires - Date.now()).toBeLessThanOrEqual(72 * 60 * 60 * 1000)
    expect(body.back_urls.pending).toContain("pending=true")
  })

  test("small order → single installment", async () => {
    const body = await createAndCaptureBody(order({ totalAmount: 299 }))
    expect(body.payment_methods.installments).toBe(1)
  })

  test("cash + transfer disabled → both types excluded and no expiry sent", async () => {
    process.env.MP_ENABLE_CASH = "false"
    process.env.MP_ENABLE_BANK_TRANSFER = "false"
    const body = await createAndCaptureBody()
    expect(body.payment_methods.excluded_payment_types).toEqual([{ id: "ticket" }, { id: "bank_transfer" }])
    expect(body.date_of_expiration).toBeUndefined()
  })
})

describe("describePendingPayment / parsePendingPaymentDetails", () => {
  const oxxo = {
    status: "pending", payment_type_id: "ticket", payment_method_id: "oxxo",
    date_of_expiration: "2026-08-29T10:00:00.000-06:00",
    transaction_details: { external_resource_url: "https://www.mercadopago.com.mx/payments/123/ticket" },
  }

  test("OXXO pending → voucher descriptor", () => {
    expect(describePendingPayment(oxxo)).toEqual({
      type: "ticket", methodId: "oxxo",
      voucherUrl: "https://www.mercadopago.com.mx/payments/123/ticket",
      expiresAt: "2026-08-29T10:00:00.000-06:00",
    })
  })

  test("SPEI in_process → descriptor; card pending / approved ticket → null", () => {
    expect(describePendingPayment({ status: "in_process", payment_type_id: "bank_transfer", payment_method_id: "clabe" }))
      .toMatchObject({ type: "bank_transfer", methodId: "clabe", voucherUrl: null })
    expect(describePendingPayment({ status: "pending", payment_type_id: "credit_card" })).toBeNull()
    expect(describePendingPayment({ ...oxxo, status: "approved" })).toBeNull()
    expect(describePendingPayment(null)).toBeNull()
  })

  test("round-trips through the Payment.failureReason encoding", () => {
    const details = describePendingPayment(oxxo)
    const row = { paymentStatus: "pending", failureReason: JSON.stringify({ kind: "offline_pending", ...details }) }
    expect(parsePendingPaymentDetails(row)).toEqual(details)
    expect(parsePendingPaymentDetails({ paymentStatus: "failed", failureReason: "MP status: rejected" })).toBeNull()
    expect(parsePendingPaymentDetails({ paymentStatus: "pending", failureReason: "not json" })).toBeNull()
    expect(parsePendingPaymentDetails(undefined)).toBeNull()
  })
})
