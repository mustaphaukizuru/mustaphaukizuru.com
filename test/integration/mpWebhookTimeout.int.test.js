/**
 * Integration · T0-5 · a Mercado Pago payment lookup that times out must
 * answer non-200 so MP redelivers — and the redelivery must be processed,
 * not dropped as a duplicate of the delivery that timed out.
 */
const crypto  = require("crypto")
const request = require("supertest")

process.env.PROVIDER_TIMEOUT_MS = "40"
const { buildApp } = require("../helpers/appFactory")

let ctx
beforeAll(() => { ctx = buildApp() })
afterAll(() => { delete process.env.PROVIDER_TIMEOUT_MS })

function mpSignature({ dataId, requestId, secret, ts = Date.now() }) {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`
  const v1 = crypto.createHmac("sha256", secret).update(manifest).digest("hex")
  return `ts=${ts},v1=${v1}`
}

const post = (requestId) => request(ctx.app)
  .post("/api/v1/mercadopago/webhook")
  .set("x-signature", mpSignature({ dataId: "MP-PAY-T", requestId, secret: ctx.TEST_MP_WEBHOOK_SECRET }))
  .set("x-request-id", requestId)
  .send({ type: "payment", action: "payment.updated", data: { id: "MP-PAY-T" } })

test("timeout on the payment lookup → 500, audit row released, same-id redelivery processed", async () => {
  ctx.mocks.fetch.mockImplementation((url, init) => new Promise((_, reject) => {
    init.signal.addEventListener("abort", () => reject(init.signal.reason))
  }))

  const res = await post("req-timeout-1")
  expect(res.status).toBe(500)
  expect(res.body).toEqual({ received: false, error: "gateway_timeout" })
  expect(ctx.prisma.rows("paymentWebhook").find((w) => w.gatewayEventId === "req-timeout-1")).toBeUndefined()

  // MP redelivers with the same x-request-id; this time the lookup answers.
  ctx.mocks.fetch.mockImplementation(async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => "not found" }))
  const again = await post("req-timeout-1")
  expect(again.status).toBe(200)
  expect(again.body).toEqual({ received: true })
  expect(ctx.prisma.rows("paymentWebhook").find((w) => w.gatewayEventId === "req-timeout-1")).toBeDefined()
})

test("a permanent rejection still answers 200 so MP stops retrying", async () => {
  ctx.mocks.fetch.mockImplementation(async () => ({ ok: true, status: 200, json: async () => ({ id: "MP-PAY-T", status: "approved", external_reference: "no-such-order", transaction_amount: 1, currency_id: "MXN" }), text: async () => "" }))
  const res = await post("req-permanent-1")
  expect(res.status).toBe(200)
})
