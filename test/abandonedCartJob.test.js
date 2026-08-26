/**
 * src/jobs/abandonedCartJob — one reminder for a cart that went quiet.
 *
 * S2. The contract that makes this safe to run unattended, pinned:
 *
 *   - selection happens in the WHERE: active, signed-in, has items, quiet
 *     for `hours`, but touched within `dedupeDays` (stale carts are noise)
 *   - one reminder per user per `dedupeDays`, deduped through EmailLog
 *   - Cart.status is NEVER written (the storefront looks up `active` carts)
 *   - variables are derived from the cart, in the customer's locale
 *   - a dead database skips the pass, sends nothing
 *   - a send failure is logged and the loop continues
 *   - the batch is capped
 */

jest.mock("../src/lib/prisma", () => {
  const client = {
    $queryRaw: jest.fn(),
    $disconnect: jest.fn().mockResolvedValue(),
    $connect: jest.fn().mockResolvedValue(),
    cart: { findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    emailLog: { findFirst: jest.fn() },
  }
  client.isAlive = async () => { try { await client.$queryRaw(); return true } catch { return false } }
  client.recycle = async () => { await client.$disconnect(); await client.$connect() }
  return client
})
jest.mock("../src/services/emailService", () => ({ sendTemplateEmail: jest.fn() }))
jest.mock("../src/utils/resolveUserLocale", () => ({ resolveUserLocale: jest.fn(() => "en") }))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))

const prisma = require("../src/lib/prisma")
const { sendTemplateEmail } = require("../src/services/emailService")
const { resolveUserLocale } = require("../src/utils/resolveUserLocale")
const logger = require("../src/utils/logger")
const { runAbandonedCartPass, TEMPLATE_KEY } = require("../src/jobs/abandonedCartJob")

const NOW = new Date("2026-08-26T18:00:00Z")
const H = 60 * 60 * 1000
const D = 24 * H

const cart = (over = {}) => ({
  id: "cart1", userId: "u1", status: "active",
  updatedAt: new Date(NOW.getTime() - 5 * H),
  user: { id: "u1", email: "ana@example.com", fullName: "Ana López", profile: null },
  items: [
    { titleSnapshot: "Brand Identity Kit", priceSnapshot: "250.00", quantity: 1 },
    { titleSnapshot: "Landing Page Template", priceSnapshot: "100.00", quantity: 2 },
  ],
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  process.env.FRONTEND_URL = "https://mustaphaukizuru.com/"
  prisma.$queryRaw.mockResolvedValue([{ 1: 1 }])
  prisma.cart.findMany.mockResolvedValue([])
  prisma.emailLog.findFirst.mockResolvedValue(null)
  sendTemplateEmail.mockResolvedValue({ id: "log1" })
  resolveUserLocale.mockReturnValue("en")
})

describe("selection", () => {
  test("selects only active, signed-in carts with items, quiet for `hours` but touched within `dedupeDays`", async () => {
    await runAbandonedCartPass({ hours: 3, dedupeDays: 7, limit: 50, now: NOW })

    const args = prisma.cart.findMany.mock.calls[0][0]
    expect(args.where.status).toBe("active")
    expect(args.where.userId).toEqual({ not: null })
    expect(args.where.items).toEqual({ some: {} })
    expect(args.where.updatedAt.lte).toEqual(new Date(NOW.getTime() - 3 * H))
    expect(args.where.updatedAt.gte).toEqual(new Date(NOW.getTime() - 7 * D))
    expect(args.take).toBe(50)
    expect(args.orderBy).toEqual({ updatedAt: "asc" })
  })

  test("the batch cap is clamped to a sane range", async () => {
    await runAbandonedCartPass({ limit: 99999, now: NOW })
    expect(prisma.cart.findMany.mock.calls[0][0].take).toBe(500)
    await runAbandonedCartPass({ limit: 0, now: NOW })
    expect(prisma.cart.findMany.mock.calls[1][0].take).toBe(100)
  })
})

describe("sending", () => {
  test("sends one templated email with variables derived from the cart, and never writes Cart.status", async () => {
    prisma.cart.findMany.mockResolvedValue([cart()])

    const r = await runAbandonedCartPass({ now: NOW })

    expect(r).toMatchObject({ skipped: false, candidates: 1, sent: 1, deduped: 0, failed: 0 })
    expect(sendTemplateEmail).toHaveBeenCalledTimes(1)
    const call = sendTemplateEmail.mock.calls[0][0]
    expect(call).toMatchObject({ to: "ana@example.com", templateKey: TEMPLATE_KEY, userId: "u1", locale: "en" })
    expect(call.variables).toMatchObject({
      customerName: "Ana",
      itemCount:    3,
      firstItem:    "Brand Identity Kit",
      itemsSummary: "Brand Identity Kit, 2 × Landing Page Template",
      cartUrl:      "https://mustaphaukizuru.com/cart",   // trailing slash stripped
    })
    expect(call.variables.cartTotal).toMatch(/450/)
    // The storefront looks up `active` carts; a reminder must not hide one.
    expect(prisma.cart.update).not.toHaveBeenCalled()
    expect(prisma.cart.updateMany).not.toHaveBeenCalled()
  })

  test("resolves the locale from the user so Spanish speakers get the Spanish template", async () => {
    prisma.cart.findMany.mockResolvedValue([cart()])
    resolveUserLocale.mockReturnValue("es")
    await runAbandonedCartPass({ now: NOW })
    expect(resolveUserLocale).toHaveBeenCalledWith({ user: expect.objectContaining({ id: "u1" }) })
    expect(sendTemplateEmail.mock.calls[0][0].locale).toBe("es")
  })

  test("a customer with no first name is still addressed", async () => {
    prisma.cart.findMany.mockResolvedValue([cart({ user: { id: "u1", email: "x@example.com", fullName: "", profile: null } })])
    await runAbandonedCartPass({ now: NOW })
    expect(sendTemplateEmail.mock.calls[0][0].variables.customerName).toBe("there")
  })
})

describe("dedupe", () => {
  test("a user already reminded within `dedupeDays` is skipped — checked per USER, not per cart", async () => {
    prisma.cart.findMany.mockResolvedValue([cart({ id: "cart-new" })])
    prisma.emailLog.findFirst.mockResolvedValue({ id: "log-old" })

    const r = await runAbandonedCartPass({ dedupeDays: 7, now: NOW })

    expect(r).toMatchObject({ sent: 0, deduped: 1 })
    expect(sendTemplateEmail).not.toHaveBeenCalled()
    const where = prisma.emailLog.findFirst.mock.calls[0][0].where
    expect(where).toMatchObject({ userId: "u1", templateKey: TEMPLATE_KEY, status: { in: ["queued", "sent"] } })
    expect(where.createdAt.gte).toEqual(new Date(NOW.getTime() - 7 * D))
  })

  test("a previous FAILED send does not count as a reminder", async () => {
    // The dedupe filters on queued/sent, so a failed attempt is retried.
    prisma.cart.findMany.mockResolvedValue([cart()])
    prisma.emailLog.findFirst.mockResolvedValue(null)
    await runAbandonedCartPass({ now: NOW })
    expect(prisma.emailLog.findFirst.mock.calls[0][0].where.status).toEqual({ in: ["queued", "sent"] })
    expect(sendTemplateEmail).toHaveBeenCalledTimes(1)
  })
})

describe("resilience", () => {
  test("a dead database skips the pass and sends nothing", async () => {
    prisma.$queryRaw.mockRejectedValue(new Error("ECONNREFUSED"))
    const r = await runAbandonedCartPass({ now: NOW })
    expect(r).toMatchObject({ skipped: true, reason: "db-unreachable", sent: 0 })
    expect(prisma.cart.findMany).not.toHaveBeenCalled()
    expect(sendTemplateEmail).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("skipping this pass"))
  })

  test("a send failure is logged and the loop continues to the next cart", async () => {
    prisma.cart.findMany.mockResolvedValue([
      cart({ id: "c1", user: { id: "u1", email: "a@example.com", fullName: "A", profile: null } }),
      cart({ id: "c2", user: { id: "u2", email: "b@example.com", fullName: "B", profile: null } }),
    ])
    sendTemplateEmail.mockRejectedValueOnce(new Error("SMTP 4xx")).mockResolvedValueOnce({})

    const r = await runAbandonedCartPass({ now: NOW })

    expect(r).toMatchObject({ candidates: 2, sent: 1, failed: 1 })
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("send failed for user u1"))
    expect(sendTemplateEmail).toHaveBeenCalledTimes(2)
  })

  test("a cart whose user somehow has no email is skipped without a send", async () => {
    prisma.cart.findMany.mockResolvedValue([cart({ user: { id: "u1", email: null, fullName: "A", profile: null } })])
    const r = await runAbandonedCartPass({ now: NOW })
    expect(r.sent).toBe(0)
    expect(sendTemplateEmail).not.toHaveBeenCalled()
  })
})
