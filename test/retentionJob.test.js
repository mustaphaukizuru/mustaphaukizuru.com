/**
 * T1-3 · retentionJob — per-table windows from env with defaults, chunked
 * deletes, a dry run that counts and never deletes, the EmailLog retry
 * queue always kept, and expired sessions swept on their own clock.
 */
jest.mock("../src/lib/prisma", () => {
  const delegate = () => ({ count: jest.fn(), findMany: jest.fn(), deleteMany: jest.fn() })
  return {
    pageView: delegate(), analyticsEvent: delegate(), emailLog: delegate(),
    activityLog: delegate(), notification: delegate(), session: delegate(),
  }
})
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))

const prisma = require("../src/lib/prisma")
const logger = require("../src/utils/logger")
const { runRetentionPass, windowDays, whereFor, POLICY, CHUNK } = require("../src/jobs/retentionJob")

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date("2026-09-04T05:00:00Z")
const TABLES = ["pageView", "analyticsEvent", "emailLog", "activityLog", "notification", "session"]

beforeEach(() => {
  jest.clearAllMocks()
  for (const k of Object.keys(POLICY)) delete process.env[POLICY[k].envKey]
  delete process.env.RETENTION_DRY_RUN
  for (const t of TABLES) {
    prisma[t].count.mockResolvedValue(0)
    prisma[t].findMany.mockResolvedValue([])
    prisma[t].deleteMany.mockResolvedValue({ count: 0 })
  }
})

test("defaults: pageView 90d, analyticsEvent 180d, emailLog 180d, activityLog 365d, notification 180d; env overrides; garbage falls back", () => {
  expect(Object.fromEntries(Object.keys(POLICY).map((t) => [t, windowDays(t)]))).toEqual({
    pageView: 90, analyticsEvent: 180, emailLog: 180, activityLog: 365, notification: 180,
  })
  process.env.RETENTION_PAGEVIEW_DAYS = "30"
  expect(windowDays("pageView")).toBe(30)
  process.env.RETENTION_PAGEVIEW_DAYS = "-5"
  expect(windowDays("pageView")).toBe(90)
  process.env.RETENTION_PAGEVIEW_DAYS = "soon"
  expect(windowDays("pageView")).toBe(90)
})

test("the EmailLog window must exceed the abandoned-cart dedupe lookback (7 days)", () => {
  expect(windowDays("emailLog")).toBeGreaterThan(7)
})

test("EmailLog keeps queued rows and anything with a retry scheduled", () => {
  const cutoff = new Date(NOW.getTime() - 180 * DAY)
  expect(whereFor("emailLog", cutoff)).toEqual({
    AND: [{ createdAt: { lt: cutoff } }, { status: { not: "queued" } }, { nextAttemptAt: null }],
  })
  expect(whereFor("pageView", cutoff)).toEqual({ createdAt: { lt: cutoff } })
})

test("dry run counts every table and deletes nothing", async () => {
  prisma.pageView.count.mockResolvedValue(1234)
  prisma.session.count.mockResolvedValue(7)
  const r = await runRetentionPass({ dryRun: true, now: NOW })
  expect(r.dryRun).toBe(true)
  expect(r.deleted).toBe(0)
  expect(r.tables.pageView).toMatchObject({ days: 90, candidates: 1234, deleted: 0, cutoff: new Date(NOW.getTime() - 90 * DAY).toISOString() })
  expect(r.tables.session).toMatchObject({ candidates: 7, days: null })
  for (const t of TABLES) {
    expect(prisma[t].deleteMany).not.toHaveBeenCalled()
    expect(prisma[t].findMany).not.toHaveBeenCalled()
  }
  expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("DRY RUN"))
})

test("RETENTION_DRY_RUN=1 is the default switch", async () => {
  process.env.RETENTION_DRY_RUN = "1"
  const r = await runRetentionPass({ now: NOW })
  expect(r.dryRun).toBe(true)
})

test("deletes in chunks by id until a short page, with the cutoff where", async () => {
  const ids = (n, prefix) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}` }))
  prisma.pageView.findMany
    .mockResolvedValueOnce(ids(CHUNK, "a"))
    .mockResolvedValueOnce(ids(CHUNK, "b"))
    .mockResolvedValueOnce(ids(12, "c"))
  prisma.pageView.deleteMany
    .mockResolvedValueOnce({ count: CHUNK })
    .mockResolvedValueOnce({ count: CHUNK })
    .mockResolvedValueOnce({ count: 12 })

  const r = await runRetentionPass({ dryRun: false, now: NOW })

  expect(prisma.pageView.findMany).toHaveBeenCalledTimes(3)
  expect(prisma.pageView.findMany.mock.calls[0][0]).toEqual({
    where: { createdAt: { lt: new Date(NOW.getTime() - 90 * DAY) } }, select: { id: true }, take: CHUNK,
  })
  expect(prisma.pageView.deleteMany).toHaveBeenCalledTimes(3)
  expect(prisma.pageView.deleteMany.mock.calls[2][0].where.id.in).toHaveLength(12)
  expect(r.tables.pageView.deleted).toBe(2 * CHUNK + 12)
  expect(r.deleted).toBe(2 * CHUNK + 12)
})

test("expired sessions are swept by expiresAt, not createdAt", async () => {
  prisma.session.findMany.mockResolvedValueOnce([{ id: "s1" }, { id: "s2" }])
  prisma.session.deleteMany.mockResolvedValueOnce({ count: 2 })
  const r = await runRetentionPass({ dryRun: false, now: NOW })
  expect(prisma.session.findMany.mock.calls[0][0].where).toEqual({ expiresAt: { lt: NOW } })
  expect(r.tables.session.deleted).toBe(2)
})

test("a table with nothing to delete makes one query and no delete", async () => {
  await runRetentionPass({ dryRun: false, now: NOW })
  for (const t of TABLES) {
    expect(prisma[t].findMany).toHaveBeenCalledTimes(1)
    expect(prisma[t].deleteMany).not.toHaveBeenCalled()
  }
})
