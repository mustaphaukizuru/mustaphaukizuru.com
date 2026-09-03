// ─────────────────────────────────────────────────────────────────────────────
// T0-5 · provider HTTP hygiene — timeouts, masked bodies, one token request.
//
// PROVIDER_TIMEOUT_MS is set low so "a gateway that never answers" resolves
// in tens of milliseconds instead of the production ten seconds. The hung
// fetch honours the AbortSignal the way undici does.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
jest.mock("../src/lib/prisma", () => ({
  order: { findUnique: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
}))

const logger = require("../src/utils/logger")

const hang = () => jest.fn((url, init) => new Promise((_, reject) => {
  init.signal.addEventListener("abort", () => reject(init.signal.reason))
}))
const reply = (status, body = {}, text = JSON.stringify(body)) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => text })
const tokenReply = () => reply(200, { access_token: "tok", expires_in: 3600 })

function fresh(modulePath) {
  let m
  jest.isolateModules(() => { m = require(modulePath) })
  return m
}
const freshPaypal = () => fresh("../src/services/paypalService")
const freshMp     = () => fresh("../src/services/mercadoPagoService")

beforeEach(() => {
  jest.clearAllMocks()
  process.env.PROVIDER_TIMEOUT_MS   = "40"
  process.env.PAYPAL_CLIENT_ID      = "id"
  process.env.PAYPAL_CLIENT_SECRET  = "secret"
  process.env.MP_ACCESS_TOKEN       = "mp-token"
})
afterEach(() => {
  delete process.env.PROVIDER_TIMEOUT_MS
  delete global.fetch
})

describe("timeouts", () => {
  test("a PayPal endpoint that never answers → 502 GATEWAY_TIMEOUT, quickly, with the signal attached", async () => {
    global.fetch = hang()
    const { createPaypalOrder } = freshPaypal()

    const started = Date.now()
    await expect(createPaypalOrder({ orderId: "o1", orderNumber: "N-1", totalAmount: 10 }))
      .rejects.toMatchObject({ statusCode: 502, code: "GATEWAY_TIMEOUT", name: "AppError" })
    expect(Date.now() - started).toBeLessThan(2000)

    expect(global.fetch).toHaveBeenCalledTimes(1) // the token call hung; nothing else was tried
    expect(global.fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  })

  test("a Mercado Pago payment lookup that times out propagates; other failures still return null", async () => {
    global.fetch = hang()
    let mp = freshMp()
    await expect(mp.getMercadoPagoPayment("123")).rejects.toMatchObject({ code: "GATEWAY_TIMEOUT" })

    global.fetch = jest.fn(async () => reply(500, {}, "boom"))
    mp = freshMp()
    await expect(mp.getMercadoPagoPayment("123")).resolves.toBeNull()

    global.fetch = jest.fn(async () => { throw new Error("ECONNRESET") })
    mp = freshMp()
    await expect(mp.getMercadoPagoPayment("123")).resolves.toBeNull()
  })

  test("the default timeout is ten seconds and the override must be a positive number", () => {
    const { providerTimeoutMs, DEFAULT_TIMEOUT_MS } = fresh("../src/lib/providerHttp")
    expect(providerTimeoutMs()).toBe(40)
    process.env.PROVIDER_TIMEOUT_MS = "not-a-number"
    expect(providerTimeoutMs()).toBe(DEFAULT_TIMEOUT_MS)
    process.env.PROVIDER_TIMEOUT_MS = "-5"
    expect(providerTimeoutMs()).toBe(10_000)
  })
})

describe("provider bodies stay on the server", () => {
  test("a failed PayPal token call logs the body and throws a 502 without it", async () => {
    global.fetch = jest.fn(async () => reply(401, {}, "SECRET-DEBUG-TEXT client_id=abc"))
    const { createPaypalOrder } = freshPaypal()

    let caught
    try { await createPaypalOrder({ orderId: "o1", orderNumber: "N-1", totalAmount: 10 }) } catch (e) { caught = e }
    expect(caught).toMatchObject({ statusCode: 502, code: "GATEWAY_ERROR", details: { provider: "PayPal", action: "access token", status: 401 } })
    expect(caught.message).not.toMatch(/SECRET-DEBUG/)
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("SECRET-DEBUG-TEXT"))
  })

  test("a rejected Mercado Pago refund hides the body and carries the Refund row id as the idempotency key", async () => {
    global.fetch = jest.fn(async () => reply(400, {}, "cc_rejected SECRET-BODY"))
    const { refundMercadoPagoPayment } = freshMp()

    let caught
    try { await refundMercadoPagoPayment({ paymentId: "1", amount: 5, refundId: "refund_abc" }) } catch (e) { caught = e }
    expect(caught).toMatchObject({ statusCode: 502, code: "GATEWAY_ERROR" })
    expect(caught.message).not.toMatch(/SECRET-BODY/)
    expect(global.fetch.mock.calls[0][1].headers["X-Idempotency-Key"]).toBe("refund-refund_abc")
  })

  test("ORDER_ALREADY_CAPTURED on capture is still recovered by re-reading the order", async () => {
    global.fetch = jest.fn(async (url, init) => {
      if (String(url).includes("/oauth2/token")) return tokenReply()
      if (init?.method === "POST") return reply(422, {}, '{"name":"UNPROCESSABLE_ENTITY","details":[{"issue":"ORDER_ALREADY_CAPTURED"}]}')
      return reply(200, { id: "PP-1", status: "COMPLETED" })
    })
    const { capturePaypalOrder } = freshPaypal()
    // First GET (pre-flight) says CREATED so the POST runs; the fallback GET says COMPLETED.
    global.fetch.mockImplementationOnce(async () => tokenReply())
      .mockImplementationOnce(async () => reply(200, { id: "PP-1", status: "CREATED" }))
    await expect(capturePaypalOrder("PP-1")).resolves.toMatchObject({ status: "COMPLETED", _idempotent: true })
  })
})

describe("PayPal access token", () => {
  test("concurrent callers share one in-flight token request, later callers hit the cache", async () => {
    global.fetch = jest.fn(async (url) => (String(url).includes("/oauth2/token") ? tokenReply() : reply(200, { id: "x" })))
    const { getAccessToken } = freshPaypal()

    const tokens = await Promise.all([getAccessToken(), getAccessToken(), getAccessToken()])
    expect(tokens).toEqual(["tok", "tok", "tok"])
    expect(global.fetch).toHaveBeenCalledTimes(1)

    await expect(getAccessToken()).resolves.toBe("tok")
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  test("a failed token request does not poison the next attempt", async () => {
    global.fetch = jest.fn(async () => reply(500, {}, "down"))
    const { getAccessToken } = freshPaypal()
    await expect(getAccessToken()).rejects.toMatchObject({ code: "GATEWAY_ERROR" })

    global.fetch.mockImplementation(async () => tokenReply())
    await expect(getAccessToken()).resolves.toBe("tok")
  })

  test("refunds send the Refund row id as PayPal-Request-Id, with a deterministic fallback", async () => {
    global.fetch = jest.fn(async (url) => (String(url).includes("/oauth2/token") ? tokenReply() : reply(200, { id: "R-1" })))
    const { refundPaypalCapture } = freshPaypal()

    await refundPaypalCapture("CAP-1", { amount: 5, currency: "MXN", refundId: "refund_abc" })
    await refundPaypalCapture("CAP-1", { amount: 5, currency: "MXN" })

    const refundCalls = global.fetch.mock.calls.filter(([url]) => String(url).includes("/refund"))
    expect(refundCalls.map(([, init]) => init.headers["PayPal-Request-Id"])).toEqual([
      "refund-refund_abc",
      "refund-CAP-1-5.00",
    ])
  })
})
