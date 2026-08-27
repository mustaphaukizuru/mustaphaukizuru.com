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
    order: { findFirst: jest.fn() },
    coupon: { findFirst: jest.fn(), create: jest.fn() },
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
const { runAbandonedCartPass, TEMPLATE_KEY, OFFER_TEMPLATE_KEY, OFFER_PREFIX, formatMoney } = require("../src/jobs/abandonedCartJob")

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
  prisma.order.findFirst.mockResolvedValue(null)
  prisma.coupon.findFirst.mockResolvedValue(null)
  prisma.coupon.create.mockImplementation(async ({ data }) => ({ id: "cp1", ...data }))
  sendTemplateEmail.mockResolvedValue({ id: "log1" })
  resolveUserLocale.mockReturnValue("en")
  delete process.env.ABANDONED_CART_OFFER_PCT
  delete process.env.ABANDONED_CART_SECOND_TOUCH_HOURS
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

describe("touch 1 · per-cart awareness", () => {
  test("a reminder sent BEFORE this cart was created does not block a fresh reminder", async () => {
    // The dedupe window starts at the cart's createdAt when that is later
    // than now-dedupeDays — a customer who bought and started a new cart is
    // not silenced for a week.
    const created = new Date(NOW.getTime() - 1 * D)
    prisma.cart.findMany.mockResolvedValue([cart({ createdAt: created })])
    await runAbandonedCartPass({ dedupeDays: 7, now: NOW })
    expect(prisma.emailLog.findFirst.mock.calls[0][0].where.createdAt.gte).toEqual(created)
  })

  test("a cart whose products were bought after it went quiet is skipped — no reminder, counted as purchased", async () => {
    prisma.cart.findMany.mockResolvedValue([cart({ items: [{ productId: "p1", titleSnapshot: "Kit", priceSnapshot: "100.00", quantity: 1 }] })])
    prisma.order.findFirst.mockResolvedValue({ id: "o1" })
    const r = await runAbandonedCartPass({ now: NOW })
    expect(r).toMatchObject({ sent: 0, purchased: 1 })
    expect(sendTemplateEmail).not.toHaveBeenCalled()
    const where = prisma.order.findFirst.mock.calls[0][0].where
    expect(where).toMatchObject({ userId: "u1", status: { in: ["paid", "completed"] }, items: { some: { productId: { in: ["p1"] } } } })
  })

  test("money is formatted in the cart's currency and the customer's locale", () => {
    expect(formatMoney(450, "MXN", "es")).toMatch(/450/)
    expect(formatMoney(450, "USD", "en")).toBe("$450.00")
    expect(formatMoney(450, "MXN", "en")).toBe("MX$450.00")
  })
})

describe("touch 2 · comeback offer", () => {
  const firstTouchAt = new Date(NOW.getTime() - 80 * H) // > 72h ago

  test("72h after the first reminder: mints a single-use coupon for the cart and sends the offer once", async () => {
    prisma.cart.findMany.mockResolvedValue([cart({ id: "cart-x" })])
    prisma.emailLog.findFirst.mockResolvedValue({ id: "log-first", createdAt: firstTouchAt })

    const r = await runAbandonedCartPass({ now: NOW })

    expect(r).toMatchObject({ sent: 0, offers: 1, deduped: 0 })
    const data = prisma.coupon.create.mock.calls[0][0].data
    expect(data.code).toMatch(new RegExp(`^${OFFER_PREFIX}[A-Z2-9]{6}$`))
    expect(data).toMatchObject({
      description: "abandoned-cart:cart-x", discountType: "percentage", discountValue: 10,
      usageLimit: 1, maxUsesPerUser: 1, stackable: false, isActive: true,
    })
    expect(data.expiresAt.getTime()).toBe(NOW.getTime() + 7 * D)
    const call = sendTemplateEmail.mock.calls[0][0]
    expect(call.templateKey).toBe(OFFER_TEMPLATE_KEY)
    expect(call.variables).toMatchObject({ couponCode: data.code, discountPct: 10, customerName: "Ana" })
    expect(call.variables.offerExpires).toBeTruthy()
  })

  test("not yet 72h since the first reminder → nothing, counted as deduped", async () => {
    prisma.cart.findMany.mockResolvedValue([cart()])
    prisma.emailLog.findFirst.mockResolvedValue({ id: "log-first", createdAt: new Date(NOW.getTime() - 10 * H) })
    const r = await runAbandonedCartPass({ now: NOW })
    expect(r).toMatchObject({ offers: 0, deduped: 1 })
    expect(prisma.coupon.create).not.toHaveBeenCalled()
  })

  test("an offer already minted for this cart is never repeated", async () => {
    prisma.cart.findMany.mockResolvedValue([cart({ id: "cart-x" })])
    prisma.emailLog.findFirst.mockResolvedValue({ id: "log-first", createdAt: firstTouchAt })
    prisma.coupon.findFirst.mockResolvedValue({ id: "cp-old" })
    const r = await runAbandonedCartPass({ now: NOW })
    expect(r).toMatchObject({ offers: 0, deduped: 1 })
    expect(prisma.coupon.findFirst.mock.calls[0][0].where).toEqual({ description: "abandoned-cart:cart-x" })
    expect(prisma.coupon.create).not.toHaveBeenCalled()
    expect(sendTemplateEmail).not.toHaveBeenCalled()
  })

  test("a code collision (P2002) is retried with a new code", async () => {
    prisma.cart.findMany.mockResolvedValue([cart()])
    prisma.emailLog.findFirst.mockResolvedValue({ id: "log-first", createdAt: firstTouchAt })
    prisma.coupon.create.mockRejectedValueOnce({ code: "P2002" }).mockImplementationOnce(async ({ data }) => ({ id: "cp2", ...data }))
    const r = await runAbandonedCartPass({ now: NOW })
    expect(r.offers).toBe(1)
    expect(prisma.coupon.create).toHaveBeenCalledTimes(2)
  })

  test("ABANDONED_CART_OFFER_PCT and ABANDONED_CART_SECOND_TOUCH_HOURS are honoured", async () => {
    process.env.ABANDONED_CART_OFFER_PCT = "15"
    process.env.ABANDONED_CART_SECOND_TOUCH_HOURS = "24"
    prisma.cart.findMany.mockResolvedValue([cart()])
    prisma.emailLog.findFirst.mockResolvedValue({ id: "log-first", createdAt: new Date(NOW.getTime() - 30 * H) })
    const r = await runAbandonedCartPass({ now: NOW })
    expect(r.offers).toBe(1)
    expect(prisma.coupon.create.mock.calls[0][0].data.discountValue).toBe(15)
  })

  test("no offer for a cart whose products were bought meanwhile", async () => {
    prisma.cart.findMany.mockResolvedValue([cart({ items: [{ productId: "p1", titleSnapshot: "Kit", priceSnapshot: "100.00", quantity: 1 }] })])
    prisma.emailLog.findFirst.mockResolvedValue({ id: "log-first", createdAt: firstTouchAt })
    prisma.order.findFirst.mockResolvedValue({ id: "o1" })
    const r = await runAbandonedCartPass({ now: NOW })
    expect(r).toMatchObject({ offers: 0, purchased: 1 })
    expect(prisma.coupon.create).not.toHaveBeenCalled()
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
