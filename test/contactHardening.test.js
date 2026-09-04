// ─────────────────────────────────────────────────────────────────────────────
// contactController — T3 funnel hardening
//
// Covers: honeypot + submit-timing silent 200s, funnel attribution persisted
// (intent/audience/tier/source/locale/ip/ua) with unsafe values dropped, and
// optional Turnstile enforcement (400 CAPTCHA_FAILED / skipped when unset).
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/utils/logger", () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() }))
jest.mock("../src/services/contactService", () => ({ createContactMessage: jest.fn() }))
jest.mock("../src/services/notificationService", () => ({ notifyContactReceived: jest.fn(() => Promise.resolve()) }))
jest.mock("../src/services/emailService", () => ({ sendTemplateEmail: jest.fn(() => Promise.resolve()) }))
jest.mock("../src/utils/resolveUserLocale", () => ({ resolveUserLocale: jest.fn(() => "es") }))
jest.mock("../src/controllers/newsletterController", () => ({ subscribe: jest.fn() }))

const logger = require("../src/utils/logger")
const { createContactMessage } = require("../src/services/contactService")
const { sendContactMessage } = require("../src/controllers/contactController")

function mockRes() {
  const res = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

function mockReq(body, extra = {}) {
  return {
    body,
    ip: "203.0.113.9",
    get: (h) => (h.toLowerCase() === "user-agent" ? "jest-agent/1.0" : undefined),
    ...extra,
  }
}

const VALID = {
  name: "Ada Lovelace",
  email: "Ada@Example.com",
  subject: "Hello",
  message: "This is a sufficiently long message.",
}

// asyncHandler does not return the promise, so wait until the handler has
// either responded or forwarded an error to next().
async function run(body, extra) {
  const req = mockReq(body, extra)
  const res = mockRes()
  const next = jest.fn()
  sendContactMessage(req, res, next)
  for (let i = 0; i < 50 && res.json.mock.calls.length === 0 && next.mock.calls.length === 0; i++) {
    await new Promise((r) => setImmediate(r))
  }
  if (next.mock.calls.length) throw next.mock.calls[0][0]
  return res
}

beforeEach(() => {
  jest.clearAllMocks()
  createContactMessage.mockResolvedValue({ id: "cm_1" })
  delete process.env.TURNSTILE_SECRET_KEY
  delete process.env.CONTACT_MIN_SUBMIT_MS
  global.fetch = jest.fn()
})

describe("bot signals → silent 200", () => {
  test("honeypot filled", async () => {
    const res = await run({ ...VALID, website: "http://spam" })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json.mock.calls[0][0].success).toBe(true)
    expect(createContactMessage).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("honeypot"))
  })

  test("submitted < 3 s after the form rendered", async () => {
    const res = await run({ ...VALID, formStartedAt: Date.now() - 500 })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(createContactMessage).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("too fast"))
  })

  test("CONTACT_MIN_SUBMIT_MS overrides the threshold", async () => {
    process.env.CONTACT_MIN_SUBMIT_MS = "10000"
    const res = await run({ ...VALID, formStartedAt: Date.now() - 5000 })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(createContactMessage).not.toHaveBeenCalled()
  })

  test("slow enough / missing / garbage formStartedAt passes through", async () => {
    for (const formStartedAt of [Date.now() - 10_000, undefined, "abc", -5]) {
      createContactMessage.mockClear()
      const res = await run({ ...VALID, formStartedAt })
      expect(res.status).toHaveBeenCalledWith(201)
      expect(createContactMessage).toHaveBeenCalledTimes(1)
    }
  })
})

describe("funnel attribution", () => {
  test("persists intent/audience/tier/source/locale/ip/ua", async () => {
    const res = await run({
      ...VALID,
      intent: "plan",
      audience: "education",
      tier: "advanced",
      source: "services/pricing",
      formStartedAt: Date.now() - 20_000,
    })
    expect(res.status).toHaveBeenCalledWith(201)
    expect(createContactMessage).toHaveBeenCalledWith(expect.objectContaining({
      name: "Ada Lovelace",
      email: "ada@example.com",
      intent: "plan",
      audience: "education",
      tier: "advanced",
      source: "services/pricing",
      locale: "es",
      ipAddress: "203.0.113.9",
      userAgent: "jest-agent/1.0",
    }))
  })

  test("drops values that fail the whitelist and defaults source", async () => {
    await run({ ...VALID, intent: "<script>", audience: "x".repeat(40), tier: "pro tier" })
    const data = createContactMessage.mock.calls[0][0]
    expect(data.intent).toBeNull()
    expect(data.audience).toBeNull()
    expect(data.tier).toBeNull()
    expect(data.source).toBe("contact-form")
  })
})

describe("Turnstile", () => {
  test("not enforced when TURNSTILE_SECRET_KEY is unset", async () => {
    const res = await run({ ...VALID })
    expect(global.fetch).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(201)
  })

  test("400 CAPTCHA_FAILED when token missing", async () => {
    process.env.TURNSTILE_SECRET_KEY = "sec"
    const res = await run({ ...VALID })
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json.mock.calls[0][0].code).toBe("CAPTCHA_FAILED")
    expect(createContactMessage).not.toHaveBeenCalled()
  })

  test("400 CAPTCHA_FAILED when siteverify rejects", async () => {
    process.env.TURNSTILE_SECRET_KEY = "sec"
    global.fetch.mockResolvedValue({ json: async () => ({ success: false, "error-codes": ["invalid-input-response"] }) })
    const res = await run({ ...VALID, turnstileToken: "bad" })
    expect(global.fetch).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({ method: "POST" }),
    )
    const sent = global.fetch.mock.calls[0][1].body
    expect(sent).toContain("secret=sec")
    expect(sent).toContain("response=bad")
    expect(sent).toContain("remoteip=203.0.113.9")
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json.mock.calls[0][0].code).toBe("CAPTCHA_FAILED")
  })

  test("400 CAPTCHA_FAILED when siteverify throws (fail closed)", async () => {
    process.env.TURNSTILE_SECRET_KEY = "sec"
    global.fetch.mockRejectedValue(new Error("network"))
    const res = await run({ ...VALID, turnstileToken: "tok" })
    expect(res.status).toHaveBeenCalledWith(400)
    expect(logger.error).toHaveBeenCalled()
  })

  test("passes when siteverify succeeds", async () => {
    process.env.TURNSTILE_SECRET_KEY = "sec"
    global.fetch.mockResolvedValue({ json: async () => ({ success: true }) })
    const res = await run({ ...VALID, turnstileToken: "good" })
    expect(res.status).toHaveBeenCalledWith(201)
    expect(createContactMessage).toHaveBeenCalledTimes(1)
  })

  test("validation errors short-circuit before siteverify is called", async () => {
    process.env.TURNSTILE_SECRET_KEY = "sec"
    const res = await run({ ...VALID, email: "nope", turnstileToken: "tok" })
    expect(res.status).toHaveBeenCalledWith(400)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
