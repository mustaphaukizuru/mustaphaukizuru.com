/**
 * Integration · T1-6 · the three health surfaces over HTTP.
 *
 *   /health       — unauthenticated, lean: no env, no version; reports the
 *                   prisma-generate marker
 *   /health/jobs  — 200 when nothing is overdue (or cron is disabled),
 *                   503 naming the stale jobs otherwise
 *   /health/deep  — 401 without X-Health-Token or an admin session when a
 *                   token is configured
 */
const fs   = require("fs")
const os   = require("os")
const path = require("path")
const request = require("supertest")

const STORAGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "mu-health-test-"))
process.env.STORAGE_DIR = STORAGE_DIR

const { buildApp } = require("../helpers/appFactory")

let ctx
beforeAll(() => { ctx = buildApp() })
afterAll(() => { delete process.env.STORAGE_DIR; delete process.env.HEALTH_TOKEN; fs.rmSync(STORAGE_DIR, { recursive: true, force: true }) })

const logsDir = () => path.join(STORAGE_DIR, "logs")

describe("GET /api/v1/health", () => {
  test("is lean and reports the generate marker", async () => {
    const res = await request(ctx.app).get("/api/v1/health")
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: "ok", database: "ok", prismaGenerate: "ok" })
    expect(res.body.env).toBeUndefined()
    expect(res.body.version).toBeUndefined()

    fs.mkdirSync(logsDir(), { recursive: true })
    fs.writeFileSync(path.join(logsDir(), "prisma-generate.failed"), "2026-09-04T00:00:00Z\n")
    const stale = await request(ctx.app).get("/api/v1/health")
    expect(stale.body.prismaGenerate).toBe("stale")
    fs.rmSync(path.join(logsDir(), "prisma-generate.failed"))
  })
})

describe("GET /api/v1/health/jobs", () => {
  test("cron disabled → 200 with disabled: true", async () => {
    process.env.DISABLE_CRON = "1"
    const res = await request(ctx.app).get("/api/v1/health/jobs")
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: "ok", disabled: true, stale: 0 })
  })

  test("an overdue job → 503 naming it; a fresh one → 200", async () => {
    process.env.DISABLE_CRON = "0"
    fs.mkdirSync(logsDir(), { recursive: true })
    const file = path.join(logsDir(), "cron-heartbeat.json")
    const beats = {}
    for (const name of ["aggregateDailyMetrics", "bookingReminders", "cancelStaleOrders", "campaignSender", "databaseBackup", "abandonedCart", "projectPurge", "invoiceDunning", "fulfillmentReconcile"]) {
      beats[name] = new Date().toISOString()
    }
    beats.emailRetry = new Date(Date.now() - 60 * 60 * 1000).toISOString() // 5-min job, an hour ago
    fs.writeFileSync(file, JSON.stringify(beats))

    const res = await request(ctx.app).get("/api/v1/health/jobs")
    expect(res.status).toBe(503)
    expect(res.body.status).toBe("stale")
    expect(res.body.jobs.emailRetry.stale).toBe(true)
    expect(res.body.jobs.campaignSender.stale).toBe(false)

    beats.emailRetry = new Date().toISOString()
    fs.writeFileSync(file, JSON.stringify(beats))
    const ok = await request(ctx.app).get("/api/v1/health/jobs")
    expect(ok.status).toBe(200)
    process.env.DISABLE_CRON = "1"
  })
})

describe("GET /api/v1/health/deep", () => {
  beforeAll(() => {
    // Skip the real provider checks: no credentials → "skipped", not a network call.
    delete process.env.MP_ACCESS_TOKEN
    delete process.env.PAYPAL_CLIENT_ID
    delete process.env.PAYPAL_CLIENT_SECRET
    delete process.env.SMTP_HOST
  })

  test("with a token configured, no header and no admin → 401", async () => {
    process.env.HEALTH_TOKEN = "probe-secret-for-tests"
    const res = await request(ctx.app).get("/api/v1/health/deep")
    expect(res.status).toBe(401)
    expect(res.body.code).toBe("HEALTH_TOKEN_REQUIRED")
  })

  test("a wrong header is refused; the right header runs the probe", async () => {
    process.env.HEALTH_TOKEN = "probe-secret-for-tests"
    expect((await request(ctx.app).get("/api/v1/health/deep").set("X-Health-Token", "nope")).status).toBe(401)
    const res = await request(ctx.app).get("/api/v1/health/deep").set("X-Health-Token", "probe-secret-for-tests")
    expect(res.status).toBe(200)
    expect(res.body.checks).toMatchObject({ database: { status: "ok" }, mercadopago: { status: "skipped" }, paypal: { status: "skipped" } })
    expect(res.body.env).toBe("test")
  })

  test("an admin session is the other door", async () => {
    process.env.HEALTH_TOKEN = "probe-secret-for-tests"
    const admin = ctx.seedUser({ email: "health-admin@example.com", role: "admin", passwordHash: "x" })
    const res = await request(ctx.app).get("/api/v1/health/deep").set("Authorization", `Bearer ${ctx.signToken(admin.id)}`)
    expect(res.status).toBe(200)
  })

  test("without a token outside production it stays open", async () => {
    delete process.env.HEALTH_TOKEN
    expect((await request(ctx.app).get("/api/v1/health/deep")).status).toBe(200)
  })
})
