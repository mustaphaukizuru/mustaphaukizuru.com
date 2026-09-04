// ─────────────────────────────────────────────────────────────────────────────
// T0-5 · errorHandler masks unexpected 5xx messages in production.
//
// An error that never chose a status is a stack-trace message: file paths,
// SQL fragments, provider bodies. Those must not reach the client in
// production. Errors that set a status (AppError, refundService's withCode)
// wrote their message for the client and keep it — at any status.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))

const errorHandler = require("../src/middleware/errorHandler")
const AppError     = require("../src/utils/AppError")
const logger       = require("../src/utils/logger")

function run(err, { env = "production", url = "/api/v1/things" } = {}) {
  const prev = process.env.NODE_ENV
  process.env.NODE_ENV = env
  const res = {
    headersSent: false, statusCode: 0, body: null,
    status(code) { this.statusCode = code; return this },
    json(body)   { this.body = body; return this },
    setHeader()  {}, send() {},
  }
  try {
    errorHandler(err, { originalUrl: url, headers: {} }, res, () => {})
  } finally {
    process.env.NODE_ENV = prev
  }
  return res
}

beforeEach(() => jest.clearAllMocks())

test("a bare throw in production → 500 with a generic message and code; the real message is logged", () => {
  const res = run(new Error("ENOENT: no such file or directory, open '/home/u/hbuilds/config/private.pem'"))
  expect(res.statusCode).toBe(500)
  expect(res.body.message).toBe("Something went wrong. Please try again.")
  expect(res.body.code).toBe("INTERNAL_ERROR")
  expect(res.body.error.message).toBe("Something went wrong. Please try again.")
  expect(JSON.stringify(res.body)).not.toMatch(/private\.pem|ENOENT/)
  expect(res.body.stack).toBeUndefined()
  expect(logger.error).toHaveBeenCalledWith("[Error]", 500, "Error", expect.stringContaining("private.pem"), "")
})

test("a Node system error's code does not leak either", () => {
  // (ECONNREFUSED is routed to the DB_UNAVAILABLE branch earlier; EACCES is not.)
  const res = run(Object.assign(new Error("EACCES: permission denied, open '/home/u/storage/invoices/INV-1.pdf'"), { code: "EACCES" }))
  expect(res.statusCode).toBe(500)
  expect(res.body.code).toBe("INTERNAL_ERROR")
  expect(res.body.message).not.toMatch(/EACCES|storage/)
})

test("outside production the message is kept, with a short stack for the developer", () => {
  const res = run(new Error("ENOENT: open '/tmp/x'"), { env: "development" })
  expect(res.statusCode).toBe(500)
  expect(res.body.message).toBe("ENOENT: open '/tmp/x'")
  expect(Array.isArray(res.body.stack)).toBe(true)
})

test("a deliberate 502 from refundService (withCode shape) keeps its message in production", () => {
  const err = Object.assign(new Error("Refund declined by paypal: PayPal rejected the refund request (HTTP 422)"), {
    code: "GATEWAY_ERROR", status: 502, details: { provider: "paypal" },
  })
  const res = run(err)
  expect(res.statusCode).toBe(502)
  expect(res.body.code).toBe("GATEWAY_ERROR")
  expect(res.body.message).toMatch(/Refund declined by paypal/)
  expect(res.body.error.details).toEqual({ provider: "paypal" })
})

test("an AppError 502 keeps its message and code in production", () => {
  const res = run(new AppError("PayPal did not answer the access token request within 10000 ms", { statusCode: 502, code: "GATEWAY_TIMEOUT" }))
  expect(res.statusCode).toBe(502)
  expect(res.body).toMatchObject({ code: "GATEWAY_TIMEOUT", message: expect.stringMatching(/did not answer/) })
})

test("4xx messages are never masked", () => {
  const res = run(Object.assign(new Error("Coupon has expired"), { statusCode: 400, code: "COUPON_INVALID" }))
  expect(res.statusCode).toBe(400)
  expect(res.body).toMatchObject({ code: "COUPON_INVALID", message: "Coupon has expired" })
})
