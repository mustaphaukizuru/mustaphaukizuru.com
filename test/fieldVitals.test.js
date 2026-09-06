// ─────────────────────────────────────────────────────────────────────────────
// T3-6 · real-user Web Vitals.
//
// The endpoint that receives these is public and unauthenticated, and the
// rollup reads a JSON column out of it every night. So the interesting
// questions are not "does p75 work" (it does) but: what does the server
// accept, what does the rollup do with a row it does not like, and does the
// percentile actually answer the question it is being asked.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  analyticsEvent: { create: jest.fn(), findMany: jest.fn() },
  dailyVital: { upsert: jest.fn(), findMany: jest.fn() },
  isAlive: jest.fn().mockResolvedValue(true),
  recycle: jest.fn(),
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))

const prisma = require("../src/lib/prisma")
const analytics = require("../src/services/analyticsService")
const { aggregateDailyVitals, p75, MIN_MEANINGFUL_SAMPLES } = require("../src/jobs/aggregateDailyMetrics")

const req = { headers: {}, ip: "1.2.3.4" }

// The session hash refuses to run under a weak salt (T0-5), and every write
// path goes through it. Restored in afterAll because jest workers share a
// process and a leaked env var is somebody else's mystery failure.
const SALT_BEFORE = process.env.ANALYTICS_HASH_SALT
beforeAll(() => { process.env.ANALYTICS_HASH_SALT = "x".repeat(48) })
afterAll(() => {
  if (SALT_BEFORE === undefined) delete process.env.ANALYTICS_HASH_SALT
  else process.env.ANALYTICS_HASH_SALT = SALT_BEFORE
})

beforeEach(() => {
  jest.clearAllMocks()
  prisma.analyticsEvent.create.mockResolvedValue({ id: "e1" })
  prisma.dailyVital.upsert.mockResolvedValue({})
})

/* ══════════════════════════════════════════════════════════════════════════
   What the public endpoint accepts
   ══════════════════════════════════════════════════════════════════════════ */

describe("a vital is validated, not trusted", () => {
  const send = (meta) => analytics.trackEvent(req, { name: "vital", path: "/store/:slug", meta })

  test("a well-formed measurement is stored", async () => {
    await send({ metric: "LCP", value: 2100, rating: "good" })
    const { data } = prisma.analyticsEvent.create.mock.calls[0][0]
    expect(data.name).toBe("vital")
    expect(data.meta).toEqual({ metric: "LCP", value: 2100, rating: "good" })
  })

  test("an unknown metric name is dropped, not stored", async () => {
    // Otherwise the rollup grows a column nobody asked for, from a public
    // endpoint anyone can post to.
    expect(await send({ metric: "TTFB_CUSTOM", value: 100 })).toBeNull()
    expect(prisma.analyticsEvent.create).not.toHaveBeenCalled()
  })

  test("a non-numeric value is dropped, and the coercible ones especially", async () => {
    // The first version coerced with Number(), which is how this test found
    // a real hole: Number(null), Number("") and Number([]) are all 0, so a
    // MISSING measurement would have been stored as a perfect score and
    // dragged every p75 down with it. Nothing about that failure is visible
    // afterwards — the row looks like a very fast page load.
    for (const value of ["fast", null, undefined, "", [], true, {}, NaN]) {
      expect(await send({ metric: "LCP", value })).toBeNull()
    }
    expect(prisma.analyticsEvent.create).not.toHaveBeenCalled()
  })

  test("a negative or absurd value is dropped", async () => {
    // A page cannot paint before it starts, and anything past an hour is a
    // broken clock rather than a slow load. One such row moves a p75.
    expect(await send({ metric: "LCP", value: -1 })).toBeNull()
    expect(await send({ metric: "INP", value: 7_200_000 })).toBeNull()
    expect(prisma.analyticsEvent.create).not.toHaveBeenCalled()
  })

  test("a missing or malformed meta is dropped", async () => {
    expect(await send(null)).toBeNull()
    expect(await send("LCP=2100")).toBeNull()
    expect(prisma.analyticsEvent.create).not.toHaveBeenCalled()
  })

  test("an unrecognised rating is discarded, not echoed back", async () => {
    await send({ metric: "CLS", value: 0.05, rating: "excellent" })
    expect(prisma.analyticsEvent.create.mock.calls[0][0].data.meta.rating).toBeNull()
  })

  test("CLS keeps its decimals", async () => {
    // Rounding CLS to an integer stores 0 for every value that is not
    // catastrophic, which is every value worth having.
    await send({ metric: "CLS", value: 0.0842, rating: "good" })
    expect(prisma.analyticsEvent.create.mock.calls[0][0].data.meta.value).toBe(0.0842)
  })

  test("every OTHER event type is unaffected by the new validation", async () => {
    // The validator keys on name === "vital". A purchase with a free-form
    // meta must still store exactly as it did before.
    await analytics.trackEvent(req, { name: "purchase", amount: 1200, meta: { coupon: "X" } })
    expect(prisma.analyticsEvent.create.mock.calls[0][0].data.meta).toEqual({ coupon: "X" })
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   The percentile
   ══════════════════════════════════════════════════════════════════════════ */

describe("p75 answers the question it is asked", () => {
  test("it is the 75th percentile by nearest rank", () => {
    expect(p75([1, 2, 3, 4])).toBe(3)
    expect(p75([10, 20, 30, 40, 50, 60, 70, 80])).toBe(60)
    expect(p75([5])).toBe(5)
    expect(p75([])).toBeNull()
  })

  test("it surfaces the slow tail that a mean would bury", () => {
    // The whole reason Core Web Vitals is defined at p75. Nineteen fast
    // loads and one twelve-second one: the mean says 1.3s and everything is
    // fine; the p75 says the slow quarter is slow.
    const values = [...Array(19).fill(800), 12_000]
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    expect(Math.round(mean)).toBeLessThan(1400)
    expect(p75(values)).toBe(800)

    // Exactly a quarter bad sits ON the boundary and still reads fast —
    // which is correct, and is what "75th percentile" means. It takes MORE
    // than a quarter before the number moves, and then it moves all the way.
    expect(p75([...Array(15).fill(800), ...Array(5).fill(9000)])).toBe(800)
    expect(p75([...Array(14).fill(800), ...Array(6).fill(9000)])).toBe(9000)
  })

  test("the low-sample floor is stated, not left to a reader's judgement", () => {
    expect(MIN_MEANINGFUL_SAMPLES).toBe(5)
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   The nightly rollup
   ══════════════════════════════════════════════════════════════════════════ */

describe("the rollup", () => {
  const day = new Date("2026-09-04T00:00:00Z")
  const args = { dayStart: day, dayEnd: new Date("2026-09-05T00:00:00Z"), isoDay: "2026-09-04" }

  const event = (path, metric, value) => ({ path, meta: { metric, value } })

  test("one row per route per metric, upserted so a re-run is safe", async () => {
    prisma.analyticsEvent.findMany.mockResolvedValue([
      event("/store", "LCP", 1000), event("/store", "LCP", 3000),
      event("/store", "CLS", 0.02),
      event("/about", "LCP", 900),
    ])
    const written = await aggregateDailyVitals(args)
    expect(written).toBe(3)

    const calls = prisma.dailyVital.upsert.mock.calls.map(([c]) => c.where.date_path_metric)
    expect(calls).toEqual(expect.arrayContaining([
      { date: day, path: "/store", metric: "LCP" },
      { date: day, path: "/store", metric: "CLS" },
      { date: day, path: "/about", metric: "LCP" },
    ]))
  })

  test("it carries the sample count, so the page can say how much to trust it", async () => {
    prisma.analyticsEvent.findMany.mockResolvedValue([
      event("/store", "LCP", 1000), event("/store", "LCP", 2000), event("/store", "LCP", 3000),
    ])
    await aggregateDailyVitals(args)
    const { create } = prisma.dailyVital.upsert.mock.calls[0][0]
    expect(create.samples).toBe(3)
    expect(create.p75).toBe(3000)
  })

  test("a row with unusable meta is skipped rather than poisoning the average", async () => {
    // The validator refuses these at write time, but this reads a JSON
    // column — so it checks again rather than trusting that every row on
    // disk was written by today's code.
    prisma.analyticsEvent.findMany.mockResolvedValue([
      event("/store", "LCP", 1000),
      { path: "/store", meta: null },
      { path: "/store", meta: { metric: "LCP", value: "slow" } },
      { path: "/store", meta: { value: 2000 } },
    ])
    await aggregateDailyVitals(args)
    expect(prisma.dailyVital.upsert.mock.calls[0][0].create.samples).toBe(1)
  })

  test("no measurements writes nothing at all", async () => {
    prisma.analyticsEvent.findMany.mockResolvedValue([])
    expect(await aggregateDailyVitals(args)).toBe(0)
    expect(prisma.dailyVital.upsert).not.toHaveBeenCalled()
  })

  test("it only reads the day it was asked for, and only vital events", async () => {
    prisma.analyticsEvent.findMany.mockResolvedValue([])
    await aggregateDailyVitals(args)
    const { where } = prisma.analyticsEvent.findMany.mock.calls[0][0]
    expect(where.name).toBe("vital")
    expect(where.createdAt).toEqual({ gte: args.dayStart, lt: args.dayEnd })
  })

  test("a failure in the vitals rollup never takes the day's metrics with it", () => {
    // Pageviews and revenue are the numbers the business runs on; a p75 is
    // a nicety. Asserted at the source because the call is fire-and-forget.
    const fs = require("fs")
    const path = require("path")
    const job = fs.readFileSync(path.join(__dirname, "..", "src", "jobs", "aggregateDailyMetrics.js"), "utf8")
    const block = job.slice(job.indexOf("await aggregateDailyVitals({ dayStart"))
    expect(block.slice(0, 200)).toContain(".catch(")
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   The client never sends an identifier
   ══════════════════════════════════════════════════════════════════════════ */

describe("route patterns, not URLs", () => {
  const fs = require("fs")
  const path = require("path")
  const src = fs.readFileSync(path.join(__dirname, "..", "web", "src", "lib", "vitals.js"), "utf8")

  test("the two credential-bearing routes are collapsed", () => {
    // A tracking code in an analytics table is a client's project identifier
    // somewhere it was never meant to be; a portal token is a live
    // credential. Both are the reason this is a pattern list and not a
    // "send window.location.pathname".
    expect(src).toContain('"/track/:code"')
    expect(src).toContain('"/portal/:token"')
    expect(src).toContain('"/reset-password/:token"')
  })

  test("anything unrecognised is truncated rather than sent whole", () => {
    // An unrecognised third segment is exactly where an identifier hides.
    expect(src).toMatch(/segments\.length > 2/)
    expect(src).toContain('slice(0, 2)')
  })

  test("consent is checked at SEND time, not at init", () => {
    // A visitor who accepts the banner after the page loads should have
    // their measurements counted; one who never does should send nothing.
    const send = src.slice(src.indexOf("const send = "))
    expect(send.slice(0, send.indexOf("trackEvent"))).toContain("hasAnalyticsConsent()")
  })

  test("admin traffic is excluded, like the pageview tracker", () => {
    expect(src).toContain('path.startsWith("/admin")')
  })
})
