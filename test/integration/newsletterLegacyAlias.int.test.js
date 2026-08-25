/**
 * Integration · newsletter subscribe has exactly ONE implementation.
 *
 * Covers:
 *   1. the canonical POST /api/v1/newsletter/subscribe double opt-in
 *   2. the legacy alias POST /api/v1/newsletter producing the identical
 *      result (pending row + confirmation email), because it now delegates
 *      to newsletterController.subscribe instead of duplicating it
 *   3. the closed hole: GET /api/v1/newsletter/unsubscribe?email= is gone,
 *      so nobody can unsubscribe an address they merely know
 */
const request = require("supertest")
const { buildApp } = require("../helpers/appFactory")

let ctx
beforeAll(() => { ctx = buildApp() })
beforeEach(() => { ctx.mocks.emailService.sendTemplateEmail.mockClear() })

const confirmMails = () =>
  ctx.mocks.emailService.sendTemplateEmail.mock.calls
    .map(([a]) => a)
    .filter((a) => a.templateKey === "newsletter.confirm")

// The confirmation email is fired and forgotten, so give the microtask queue
// a tick before asserting on it.
const settle = () => new Promise((r) => setTimeout(r, 10))

describe("newsletter subscribe · canonical + legacy alias", () => {
  test("canonical POST /api/v1/newsletter/subscribe parks the address as pending and mails a confirm link", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/newsletter/subscribe")
      .send({ email: "Canonical@Example.com", source: "home" })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const row = ctx.prisma.rows("newsletterSubscriber").find((r) => r.email === "canonical@example.com")
    expect(row).toBeTruthy()
    expect(row.status).toBe("pending")
    expect(row.source).toBe("home")
    expect(row.unsubscribeToken).toMatch(/^[0-9a-f]{64}$/)

    await settle()
    const mail = confirmMails().find((m) => m.to === "canonical@example.com")
    expect(mail).toBeTruthy()
    expect(mail.variables.confirmUrl).toContain(`/api/v1/newsletter/confirm/${row.unsubscribeToken}`)
  })

  test("legacy alias POST /api/v1/newsletter produces the same result (one implementation)", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/newsletter")
      .send({ email: "Legacy@Example.com" })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const row = ctx.prisma.rows("newsletterSubscriber").find((r) => r.email === "legacy@example.com")
    expect(row).toBeTruthy()
    expect(row.status).toBe("pending")          // NOT silently "subscribed"
    expect(row.source).toBe("footer")           // legacy default attribution
    expect(row.unsubscribeToken).toMatch(/^[0-9a-f]{64}$/)

    await settle()
    const mail = confirmMails().find((m) => m.to === "legacy@example.com")
    expect(mail).toBeTruthy()
    expect(mail.variables.confirmUrl).toContain(`/api/v1/newsletter/confirm/${row.unsubscribeToken}`)
  })

  test("both doors reject the same invalid input the same way", async () => {
    const canonical = await request(ctx.app).post("/api/v1/newsletter/subscribe").send({ email: "not-an-email" })
    const legacy    = await request(ctx.app).post("/api/v1/newsletter").send({ email: "not-an-email" })

    expect(canonical.status).toBe(400)
    expect(legacy.status).toBe(400)
    expect(legacy.body.message).toBe(canonical.body.message)
  })
})

describe("newsletter unsubscribe · the email-param hole is closed", () => {
  test("GET /api/v1/newsletter/unsubscribe?email= no longer exists and leaves the row subscribed", async () => {
    const victim = ctx.prisma.seed("newsletterSubscriber", {
      email:            "victim@example.com",
      status:           "subscribed",
      unsubscribeToken: "v".repeat(64),
      subscribedAt:     new Date(),
      unsubscribedAt:   null,
    })

    const res = await request(ctx.app)
      .get("/api/v1/newsletter/unsubscribe")
      .query({ email: "victim@example.com" })

    expect(res.status).toBe(404)

    const after = ctx.prisma.rows("newsletterSubscriber").find((r) => r.id === victim.id)
    expect(after.status).toBe("subscribed")
    expect(after.unsubscribedAt).toBeNull()
  })

  test("the unversioned /api/newsletter/unsubscribe?email= alias is gone too", async () => {
    const res = await request(ctx.app)
      .get("/api/newsletter/unsubscribe")
      .query({ email: "victim@example.com" })

    expect(res.status).toBe(404)
    const after = ctx.prisma.rows("newsletterSubscriber").find((r) => r.email === "victim@example.com")
    expect(after.status).toBe("subscribed")
  })

  test("the token route still works — that is the only way to unsubscribe", async () => {
    const sub = ctx.prisma.seed("newsletterSubscriber", {
      email:            "tokened@example.com",
      status:           "subscribed",
      unsubscribeToken: "t".repeat(64),
      subscribedAt:     new Date(),
      unsubscribedAt:   null,
    })

    const res = await request(ctx.app).get(`/api/v1/newsletter/unsubscribe/${"t".repeat(64)}`)
    expect(res.status).toBe(302)

    const after = ctx.prisma.rows("newsletterSubscriber").find((r) => r.id === sub.id)
    expect(after.status).toBe("unsubscribed")
    expect(after.unsubscribedAt).toBeTruthy()
  })
})
