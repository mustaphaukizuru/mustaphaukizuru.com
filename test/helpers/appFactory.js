/**
 * Builds the real Express app (src/app.js) for supertest, with:
 *   - env stubbed (64-char JWT secret, dummy DATABASE_URL, CLIENT_URL,
 *     NODE_ENV=test, DISABLE_CRON=1, no SENTRY_DSN, MP webhook secret set so
 *     signature verification is exercised for real)
 *   - src/lib/prisma replaced by the in-memory fake (test/helpers/fakePrisma)
 *   - every outbound side-effect module mocked: email, notifications,
 *     Google Calendar, PayPal HTTP client, PDF generators, winston logger.
 *     Mercado Pago is NOT module-mocked — its service is exercised for real
 *     and only `global.fetch` is stubbed, so the HMAC path runs.
 *
 * Call `buildApp()` once per test file (it calls jest.resetModules()). It
 * returns { app, prisma, mocks, signToken, signAdminToken, seedUser }.
 *
 * Uses jest.doMock (not jest.mock) so this helper works outside of the
 * babel hoisting pass and can close over the fake instance.
 */
const path = require("path")
const jwt  = require("jsonwebtoken")
const { createFakePrisma } = require("./fakePrisma")

const ROOT = path.resolve(__dirname, "..", "..")
const SRC  = (p) => path.join(ROOT, "src", p)

const TEST_JWT_SECRET = "t".repeat(64)
const TEST_MP_WEBHOOK_SECRET = "mp-webhook-secret-for-tests"

function stubEnv() {
  process.env.NODE_ENV      = "test"
  process.env.JWT_SECRET    = TEST_JWT_SECRET
  process.env.DATABASE_URL  = "mysql://test:test@127.0.0.1:1/test_db"
  process.env.CLIENT_URL    = "http://localhost:5173"
  process.env.FRONTEND_URL  = "http://localhost:5173"
  process.env.DISABLE_CRON  = "1"
  process.env.MP_ACCESS_TOKEN    = "TEST-mp-access-token"
  process.env.MP_WEBHOOK_SECRET  = TEST_MP_WEBHOOK_SECRET
  process.env.PAYPAL_CLIENT_ID     = "test-paypal-id"
  process.env.PAYPAL_CLIENT_SECRET = "test-paypal-secret"
  process.env.PAYPAL_WEBHOOK_ID    = "test-webhook-id"
  delete process.env.SENTRY_DSN
  delete process.env.GOOGLE_CLIENT_ID
  delete process.env.GOOGLE_CLIENT_SECRET
  delete process.env.GOOGLE_OAUTH_REFRESH_TOKEN
}

function noopLogger() {
  const l = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), http: jest.fn(), verbose: jest.fn() }
  l.child = () => l
  return l
}

function buildApp({ prisma = createFakePrisma() } = {}) {
  jest.resetModules()
  stubEnv()

  const mocks = {
    // PayPal HTTP client — every call is a jest.fn the test can prime.
    paypalService: {
      createPaypalOrder:           jest.fn(async ({ orderId }) => ({ id: `PP-${orderId}`, status: "CREATED", links: [] })),
      capturePaypalOrder:          jest.fn(),
      refundPaypalCapture:         jest.fn(async () => ({ id: "PP-REFUND-1", status: "COMPLETED" })),
      verifyPaypalWebhookSignature: jest.fn(async () => true),
      getAccessToken:              jest.fn(async () => "token"),
    },
    emailService: {
      sendTemplateEmail: jest.fn(async () => ({ ok: true })),
      sendRawEmail:      jest.fn(async () => ({ ok: true })),
      renderTemplate:    jest.fn(() => ({ subject: "", html: "", text: "" })),
      htmlToText:        jest.fn((s) => s),
      esc:               jest.fn((s) => s),
      fromAddress:       "test@example.com",
      supportEmail:      "support@example.com",
    },
    mailer: new Proxy({}, { get: (t, k) => (k in t ? t[k] : (t[k] = jest.fn(async () => undefined))) }),
    notificationService: new Proxy({}, { get: (t, k) => (k in t ? t[k] : (t[k] = jest.fn(async () => undefined))) }),
    googleCalendar: {
      isConfigured:        jest.fn(() => false),
      diagnoseConfig:      jest.fn(() => "missing env: test"),
      buildAuthClient:     jest.fn(),
      createCalendarEvent: jest.fn(),
      updateCalendarEvent: jest.fn(),
      cancelCalendarEvent: jest.fn(),
      SCOPES: [],
      readConfig: jest.fn(() => ({})),
    },
    availabilityService: {
      getAvailableSlots:       jest.fn(async () => []),
      getAvailableDaysInMonth: jest.fn(async () => []),
      resolveHostUserId:       jest.fn(async () => "admin-host"),
      loadServicePolicy:       jest.fn(async () => ({ bookingDurationMin: 30, bookingRequiresPayment: false })),
      ACTIVE_BOOKING_STATUSES: ["pending", "confirmed", "scheduled"],
      listRules: jest.fn(), createRule: jest.fn(), updateRule: jest.fn(), deleteRule: jest.fn(),
      listExceptions: jest.fn(), createException: jest.fn(), deleteException: jest.fn(),
    },
    invoiceService: {
      ensureInvoice:  jest.fn(async (orderId) => ({ id: `inv-${orderId}`, orderId })),
      invoicePathFor: jest.fn(() => "/dev/null"),
      INVOICE_DIR:    "/dev/null",
    },
    receiptPdfService: {
      generateReceiptPdf: jest.fn(async () => Buffer.from("%PDF-fake")),
    },
    productService: {
      getProductBySlug: jest.fn(async () => null),
    },
    logger: noopLogger(),
    fetch: jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}), text: async () => "unmocked fetch" })),
  }

  jest.doMock(SRC("lib/prisma.js"), () => prisma)
  jest.doMock(SRC("lib/googleCalendar.js"), () => mocks.googleCalendar)
  jest.doMock(SRC("services/paypalService.js"), () => mocks.paypalService)
  jest.doMock(SRC("services/emailService.js"), () => mocks.emailService)
  jest.doMock(SRC("utils/mailer.js"), () => mocks.mailer)
  jest.doMock(SRC("services/notificationService.js"), () => mocks.notificationService)
  jest.doMock(SRC("services/availabilityService.js"), () => mocks.availabilityService)
  jest.doMock(SRC("services/invoiceService.js"), () => mocks.invoiceService)
  jest.doMock(SRC("services/receiptPdfService.js"), () => mocks.receiptPdfService)
  jest.doMock(SRC("utils/logger.js"), () => mocks.logger)
  // productService is required lazily by the OG injector; keep the real
  // module surface but let tests control the slug lookup.
  jest.doMock(SRC("services/productService.js"), () => {
    const real = jest.requireActual(SRC("services/productService.js"))
    return { ...real, getProductBySlug: mocks.productService.getProductBySlug }
  })
  // nodemailer must never be touched even if a real mailer path leaks in.
  jest.doMock("nodemailer", () => ({ createTransport: () => ({ sendMail: jest.fn(async () => ({ messageId: "x" })) }) }))

  global.fetch = mocks.fetch

  const app = require(SRC("app.js"))

  const signToken = (userId, extra = {}) =>
    jwt.sign({ userId, ...extra }, TEST_JWT_SECRET, { expiresIn: "1h" })

  const seedUser = (over = {}) =>
    prisma.seed("user", { fullName: "Test User", email: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`, ...over })

  return {
    app,
    prisma,
    mocks,
    signToken,
    signAdminToken: (userId) => signToken(userId),
    seedUser,
    TEST_MP_WEBHOOK_SECRET,
  }
}

module.exports = { buildApp, TEST_JWT_SECRET, TEST_MP_WEBHOOK_SECRET }
