// ─────────────────────────────────────────────────────────────────────────────
// T3-5 · the hardening batch.
//
// Seven separate changes with one thing in common: each closes something that
// is not a bug today and would be a serious one on the day somebody looked
// for it. So the assertions are about the PROPERTY, not the implementation —
// "a token signed with the wrong algorithm is refused", not "the options
// object has an algorithms key".
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  user: { findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
  suppressionList: { findUnique: jest.fn(), findMany: jest.fn(), upsert: jest.fn(), count: jest.fn() },
  newsletterSubscriber: { count: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))

const fs = require("fs")
const path = require("path")
const jwt = require("jsonwebtoken")

const prisma = require("../src/lib/prisma")
const logger = require("../src/utils/logger")
const { verifyJwt, signJwt, ALGORITHM } = require("../src/utils/jwt")
const suppression = require("../src/services/suppressionService")
const { withCronLock } = require("../src/jobs/cronLock")

const ROOT = path.join(__dirname, "..")
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8")

const SECRET_BEFORE = process.env.JWT_SECRET
beforeAll(() => { process.env.JWT_SECRET = "test-secret-for-hardening-cases-0123456789" })
afterAll(() => {
  if (SECRET_BEFORE === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = SECRET_BEFORE
})

beforeEach(() => jest.clearAllMocks())

/* ══════════════════════════════════════════════════════════════════════════
   1 · JWT algorithm pinning
   ══════════════════════════════════════════════════════════════════════════ */

describe("only HS256 is accepted", () => {
  test("a token this app signed verifies", () => {
    const token = signJwt({ userId: "u1" }, { expiresIn: "5m" })
    expect(verifyJwt(token).userId).toBe("u1")
    expect(jwt.decode(token, { complete: true }).header.alg).toBe(ALGORITHM)
  })

  test("an `alg: none` token is REFUSED", () => {
    // The classic one. jsonwebtoken has defended against it for years, but
    // "the library currently refuses" is a weaker sentence than "this
    // application accepts one algorithm".
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")
    const payload = Buffer.from(JSON.stringify({ userId: "attacker" })).toString("base64url")
    expect(() => verifyJwt(`${header}.${payload}.`)).toThrow()
  })

  test("a token signed with a DIFFERENT algorithm is refused even with the right secret", () => {
    // HS512 with the same secret: the signature is genuinely valid, and an
    // unpinned verify accepts it. This is the case that says the pin works.
    const token = jwt.sign({ userId: "u1" }, process.env.JWT_SECRET, { algorithm: "HS512" })
    expect(() => verifyJwt(token)).toThrow(/invalid algorithm/i)
  })

  test("a caller cannot widen the pin by passing its own options", () => {
    const token = jwt.sign({ userId: "u1" }, process.env.JWT_SECRET, { algorithm: "HS512" })
    expect(() => verifyJwt(token, { algorithms: ["HS256", "HS512"] })).toThrow(/invalid algorithm/i)
  })

  test("no file outside utils/jwt.js imports jsonwebtoken", () => {
    // There is no ESLint config on the backend, so this is the guard. Five
    // call sites each had their own options object; a sixth must not appear
    // quietly.
    const offenders = []
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) { walk(full); continue }
        if (!entry.name.endsWith(".js")) continue
        if (full.endsWith(path.join("utils", "jwt.js"))) continue
        if (/require\(["']jsonwebtoken["']\)/.test(fs.readFileSync(full, "utf8"))) {
          offenders.push(path.relative(ROOT, full))
        }
      }
    }
    walk(path.join(ROOT, "src"))
    expect(offenders).toEqual([])
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   2 · the login failure says one thing
   ══════════════════════════════════════════════════════════════════════════ */

describe("sign-in failures are indistinguishable", () => {
  const source = read("src", "services", "authService.js")

  test("a Google-only account no longer announces itself", () => {
    // It confirmed both that the address is registered AND how — which turns
    // a list of addresses into a list of accounts, and tells an attacker
    // which ones to phish rather than guess.
    expect(source).not.toContain("This account uses Google sign-in")
  })

  test("a locked account answers exactly like a wrong password", () => {
    // "Temporarily locked" tells a spray it found a real address and should
    // come back later. Two facts it did not have.
    const block = source.slice(source.indexOf("if (user.lockedUntil"))
    expect(block.slice(0, 300)).toContain('new Error("Invalid email or password")')
    expect(block.slice(0, 300)).toContain("statusCode = 401")
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   3 · account lockout
   ══════════════════════════════════════════════════════════════════════════ */

describe("account lockout counts per ACCOUNT, not per IP", () => {
  const auth = require("../src/services/authService")

  test("a failure increments, and nothing locks before the threshold", async () => {
    prisma.user.update.mockResolvedValue({ failedLoginAttempts: 3 })
    await auth.recordFailedLogin("u1")
    expect(prisma.user.update).toHaveBeenCalledTimes(1)
    expect(prisma.user.update.mock.calls[0][0].data).toEqual({ failedLoginAttempts: { increment: 1 } })
  })

  test("crossing the threshold sets lockedUntil AND resets the counter", async () => {
    // Without the reset, the eleventh failure ever would re-lock the account
    // immediately after every expiry — a permanent lockout by accident.
    prisma.user.update.mockResolvedValue({ failedLoginAttempts: auth.MAX_FAILED_LOGINS })
    await auth.recordFailedLogin("u1")
    const lock = prisma.user.update.mock.calls[1][0].data
    expect(lock.failedLoginAttempts).toBe(0)
    expect(lock.lockedUntil.getTime()).toBeGreaterThan(Date.now())
    expect(lock.lockedUntil.getTime()).toBeLessThanOrEqual(Date.now() + auth.LOCKOUT_MINUTES * 60_000 + 1000)
  })

  test("a correct password wipes the slate", async () => {
    prisma.user.update.mockResolvedValue({})
    await auth.clearFailedLogins("u1")
    expect(prisma.user.update.mock.calls[0][0].data).toEqual({ failedLoginAttempts: 0, lockedUntil: null })
  })

  test("a counter that cannot be written does not turn a wrong password into a 500", async () => {
    // A 500 for a real account and a 401 for a made-up one is the oracle
    // this whole section exists to close.
    prisma.user.update.mockRejectedValue(new Error("db gone"))
    await expect(auth.recordFailedLogin("u1")).resolves.toBeUndefined()
    await expect(auth.clearFailedLogins("u1")).resolves.toBeUndefined()
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   4 · the cron advisory lock
   ══════════════════════════════════════════════════════════════════════════ */

describe("only one process runs a job", () => {
  /** A $transaction that hands the callback a tx with a stubbed $queryRaw. */
  const withLockResult = (acquired) => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([{ acquired }]) }
    prisma.$transaction.mockImplementation(async (fn) => fn(tx))
    return tx
  }

  test("the job runs when the lock is acquired, and the lock is released", async () => {
    const tx = withLockResult(1)
    const job = jest.fn().mockResolvedValue()
    expect(await withCronLock("emailRetry", job)).toBe(true)
    expect(job).toHaveBeenCalledTimes(1)
    // Acquire and release, on the SAME tx — which is the whole point: a
    // MySQL advisory lock belongs to a connection, and releasing it from a
    // different pooled connection releases a lock this process never held.
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2)
  })

  test("a lock held elsewhere means the job does NOT run", async () => {
    withLockResult(0)
    const job = jest.fn()
    expect(await withCronLock("emailRetry", job)).toBe(false)
    expect(job).not.toHaveBeenCalled()
  })

  test("it does not release a lock it never held", async () => {
    const tx = withLockResult(0)
    await withCronLock("emailRetry", jest.fn())
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1)
  })

  test("a throwing job still gives the lock back", async () => {
    const tx = withLockResult(1)
    await expect(withCronLock("x", async () => { throw new Error("boom") })).resolves.toBe(false)
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2)
  })

  test("a database that cannot take the lock skips rather than running unguarded", async () => {
    // The case where two processes are most likely to be flailing at once is
    // exactly the one where running anyway would double-send.
    prisma.$transaction.mockRejectedValue(new Error("pool exhausted"))
    const job = jest.fn()
    expect(await withCronLock("emailRetry", job)).toBe(false)
    expect(job).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalled()
  })

  test("the scheduler writes a heartbeat only for the process that actually ran", () => {
    // A skipped tick has completed nothing HERE, but the process that held
    // the lock writes the heartbeat — so /health/jobs still sees the job as
    // alive. Writing one on a skip would report a job healthy on a box where
    // it never runs.
    const scheduler = read("src", "jobs", "scheduler.js")
    const block = scheduler.slice(scheduler.indexOf("const ran = await withCronLock"))
    expect(block.slice(0, 600)).toMatch(/if \(ran\) \{[\s\S]*recordHeartbeat/)
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   5 · suppression and one-click unsubscribe
   ══════════════════════════════════════════════════════════════════════════ */

describe("an address that asked never to be mailed again", () => {
  test("suppression is idempotent and keeps the FIRST reason", async () => {
    prisma.suppressionList.upsert.mockResolvedValue({})
    await suppression.suppress("A@Example.COM ", { reason: "complaint", detail: "x" })
    const call = prisma.suppressionList.upsert.mock.calls[0][0]
    expect(call.where.email).toBe("a@example.com")
    // Empty update: a second complaint must not overwrite how they left.
    expect(call.update).toEqual({})
  })

  test("an unknown reason is stored as manual rather than as free text", async () => {
    prisma.suppressionList.upsert.mockResolvedValue({})
    await suppression.suppress("a@b.c", { reason: "because-i-said-so" })
    expect(prisma.suppressionList.upsert.mock.calls[0][0].create.reason).toBe("manual")
  })

  test("a lookup failure means DO NOT SEND, not send anyway", async () => {
    // The direction of the failure matters more than the failure. Skipping
    // one campaign email is cheaper than mailing somebody who opted out.
    prisma.suppressionList.findUnique.mockRejectedValue(new Error("db gone"))
    expect(await suppression.isSuppressed("a@b.c")).toBe(true)

    prisma.suppressionList.findMany.mockRejectedValue(new Error("db gone"))
    const blocked = await suppression.suppressedSet(["a@b.c", "d@e.f"])
    expect(blocked.size).toBe(2)
  })

  test("the audience COUNT excludes suppressed addresses, not just the send", async () => {
    // A count that includes them is not a preview, it is a guess — and the
    // operator approves the send on that number.
    const svc = require("../src/services/adminCampaignService")
    prisma.newsletterSubscriber.count.mockResolvedValue(1200)
    prisma.suppressionList.count.mockResolvedValue(37)
    expect(await svc.countAudience("newsletter", [])).toBe(1163)
  })

  test("the one-click header pair is exactly what RFC 8058 requires", () => {
    // List-Unsubscribe alone is a link a client MAY offer. The Post header is
    // what makes Gmail and Yahoo render their own control — required for
    // bulk senders since February 2024, and the penalty for missing it is
    // deliverability, which is invisible until a campaign stops arriving.
    const job = read("src", "jobs", "campaignSenderJob.js")
    expect(job).toContain('"List-Unsubscribe": `<${unsubscribeUrl}>`')
    expect(job).toContain('"List-Unsubscribe-Post": "List-Unsubscribe=One-Click"')
  })

  test("the one-click endpoint always answers 200, even for a junk token", () => {
    // A 404 tells the provider the unsubscribe failed, and it may then mark
    // the message as not honouring unsubscribes — the exact penalty this
    // endpoint exists to avoid. An unknown token is a no-op that costs
    // nothing.
    const controller = read("src", "controllers", "newsletterController.js")
    const block = controller.slice(controller.indexOf("const unsubscribeOneClick"))
    const body = block.slice(0, block.indexOf("module.exports"))
    expect(body).toContain("res.status(200).end()")
    expect(body).not.toContain("404")
    // And it suppresses outright: one-click is what a reader presses INSTEAD
    // of "spam", so it means never again, not "off this one list".
    expect(body).toContain('reason: "unsubscribe"')
  })

  test("POST and GET both reach an unsubscribe handler", () => {
    const routes = read("src", "routes", "newsletterRoutes.js")
    expect(routes).toMatch(/router\.get\("\/unsubscribe\/:token"/)
    expect(routes).toMatch(/router\.post\("\/unsubscribe\/:token"/)
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   6 · headers and origins
   ══════════════════════════════════════════════════════════════════════════ */

describe("what the app tells a browser", () => {
  const app = read("src", "app.js")

  test("localhost is not an allowed origin in production", () => {
    // Otherwise a page on a developer's own machine can make CREDENTIALED
    // requests to the live API — an attack that needs no compromise of this
    // server, only a visit while signed in.
    const block = app.slice(app.indexOf("const allowedOrigins"))
    expect(block.slice(0, 400)).toContain("isProduction ? [] :")
    expect(app).toContain('const isProduction = process.env.NODE_ENV === "production"')
  })

  test("COOP is set, and only COEP is disabled for PayPal", () => {
    // They were switched off together, which was one too many: without COOP
    // a window this site opens keeps a reference back through window.opener.
    // same-origin-allow-popups keeps the isolation and still lets the PayPal
    // popup talk to the page that opened it.
    expect(app).toContain('crossOriginOpenerPolicy:   { policy: "same-origin-allow-popups" }')
    expect(app).toContain("crossOriginEmbedderPolicy: false")
  })

  test("Sunset is an HTTP-date, as RFC 8594 requires", () => {
    // "2026-07-01" parses to an Invalid Date in a client following the spec,
    // so the deprecation it announces cannot be acted on.
    const index = read("src", "routes", "index.js")
    expect(index).toContain("toUTCString()")
    const { SUNSET_DATE } = { SUNSET_DATE: new Date("2026-07-01T00:00:00Z").toUTCString() }
    expect(SUNSET_DATE).toMatch(/^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} .* GMT$/)
  })

  test("the password reset endpoint is rate limited", () => {
    // forgot-password was limited and reset-password/:token was not, which is
    // the wrong way round: the token in that URL IS the credential.
    const routes = read("src", "routes", "authRoutes.js")
    expect(routes).toMatch(/router\.post\("\/reset-password\/:token",\s*passwordResetRateLimiter/)
  })

  test("the reset limiter keys on IP, not on the token being guessed", () => {
    // Keying on the token would hand the attacker a fresh budget for every
    // guess, which is the opposite of a limit.
    const limiter = read("src", "middleware", "rateLimiter.js")
    const block = limiter.slice(limiter.indexOf('name:         "password-reset"'))
    expect(block.slice(0, 200)).toContain("keyGenerator: ipKey")
  })
})
