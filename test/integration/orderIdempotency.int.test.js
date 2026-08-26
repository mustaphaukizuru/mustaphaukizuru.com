/**
 * POST /api/v1/orders — Idempotency-Key.
 *
 * A retried or double-submitted checkout (flaky mobile connection, double
 * tap, browser retry on a lost response) must produce ONE order, not two.
 * Payment capture was already idempotent via a DB unique; order creation was
 * not — two orders, two "order placed" emails, and a confused customer.
 *
 * Contract pinned here:
 *   - same user + same key      -> same order, 200 (not 201), no second email
 *   - same user + different key -> a new order
 *   - same key, different user  -> a new order (keys are scoped per user)
 *   - no key                    -> today's behaviour, every submit creates
 *   - a lost race (P2002)       -> the winner is returned, never an error
 *   - hostile / malformed keys  -> ignored, purchase still goes through
 */

const request = require("supertest")
const { buildApp } = require("../helpers/appFactory")

let ctx
beforeAll(() => { ctx = buildApp() })

describe("order creation idempotency", () => {
  let buyer, other, product

  beforeAll(() => {
    buyer   = ctx.seedUser({ fullName: "Buyer", email: "idem-buyer@example.com", passwordHash: "$2a$10$x" })
    other   = ctx.seedUser({ fullName: "Other", email: "idem-other@example.com", passwordHash: "$2a$10$x" })
    product = ctx.prisma.seed("product", { title: "Kit", slug: "idem-kit", price: 100, isActive: true })
    ctx.prisma.seed("productFile", { productId: product.id, fileName: "k.zip", filePath: "/x/k.zip", isPrimary: true, version: "1.0", fileSize: 10 })
  })

  beforeEach(() => jest.clearAllMocks())

  const body = { customerEmail: "idem-buyer@example.com", items: [{ productId: () => product.id, quantity: 1 }] }
  const post = (userId, key, b = body) =>
    request(ctx.app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${ctx.signToken(userId)}`)
      .set(key ? { "Idempotency-Key": key } : {})
      .send({ ...b, items: b.items.map((i) => ({ ...i, productId: typeof i.productId === "function" ? i.productId() : i.productId })) })

  test("same user + same key returns the SAME order with 200 and sends no second email", async () => {
    const first = await post(buyer.id, "attempt-aaaa-1111")
    expect(first.status).toBe(201)
    expect(first.body.idempotentReplay).toBeUndefined()
    expect(ctx.mocks.emailService.sendTemplateEmail).toHaveBeenCalledTimes(1)

    jest.clearAllMocks()
    const second = await post(buyer.id, "attempt-aaaa-1111")

    expect(second.status).toBe(200)
    expect(second.body.idempotentReplay).toBe(true)
    expect(second.body.data.id).toBe(first.body.data.id)
    expect(second.body.data.orderNumber).toBe(first.body.data.orderNumber)
    // The whole point: a double-tap must not double-email.
    expect(ctx.mocks.emailService.sendTemplateEmail).not.toHaveBeenCalled()
    expect(ctx.prisma.rows("order").filter((o) => o.idempotencyKey === "attempt-aaaa-1111")).toHaveLength(1)
  })

  test("same user + a different key creates a new order", async () => {
    const a = await post(buyer.id, "attempt-bbbb-0001")
    const b = await post(buyer.id, "attempt-bbbb-0002")
    expect(a.status).toBe(201)
    expect(b.status).toBe(201)
    expect(b.body.data.id).not.toBe(a.body.data.id)
  })

  test("keys are scoped per user — another user reusing a key gets their own order", async () => {
    const mine   = await post(buyer.id, "attempt-cccc-shared")
    const theirs = await post(other.id, "attempt-cccc-shared", { ...body, customerEmail: "idem-other@example.com" })
    expect(mine.status).toBe(201)
    expect(theirs.status).toBe(201)
    expect(theirs.body.data.id).not.toBe(mine.body.data.id)
    expect(theirs.body.data.userId).toBe(other.id)
  })

  test("no key keeps today's behaviour: every submit creates an order", async () => {
    const a = await post(buyer.id, null)
    const b = await post(buyer.id, null)
    expect(a.status).toBe(201)
    expect(b.status).toBe(201)
    expect(b.body.data.id).not.toBe(a.body.data.id)
  })

  test("a lost race returns the winner instead of an error", async () => {
    // Simulate two submits that both passed the in-transaction lookup: seed
    // the winner directly, then submit with the same key. The fake enforces
    // (userId, idempotencyKey) and throws P2002 on the insert, exactly as
    // MySQL would — the service must recover by returning the winner.
    const winner = ctx.prisma.seed("order", {
      orderNumber: "ORD-RACE-WIN", userId: buyer.id, idempotencyKey: "attempt-dddd-race",
      customerName: "Buyer", customerEmail: "idem-buyer@example.com",
      subtotalAmount: 100, discountAmount: 0, totalAmount: 100, currency: "MXN", status: "pending",
    })
    // Make the replay lookup miss on the first pass so the create path runs
    // and collides — that is the race being modelled.
    const origFindFirst = ctx.prisma.order.findFirst.bind(ctx.prisma.order)
    let calls = 0
    ctx.prisma.order.findFirst = async (args) => {
      calls += 1
      if (calls === 1 && args?.where?.idempotencyKey === "attempt-dddd-race") return null
      return origFindFirst(args)
    }
    try {
      const res = await post(buyer.id, "attempt-dddd-race")
      expect(res.status).toBe(200)
      expect(res.body.idempotentReplay).toBe(true)
      expect(res.body.data.id).toBe(winner.id)
      expect(res.body.data.orderNumber).toBe("ORD-RACE-WIN")
    } finally {
      ctx.prisma.order.findFirst = origFindFirst
    }
  })

  test.each([
    ["too short", "abc"],
    ["too long", "x".repeat(129)],
    ["hostile charset", "key with spaces; DROP TABLE"],
  ])("a %s key is ignored rather than blocking the purchase", async (_label, key) => {
    const res = await post(buyer.id, key)
    expect(res.status).toBe(201)
    expect(res.body.data.idempotencyKey ?? null).toBeNull()
  })
})
