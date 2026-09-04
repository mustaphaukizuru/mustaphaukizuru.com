/**
 * Integration · T1-11 · REQUIRE_ADMIN_2FA=1 turns every admin route into a
 * 403 ADMIN_2FA_REQUIRED for an admin without an enabled TOTP, and lets an
 * enrolled admin through. With the flag off nothing changes.
 */
const request = require("supertest")
const { buildApp } = require("../helpers/appFactory")

let ctx
beforeAll(() => { ctx = buildApp() })
afterAll(() => { delete process.env.REQUIRE_ADMIN_2FA })

const ADMIN_ROUTES = ["/api/v1/admin/orders", "/api/v1/admin/audit", "/api/v1/admin/email-logs"]

describe("admin 2FA gate", () => {
  let admin, enrolled, member

  beforeAll(() => {
    admin    = ctx.seedUser({ email: "admin-no2fa@example.com", role: "admin", passwordHash: "x" })
    enrolled = ctx.seedUser({ email: "admin-2fa@example.com", role: "admin", passwordHash: "x" })
    member   = ctx.seedUser({ email: "member@example.com", role: "member", passwordHash: "x" })
    ctx.prisma.seed("twoFactorAuth", { userId: enrolled.id, isEnabled: true, secretEncrypted: "x", backupCodes: [] })
  })

  const get = (path, user) => request(ctx.app).get(path).set("Authorization", `Bearer ${ctx.signToken(user.id)}`)

  test("flag off: an admin without 2FA reaches admin routes", async () => {
    delete process.env.REQUIRE_ADMIN_2FA
    for (const path of ADMIN_ROUTES) expect((await get(path, admin)).status).toBe(200)
  })

  test("flag on: every admin route answers 403 ADMIN_2FA_REQUIRED for an un-enrolled admin", async () => {
    process.env.REQUIRE_ADMIN_2FA = "1"
    for (const path of ADMIN_ROUTES) {
      const res = await get(path, admin)
      expect(res.status).toBe(403)
      expect(res.body.code).toBe("ADMIN_2FA_REQUIRED")
    }
  })

  test("flag on: an enrolled admin passes; a member is still a plain 403 FORBIDDEN", async () => {
    process.env.REQUIRE_ADMIN_2FA = "1"
    for (const path of ADMIN_ROUTES) expect((await get(path, enrolled)).status).toBe(200)
    const res = await get("/api/v1/admin/orders", member)
    expect(res.status).toBe(403)
    expect(res.body.code).toBe("FORBIDDEN")
  })

  test("flag on: the member's own dashboard routes are untouched", async () => {
    process.env.REQUIRE_ADMIN_2FA = "1"
    const res = await request(ctx.app).get("/api/v1/member/profile").set("Authorization", `Bearer ${ctx.signToken(admin.id)}`)
    expect(res.status).toBe(200)
  })
})
