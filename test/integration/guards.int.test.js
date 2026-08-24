/**
 * Integration · auth guards, SPA fallback, OG injection, checkout account rule.
 * Runs the real src/app.js over supertest with the in-memory prisma fake.
 */
const request = require("supertest")
const { buildApp } = require("../helpers/appFactory")

let ctx
beforeAll(() => { ctx = buildApp() })

describe("admin route guards", () => {
  test("GET /api/v1/admin/bio/experience without token → 401 AUTH_MISSING", async () => {
    const res = await request(ctx.app).get("/api/v1/admin/bio/experience")
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ success: false, code: "AUTH_MISSING" })
  })

  test("2FA-pending token (purpose claim) is rejected with 401 AUTH_INVALID", async () => {
    const admin = ctx.seedUser({ role: "admin" })
    const pending = ctx.signToken(admin.id, { purpose: "2fa-pending" })
    const res = await request(ctx.app)
      .get("/api/v1/admin/bio/experience")
      .set("Authorization", `Bearer ${pending}`)
    expect(res.status).toBe(401)
    expect(res.body.code).toBe("AUTH_INVALID")
  })

  test("member session token on an admin route → 403 FORBIDDEN", async () => {
    const member = ctx.seedUser({ role: "member" })
    const res = await request(ctx.app)
      .get("/api/v1/admin/bio/experience")
      .set("Authorization", `Bearer ${ctx.signToken(member.id)}`)
    expect(res.status).toBe(403)
    expect(res.body.code).toBe("FORBIDDEN")
  })

  test("admin session token passes the guard and reaches the controller", async () => {
    const admin = ctx.seedUser({ role: "admin" })
    const res = await request(ctx.app)
      .get("/api/v1/admin/bio/experience")
      .set("Authorization", `Bearer ${ctx.signToken(admin.id)}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  test("token issued before tokensValidFrom watermark → 401 AUTH_EXPIRED", async () => {
    const admin = ctx.seedUser({ role: "admin", tokensValidFrom: new Date(Date.now() + 60_000) })
    const res = await request(ctx.app)
      .get("/api/v1/admin/bio/experience")
      .set("Authorization", `Bearer ${ctx.signToken(admin.id)}`)
    expect(res.status).toBe(401)
    expect(res.body.code).toBe("AUTH_EXPIRED")
  })
})

describe("SPA fallback + OG injection", () => {
  test("unknown SPA route → 404 with the index.html shell", async () => {
    const res = await request(ctx.app).get("/definitely-not-a-route").set("Accept", "text/html")
    expect(res.status).toBe(404)
    expect(res.headers["content-type"]).toMatch(/text\/html/)
    expect(res.text).toMatch(/<html/i)
  })

  test("known SPA route → 200 with the index.html shell", async () => {
    const res = await request(ctx.app).get("/about").set("Accept", "text/html")
    expect(res.status).toBe(200)
    expect(res.text).toMatch(/<html/i)
  })

  test("unknown /api route → JSON 404", async () => {
    const res = await request(ctx.app).get("/api/v1/nope")
    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ success: false, code: "NOT_FOUND" })
  })

  test("/store/:slug injects og:title from productService", async () => {
    ctx.mocks.productService.getProductBySlug.mockResolvedValueOnce({
      title: "Golden Template", description: "A very <b>shiny</b> template", images: [{ url: "/images/products/golden.png" }],
    })
    const res = await request(ctx.app).get("/store/golden-template").set("Accept", "text/html")
    expect(res.status).toBe(200)
    expect(ctx.mocks.productService.getProductBySlug).toHaveBeenCalledWith("golden-template", "en")
    expect(res.text).toContain('<meta property="og:title" content="Golden Template | Mustapha Ukizuru" />')
    expect(res.text).toContain('property="og:type" content="product"')
    expect(res.text).toContain("http://localhost:5173/images/products/golden.png")
    expect(res.text).toContain("A very shiny template")
  })

  test("/store/:slug for an unknown product falls through to the SPA 200 (client renders not-found)", async () => {
    ctx.mocks.productService.getProductBySlug.mockResolvedValueOnce(null)
    const res = await request(ctx.app).get("/store/missing").set("Accept", "text/html")
    expect(res.status).toBe(200)
    expect(res.text).not.toContain('og:type" content="product"')
  })
})

describe("checkout account rule", () => {
  test("guest checkout with the email of a password-holding account → 401 ACCOUNT_EXISTS", async () => {
    const product = ctx.prisma.seed("product", { title: "Kit", slug: "kit", price: 50 })
    ctx.seedUser({ email: "owner@example.com", passwordHash: "$2a$10$hash", authProvider: "local" })
    const res = await request(ctx.app)
      .post("/api/v1/orders")
      .send({ customerName: "Owner", customerEmail: "owner@example.com", items: [{ productId: product.id, quantity: 1 }] })
    expect(res.status).toBe(401)
    expect(res.body.code).toBe("ACCOUNT_EXISTS")
    expect(ctx.prisma.rows("order")).toHaveLength(0)
  })

  test("guest checkout with a brand-new email auto-creates a checkout account and sends the claim email", async () => {
    const product = ctx.prisma.seed("product", { title: "Kit2", slug: "kit2", price: 50 })
    const res = await request(ctx.app)
      .post("/api/v1/orders")
      .send({ customerName: "New Person", customerEmail: "new@example.com", items: [{ productId: product.id, quantity: 1 }] })
    expect(res.status).toBe(201)
    expect(res.body.data.isNewUser).toBe(true)
    const user = ctx.prisma.rows("user").find((u) => u.email === "new@example.com")
    expect(user).toMatchObject({ authProvider: "checkout", passwordHash: null })
    expect(user.resetPasswordToken).toBeTruthy()
    await new Promise((r) => setImmediate(r))
    expect(ctx.mocks.emailService.sendTemplateEmail).toHaveBeenCalledWith(expect.objectContaining({ templateKey: "auth.account-claim", to: "new@example.com" }))
  })

  test("missing customerEmail → 400 VALIDATION_ERROR", async () => {
    const res = await request(ctx.app).post("/api/v1/orders").send({ items: [{ productId: "x", quantity: 1 }] })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe("VALIDATION_ERROR")
  })
})
