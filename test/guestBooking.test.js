// ─────────────────────────────────────────────────────────────────────────────
// Guest booking (Tier 3) · POST /api/v1/consultations without a session.
//
// Mirrors the guest-checkout contract in orderController:
//   · new email        → passwordless account + claim email + booking email
//   · claimed account  → 401 ACCOUNT_EXISTS, no booking row
//   · signed-in user   → books as req.user, no account lookup, no claim email
//   · missing email    → 400 VALIDATION_ERROR
//   · paid booking     → 401 LOGIN_REQUIRED_FOR_PAID_BOOKING (never auto-creates)
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({ consultation: { findUnique: jest.fn() } }))
jest.mock("../src/utils/logger", () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }))
jest.mock("../src/services/consultationService", () => ({
  bookConsultation:           jest.fn(),
  rescheduleConsultation:     jest.fn(),
  cancelConsultation:         jest.fn(),
  listMyConsultations:        jest.fn(),
  getConsultationByIdForUser: jest.fn(),
  findByConfirmationToken:    jest.fn(),
}))
jest.mock("../src/services/authService", () => ({ findOrCreateUserForCheckout: jest.fn() }))
jest.mock("../src/services/emailService", () => ({ sendTemplateEmail: jest.fn(async () => ({ ok: true })) }))
jest.mock("../src/services/notificationService", () => ({}))
jest.mock("../src/lib/googleCalendar", () => ({ isConfigured: () => false, createCalendarEvent: jest.fn() }))
jest.mock("../src/utils/mailer", () => ({
  sendConsultationConfirmationEmail: jest.fn(async () => undefined),
  sendConsultationRescheduledEmail:  jest.fn(async () => undefined),
  sendConsultationCancelledEmail:    jest.fn(async () => undefined),
}))

const { create } = require("../src/controllers/consultationController")
const { bookConsultation } = require("../src/services/consultationService")
const { findOrCreateUserForCheckout } = require("../src/services/authService")
const { sendTemplateEmail } = require("../src/services/emailService")
const { sendConsultationConfirmationEmail } = require("../src/utils/mailer")

const SLOT = new Date(Date.now() + 3 * 24 * 3600_000).toISOString()
const BASE = { serviceId: "svc-1", startUtc: SLOT, timezone: "America/Mexico_City" }

function run(body, user = null) {
  const req = { body, user, headers: {}, get: () => undefined, query: {} }
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
  return new Promise((resolve, reject) => {
    create(req, res, reject)
    // asyncHandler resolves on the next tick once res.json ran
    const tick = () => (res.json.mock.calls.length ? resolve({ status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] }) : setImmediate(tick))
    tick()
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.FRONTEND_URL = "https://example.test"
  bookConsultation.mockImplementation(async (args) => ({
    id: "c-1", userId: args.userId, scheduledAt: SLOT, confirmationToken: "tok-1",
    user: { email: "x@example.com" },
  }))
})

describe("POST /api/v1/consultations · guest", () => {
  test("new email → account created, booking made, claim + confirmation emails sent", async () => {
    findOrCreateUserForCheckout.mockResolvedValueOnce({
      user: { id: "u-new", email: "new@example.com", fullName: "New Person" },
      isNew: true, claimToken: "claim-raw",
    })
    const { status, body } = await run({ ...BASE, customerName: "New Person", customerEmail: " New@example.com " })

    expect(status).toBe(201)
    expect(findOrCreateUserForCheckout).toHaveBeenCalledWith({ fullName: "New Person", email: "New@example.com" })
    expect(bookConsultation).toHaveBeenCalledWith(expect.objectContaining({ userId: "u-new", serviceId: "svc-1" }))
    expect(body.data).toMatchObject({ id: "c-1", isNewUser: true })

    await new Promise((r) => setImmediate(r))
    expect(sendConsultationConfirmationEmail).toHaveBeenCalledTimes(1)
    expect(sendTemplateEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "new@example.com", templateKey: "auth.account-claim", userId: "u-new",
      variables: expect.objectContaining({ customerName: "New", claimUrl: "https://example.test/reset-password/claim-raw?source=booking" }),
    }))
  })

  test("returning unclaimed checkout account → books, no claim email", async () => {
    findOrCreateUserForCheckout.mockResolvedValueOnce({
      user: { id: "u-old", email: "old@example.com", fullName: "Old" }, isNew: false, requiresLogin: false,
    })
    const { status, body } = await run({ ...BASE, customerName: "Old", customerEmail: "old@example.com" })
    expect(status).toBe(201)
    expect(body.data.isNewUser).toBe(false)
    expect(bookConsultation).toHaveBeenCalledWith(expect.objectContaining({ userId: "u-old" }))
    await new Promise((r) => setImmediate(r))
    expect(sendTemplateEmail).not.toHaveBeenCalled()
  })

  test("email of a claimed (password) account → 401 ACCOUNT_EXISTS and no booking", async () => {
    findOrCreateUserForCheckout.mockResolvedValueOnce({
      user: { id: "u-pw", email: "pw@example.com" }, isNew: false, requiresLogin: true,
    })
    const { status, body } = await run({ ...BASE, customerName: "Some One", customerEmail: "pw@example.com" })
    expect(status).toBe(401)
    expect(body.code).toBe("ACCOUNT_EXISTS")
    expect(bookConsultation).not.toHaveBeenCalled()
    expect(sendTemplateEmail).not.toHaveBeenCalled()
    expect(sendConsultationConfirmationEmail).not.toHaveBeenCalled()
  })

  test("missing email → 400 VALIDATION_ERROR (no account lookup)", async () => {
    const { status, body } = await run({ ...BASE, customerName: "No Email" })
    expect(status).toBe(400)
    expect(body.code).toBe("VALIDATION_ERROR")
    expect(findOrCreateUserForCheckout).not.toHaveBeenCalled()
    expect(bookConsultation).not.toHaveBeenCalled()
  })

  test("malformed email → 400; missing name → 400", async () => {
    let r = await run({ ...BASE, customerName: "X", customerEmail: "not-an-email" })
    expect(r.status).toBe(400)
    r = await run({ ...BASE, customerEmail: "ok@example.com" })
    expect(r.status).toBe(400)
    expect(r.body.message).toMatch(/customerName/)
    expect(findOrCreateUserForCheckout).not.toHaveBeenCalled()
  })

  test("paid booking (serviceOrderId) without a session → 401 LOGIN_REQUIRED_FOR_PAID_BOOKING, no account created", async () => {
    const { status, body } = await run({ ...BASE, serviceOrderId: "so-1", customerName: "P", customerEmail: "p@example.com" })
    expect(status).toBe(401)
    expect(body.code).toBe("LOGIN_REQUIRED_FOR_PAID_BOOKING")
    expect(findOrCreateUserForCheckout).not.toHaveBeenCalled()
    expect(bookConsultation).not.toHaveBeenCalled()
  })

  test("auto-account failure → 500 AUTO_ACCOUNT_FAILED", async () => {
    findOrCreateUserForCheckout.mockRejectedValueOnce(new Error("db down"))
    const { status, body } = await run({ ...BASE, customerName: "Z", customerEmail: "z@example.com" })
    expect(status).toBe(500)
    expect(body.code).toBe("AUTO_ACCOUNT_FAILED")
  })
})

describe("POST /api/v1/consultations · signed-in", () => {
  test("books as req.user; ignores customer fields; no account lookup or claim email", async () => {
    const { status, body } = await run(
      { ...BASE, customerName: "Spoof", customerEmail: "spoof@example.com", serviceOrderId: "so-9" },
      { id: "u-me", role: "user" },
    )
    expect(status).toBe(201)
    expect(findOrCreateUserForCheckout).not.toHaveBeenCalled()
    expect(bookConsultation).toHaveBeenCalledWith(expect.objectContaining({ userId: "u-me", serviceOrderId: "so-9" }))
    expect(body.data.isNewUser).toBe(false)
    await new Promise((r) => setImmediate(r))
    expect(sendConsultationConfirmationEmail).toHaveBeenCalledTimes(1)
    expect(sendTemplateEmail).not.toHaveBeenCalled()
  })

  test("missing startUtc/timezone → 400 BAD_REQUEST regardless of session", async () => {
    const { status, body } = await run({ timezone: "UTC" }, { id: "u-me" })
    expect(status).toBe(400)
    expect(body.code).toBe("BAD_REQUEST")
  })
})

describe("consultationRoutes · POST / is soft-auth", () => {
  test("uses attachUserIfPresent (not protect) on the create route", () => {
    jest.isolateModules(() => {
      const mw = { protect: jest.fn((req, res, next) => next()), attachUserIfPresent: jest.fn((req, res, next) => next()) }
      jest.doMock("../src/middleware/authMiddleware", () => mw)
      jest.doMock("../src/middleware/rateLimiter", () => ({ paymentRateLimiter: (req, res, next) => next() }))
      const router = require("../src/routes/consultationRoutes")
      const post = router.stack.find((l) => l.route?.path === "/" && l.route.methods.post)
      expect(post).toBeTruthy()
      expect(post.route.stack.map((s) => s.handle)).toContain(mw.attachUserIfPresent)
      expect(post.route.stack.map((s) => s.handle)).not.toContain(mw.protect)
      // Everything after POST / is still behind protect (router.use)
      const postIdx = router.stack.indexOf(post)
      const protectIdx = router.stack.findIndex((l) => l.handle === mw.protect)
      expect(protectIdx).toBeGreaterThan(postIdx)
    })
  })
})
