/**
 * Integration · step 40 — httpOnly session cookie + CSRF double-submit.
 *
 * Runs the real src/app.js over supertest with the in-memory prisma fake, so
 * cookie-parser, the CSRF guard, and authMiddleware are all exercised in the
 * order they are actually mounted.
 *
 * What is pinned here:
 *   • login / signup / 2FA-login-verify set `mu_session` (httpOnly) + `mu_csrf`
 *   • a cookie authenticates a protected route
 *   • an Authorization header still authenticates one (rollout compatibility)
 *   • the cookie wins when both are present
 *   • CSRF rejects a mismatched / missing header on a cookie-authed write
 *   • CSRF exempts header-only clients and the payment webhooks
 *   • logout clears both cookies AND bumps the revocation watermark
 */
const request = require("supertest")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const { buildApp, TEST_JWT_SECRET } = require("../helpers/appFactory")

const SESSION_COOKIE = "mu_session"
const CSRF_COOKIE = "mu_csrf"

/** Parse a supertest `set-cookie` array into { name: { value, attrs } }. */
function parseSetCookie(res) {
  const raw = res.headers["set-cookie"] || []
  const out = {}
  for (const line of raw) {
    const [pair, ...rest] = line.split(";")
    const eq = pair.indexOf("=")
    const name = pair.slice(0, eq).trim()
    out[name] = {
      value: pair.slice(eq + 1),
      attrs: rest.map((a) => a.trim().toLowerCase()),
      raw: line,
    }
  }
  return out
}

/** Build a `Cookie:` request header from a { name: value } map. */
function cookieHeader(map) {
  return Object.entries(map).map(([k, v]) => `${k}=${v}`).join("; ")
}

let ctx
beforeEach(() => { ctx = buildApp() })

/* ── who sets cookies ─────────────────────────────────────────────────────── */

describe("session cookies are issued at every session-creation point", () => {
  async function seedPasswordUser(over = {}) {
    return ctx.seedUser({
      email: `login-${Math.random().toString(36).slice(2, 8)}@example.com`,
      passwordHash: await bcrypt.hash("correct-horse-battery", 10),
      authProvider: "local",
      ...over,
    })
  }

  test("POST /auth/login sets an httpOnly mu_session plus a readable mu_csrf", async () => {
    const user = await seedPasswordUser()
    const res = await request(ctx.app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "correct-horse-battery" })

    expect(res.status).toBe(200)
    const cookies = parseSetCookie(res)

    const session = cookies[SESSION_COOKIE]
    expect(session).toBeDefined()
    expect(session.attrs).toEqual(expect.arrayContaining(["httponly", "samesite=lax", "path=/"]))
    // NODE_ENV=test → not production → no Secure flag (dev/test runs on http).
    expect(session.attrs).not.toContain("secure")
    // The cookie really carries the session JWT for this user.
    expect(jwt.verify(decodeURIComponent(session.value), TEST_JWT_SECRET).userId).toBe(user.id)

    const csrf = cookies[CSRF_COOKIE]
    expect(csrf).toBeDefined()
    expect(csrf.attrs).not.toContain("httponly")   // the SPA must be able to read it
    expect(csrf.attrs).toEqual(expect.arrayContaining(["samesite=lax", "path=/"]))
    expect(csrf.value).toMatch(/^[0-9a-f]{64}$/)   // 32 random bytes, hex

    // ROLLOUT · the body token is still there for pre-step-40 clients.
    expect(res.body.data.token).toEqual(expect.any(String))
  })

  test("rememberMe stretches both cookies from 7 to 30 days", async () => {
    const user = await seedPasswordUser()

    const plain = parseSetCookie(await request(ctx.app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "correct-horse-battery" }))
    const remembered = parseSetCookie(await request(ctx.app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: "correct-horse-battery", rememberMe: true }))

    const maxAge = (jar, name) =>
      Number((jar[name].attrs.find((a) => a.startsWith("max-age=")) || "").split("=")[1])

    expect(maxAge(plain, SESSION_COOKIE)).toBe(7 * 24 * 60 * 60)
    expect(maxAge(remembered, SESSION_COOKIE)).toBe(30 * 24 * 60 * 60)
    // The CSRF cookie must never outlive or under-live the session it guards.
    expect(maxAge(remembered, CSRF_COOKIE)).toBe(maxAge(remembered, SESSION_COOKIE))
  })

  test("POST /auth/signup sets the cookie pair on the new account", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/auth/signup")
      .send({ fullName: "New Person", email: "fresh@example.com", password: "a-long-enough-password" })

    expect(res.status).toBe(201)
    const cookies = parseSetCookie(res)
    expect(cookies[SESSION_COOKIE].attrs).toContain("httponly")
    expect(cookies[CSRF_COOKIE]).toBeDefined()
  })

  test("2FA login-verify sets the cookie pair (the password leg never did)", async () => {
    const user = ctx.seedUser({ email: "twofa@example.com" })
    const twoFactorToken = jwt.sign(
      { userId: user.id, purpose: "2fa-pending", rememberMe: false },
      TEST_JWT_SECRET,
      { expiresIn: "5m" },
    )
    // Stub the verifier — this test is about cookie plumbing, not TOTP maths.
    const twoFactorService = require("../../src/services/twoFactorService")
    jest.spyOn(twoFactorService, "verifyLoginCode").mockResolvedValue(true)

    const res = await request(ctx.app)
      .post("/api/v1/auth/2fa/login-verify")
      .send({ twoFactorToken, code: "123456" })

    expect(res.status).toBe(200)
    const cookies = parseSetCookie(res)
    expect(cookies[SESSION_COOKIE].attrs).toContain("httponly")
    expect(cookies[CSRF_COOKIE]).toBeDefined()
    expect(jwt.verify(decodeURIComponent(cookies[SESSION_COOKIE].value), TEST_JWT_SECRET).userId).toBe(user.id)
  })
})

/* ── how a request authenticates ──────────────────────────────────────────── */

describe("authMiddleware · cookie first, Authorization header as fallback", () => {
  const ADMIN_ROUTE = "/api/v1/admin/bio/experience"

  test("the mu_session cookie authenticates a protected route", async () => {
    const admin = ctx.seedUser({ role: "admin" })
    const res = await request(ctx.app)
      .get(ADMIN_ROUTE)
      .set("Cookie", cookieHeader({ [SESSION_COOKIE]: ctx.signToken(admin.id) }))

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  test("ROLLOUT · the Authorization header still authenticates (old clients)", async () => {
    const admin = ctx.seedUser({ role: "admin" })
    const res = await request(ctx.app)
      .get(ADMIN_ROUTE)
      .set("Authorization", `Bearer ${ctx.signToken(admin.id)}`)

    expect(res.status).toBe(200)
  })

  test("the cookie wins when both are sent", async () => {
    const member = ctx.seedUser({ role: "member" })
    const admin = ctx.seedUser({ role: "admin" })

    // Cookie = member (no admin rights), header = admin. If the header were
    // preferred this would 200; the cookie must win and produce a 403.
    const res = await request(ctx.app)
      .get(ADMIN_ROUTE)
      .set("Cookie", cookieHeader({ [SESSION_COOKIE]: ctx.signToken(member.id) }))
      .set("Authorization", `Bearer ${ctx.signToken(admin.id)}`)

    expect(res.status).toBe(403)
    expect(res.body.code).toBe("FORBIDDEN")
  })

  test("a purpose-scoped token in the cookie is still rejected", async () => {
    const admin = ctx.seedUser({ role: "admin" })
    const pending = ctx.signToken(admin.id, { purpose: "2fa-pending" })
    const res = await request(ctx.app)
      .get(ADMIN_ROUTE)
      .set("Cookie", cookieHeader({ [SESSION_COOKIE]: pending }))

    expect(res.status).toBe(401)
    expect(res.body.code).toBe("AUTH_INVALID")
  })

  test("the tokensValidFrom watermark still applies to cookie sessions", async () => {
    const admin = ctx.seedUser({ role: "admin", tokensValidFrom: new Date(Date.now() + 60_000) })
    const res = await request(ctx.app)
      .get(ADMIN_ROUTE)
      .set("Cookie", cookieHeader({ [SESSION_COOKIE]: ctx.signToken(admin.id) }))

    expect(res.status).toBe(401)
    expect(res.body.code).toBe("AUTH_EXPIRED")
  })

  test("a suspended account is blocked on the cookie path too", async () => {
    const admin = ctx.seedUser({ role: "admin", status: "suspended" })
    const res = await request(ctx.app)
      .get(ADMIN_ROUTE)
      .set("Cookie", cookieHeader({ [SESSION_COOKIE]: ctx.signToken(admin.id) }))

    expect(res.status).toBe(403)
    expect(res.body.code).toBe("AUTH_SUSPENDED")
  })
})

/* ── CSRF ─────────────────────────────────────────────────────────────────── */

describe("CSRF double-submit guard", () => {
  const WRITE_ROUTE = "/api/v1/admin/bio/experience"
  const CSRF_VALUE = "c".repeat(64)

  function adminJar() {
    const admin = ctx.seedUser({ role: "admin" })
    return {
      admin,
      cookie: cookieHeader({
        [SESSION_COOKIE]: ctx.signToken(admin.id),
        [CSRF_COOKIE]: CSRF_VALUE,
      }),
    }
  }

  test("cookie-authed POST with NO X-CSRF-Token → 403 CSRF_INVALID", async () => {
    const { cookie } = adminJar()
    const res = await request(ctx.app)
      .post(WRITE_ROUTE)
      .set("Cookie", cookie)
      .send({ role: "Engineer", company: "Acme" })

    expect(res.status).toBe(403)
    expect(res.body.code).toBe("CSRF_INVALID")
  })

  test("cookie-authed POST with a MISMATCHED X-CSRF-Token → 403 CSRF_INVALID", async () => {
    const { cookie } = adminJar()
    const res = await request(ctx.app)
      .post(WRITE_ROUTE)
      .set("Cookie", cookie)
      .set("X-CSRF-Token", "d".repeat(64))
      .send({ role: "Engineer", company: "Acme" })

    expect(res.status).toBe(403)
    expect(res.body.code).toBe("CSRF_INVALID")
  })

  test("cookie-authed POST with the MATCHING token passes the guard", async () => {
    const { cookie } = adminJar()
    const res = await request(ctx.app)
      .post(WRITE_ROUTE)
      .set("Cookie", cookie)
      .set("X-CSRF-Token", CSRF_VALUE)
      .send({ role: "Engineer", company: "Acme", startDate: "2020-01-01" })

    // Whatever the controller decides, it is NOT the CSRF guard talking.
    expect(res.body.code).not.toBe("CSRF_INVALID")
    expect(res.status).not.toBe(403)
  })

  test("a mismatched header cannot be smuggled past by adding an Authorization header", async () => {
    const { admin, cookie } = adminJar()
    const res = await request(ctx.app)
      .post(WRITE_ROUTE)
      .set("Cookie", cookie)
      .set("Authorization", `Bearer ${ctx.signToken(admin.id)}`)
      .send({ role: "Engineer", company: "Acme" })

    // The cookie is what authenticates, so the guard must still fire.
    expect(res.status).toBe(403)
    expect(res.body.code).toBe("CSRF_INVALID")
  })

  test("EXEMPT · a header-only client needs no CSRF token", async () => {
    const admin = ctx.seedUser({ role: "admin" })
    const res = await request(ctx.app)
      .post(WRITE_ROUTE)
      .set("Authorization", `Bearer ${ctx.signToken(admin.id)}`)
      .send({ role: "Engineer", company: "Acme", startDate: "2020-01-01" })

    expect(res.body.code).not.toBe("CSRF_INVALID")
    expect(res.status).not.toBe(403)
  })

  test("EXEMPT · safe methods are never challenged", async () => {
    const { cookie } = adminJar()
    const res = await request(ctx.app).get(WRITE_ROUTE).set("Cookie", cookie)
    expect(res.status).toBe(200)
  })

  test("EXEMPT · the mercadopago webhook (server-to-server, own signature)", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/mercadopago/webhook")
      .set("Cookie", cookieHeader({ [SESSION_COOKIE]: "irrelevant", [CSRF_COOKIE]: CSRF_VALUE }))
      .send({ type: "payment", data: { id: "123" } })

    expect(res.body.code).not.toBe("CSRF_INVALID")
  })

  test("EXEMPT · the paypal webhook (mounted ahead of the guard for raw body)", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/paypal/webhook")
      .set("Cookie", cookieHeader({ [SESSION_COOKIE]: "irrelevant", [CSRF_COOKIE]: CSRF_VALUE }))
      .send({ event_type: "PAYMENT.CAPTURE.COMPLETED", resource: {} })

    expect(res.body.code).not.toBe("CSRF_INVALID")
  })

  test("EXEMPT · signing in again with a stale session cookie is not locked out", async () => {
    // A user whose readable mu_csrf cookie was lost while mu_session lingered
    // must still be able to log back in — see middleware/csrf.js.
    const res = await request(ctx.app)
      .post("/api/v1/auth/login")
      .set("Cookie", cookieHeader({ [SESSION_COOKIE]: "stale-token" }))
      .send({ email: "nobody@example.com", password: "whatever" })

    expect(res.body.code).not.toBe("CSRF_INVALID")
  })
})

/* ── logout ───────────────────────────────────────────────────────────────── */

describe("POST /auth/logout", () => {
  test("clears both cookies and bumps the revocation watermark", async () => {
    const user = ctx.seedUser({ role: "admin" })
    expect(user.tokensValidFrom).toBeNull()
    // Backdate `iat` past authMiddleware's deliberate 1-second issue/revoke
    // grace window, so the replay assertion below is about revocation rather
    // than about how fast this test happens to run.
    const token = jwt.sign(
      { userId: user.id, iat: Math.floor(Date.now() / 1000) - 10 },
      TEST_JWT_SECRET,
      { expiresIn: "1h" },
    )

    const res = await request(ctx.app)
      .post("/api/v1/auth/logout")
      .set("Cookie", cookieHeader({ [SESSION_COOKIE]: token }))

    expect(res.status).toBe(200)

    const cookies = parseSetCookie(res)
    // clearCookie = same name, empty value, an already-past Expires.
    expect(cookies[SESSION_COOKIE].value).toBe("")
    expect(cookies[CSRF_COOKIE].value).toBe("")
    expect(cookies[SESSION_COOKIE].raw).toMatch(/expires=thu, 01 jan 1970/i)

    // Server-side revocation: the watermark moved forward…
    const stored = ctx.prisma.rows("user").find((u) => u.id === user.id)
    expect(stored.tokensValidFrom).toBeInstanceOf(Date)

    // …so a client that kept a copy of the token can no longer use it.
    const replay = await request(ctx.app)
      .get("/api/v1/admin/bio/experience")
      .set("Authorization", `Bearer ${token}`)
    expect(replay.status).toBe(401)
    expect(replay.body.code).toBe("AUTH_EXPIRED")
  })

  test("revokes a header-authenticated session too", async () => {
    const user = ctx.seedUser({ role: "admin" })
    const res = await request(ctx.app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${ctx.signToken(user.id)}`)

    expect(res.status).toBe(200)
    expect(ctx.prisma.rows("user").find((u) => u.id === user.id).tokensValidFrom).toBeInstanceOf(Date)
  })

  test("is a no-op 200 when unauthenticated (sign-out must never fail)", async () => {
    const res = await request(ctx.app).post("/api/v1/auth/logout")
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(parseSetCookie(res)[SESSION_COOKIE].value).toBe("")
  })

  test("succeeds with an expired token and still clears the cookies", async () => {
    const user = ctx.seedUser()
    const expired = jwt.sign({ userId: user.id }, TEST_JWT_SECRET, { expiresIn: -60 })

    const res = await request(ctx.app)
      .post("/api/v1/auth/logout")
      .set("Cookie", cookieHeader({ [SESSION_COOKIE]: expired }))

    expect(res.status).toBe(200)
    expect(parseSetCookie(res)[SESSION_COOKIE].value).toBe("")
    // Nothing to revoke — an unverifiable token names no session.
    expect(ctx.prisma.rows("user").find((u) => u.id === user.id).tokensValidFrom).toBeNull()
  })

  test("a 2FA-pending token does not revoke the account's real sessions", async () => {
    const user = ctx.seedUser()
    const pending = ctx.signToken(user.id, { purpose: "2fa-pending" })

    const res = await request(ctx.app)
      .post("/api/v1/auth/logout")
      .set("Cookie", cookieHeader({ [SESSION_COOKIE]: pending }))

    expect(res.status).toBe(200)
    expect(ctx.prisma.rows("user").find((u) => u.id === user.id).tokensValidFrom).toBeNull()
  })
})
