/**
 * T1-6 · the cron dead-man switch.
 *
 * guarded() records a heartbeat only after a pass runs to completion;
 * jobsStatus() flags a job once it is older than twice its interval (never
 * sooner than ten minutes), treats a never-run job as fresh until the
 * process has been up that long, and reports nothing stale under
 * DISABLE_CRON=1.
 */
const fs   = require("fs")
const os   = require("os")
const path = require("path")

jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
jest.mock("node-cron", () => ({ schedule: jest.fn() }), { virtual: true })
jest.mock("../src/lib/prisma", () => ({ isAlive: jest.fn(), recycle: jest.fn() }))
jest.mock("../src/jobs/aggregateDailyMetrics", () => jest.fn())
jest.mock("../src/jobs/bookingReminderJob", () => ({ runReminderPass: jest.fn() }))
jest.mock("../src/jobs/cancelStaleOrders", () => ({ cancelStaleOrders: jest.fn() }))
jest.mock("../src/jobs/campaignSenderJob", () => ({ runCampaignSenderPass: jest.fn() }))
jest.mock("../src/jobs/emailRetryJob", () => ({ runEmailRetryPass: jest.fn() }))
jest.mock("../src/jobs/backupDatabaseJob", () => ({ runBackupPass: jest.fn() }))
jest.mock("../src/jobs/abandonedCartJob", () => ({ runAbandonedCartPass: jest.fn() }))
jest.mock("../src/jobs/projectPurgeJob", () => ({ runProjectPurgePass: jest.fn() }))
jest.mock("../src/jobs/invoiceDunningJob", () => ({ runInvoiceDunningPass: jest.fn() }))
jest.mock("../src/jobs/fulfillmentReconcileJob", () => ({ runFulfillmentReconcilePass: jest.fn() }))

const { JOB_INTERVALS, MIN_ALLOWANCE_MS, readHeartbeats, recordHeartbeat, jobsStatus } = require("../src/jobs/heartbeat")

const MIN = 60 * 1000
const NOW = new Date("2026-09-04T12:00:00Z")
let dir, file

beforeEach(() => {
  dir  = fs.mkdtempSync(path.join(os.tmpdir(), "mu-heartbeat-"))
  file = path.join(dir, "cron-heartbeat.json")
  process.env.CRON_HEARTBEAT_FILE = file
  delete process.env.DISABLE_CRON
})
afterEach(() => {
  delete process.env.CRON_HEARTBEAT_FILE
  fs.rmSync(dir, { recursive: true, force: true })
})

test("every registered job has an expected interval", () => {
  expect(Object.keys(JOB_INTERVALS).sort()).toEqual([
    "abandonedCart", "aggregateDailyMetrics", "bookingReminders", "campaignSender", "cancelStaleOrders",
    "databaseBackup", "emailRetry", "fulfillmentReconcile", "invoiceDunning", "projectPurge",
  ])
})

test("recordHeartbeat creates the file, keeps other jobs, and readHeartbeats tolerates garbage", () => {
  recordHeartbeat("emailRetry", { at: NOW, file })
  recordHeartbeat("campaignSender", { at: new Date(NOW.getTime() + MIN), file })
  expect(readHeartbeats(file)).toEqual({
    emailRetry:     "2026-09-04T12:00:00.000Z",
    campaignSender: "2026-09-04T12:01:00.000Z",
  })
  fs.writeFileSync(file, "not json")
  expect(readHeartbeats(file)).toEqual({})
})

test("a job is stale after twice its interval, never before ten minutes", () => {
  recordHeartbeat("campaignSender", { at: new Date(NOW.getTime() - 9 * MIN), file })     // 1-min job, 9 min ago → within the 10-min floor
  recordHeartbeat("emailRetry",     { at: new Date(NOW.getTime() - 11 * MIN), file })    // 5-min job, 11 min ago → stale
  recordHeartbeat("databaseBackup", { at: new Date(NOW.getTime() - 47 * 60 * MIN), file }) // daily, 47 h ago → within 48 h
  const r = jobsStatus({ now: NOW, file, uptimeMs: 0 })
  expect(r.jobs.campaignSender).toMatchObject({ stale: false, allowanceMs: MIN_ALLOWANCE_MS })
  expect(r.jobs.emailRetry).toMatchObject({ stale: true, allowanceMs: 10 * MIN })
  expect(r.jobs.databaseBackup.stale).toBe(false)
  expect(r.disabled).toBe(false)
})

test("a job that has never run is fresh on a young process and stale on an old one", () => {
  const young = jobsStatus({ now: NOW, file, uptimeMs: 5 * MIN })
  expect(young.jobs.emailRetry).toMatchObject({ lastSuccess: null, stale: false })
  const old = jobsStatus({ now: NOW, file, uptimeMs: 3 * 60 * MIN })
  expect(old.jobs.emailRetry.stale).toBe(true)
  expect(old.jobs.aggregateDailyMetrics.stale).toBe(false) // daily allowance is 48 h
  expect(old.stale).toBeGreaterThan(0)
})

test("DISABLE_CRON=1 reports nothing stale and says so", () => {
  const r = jobsStatus({ now: NOW, file, uptimeMs: 10 * 24 * 60 * MIN, disabled: true })
  expect(r).toMatchObject({ disabled: true, stale: 0 })
  expect(Object.values(r.jobs).every((j) => j.stale === false)).toBe(true)
})

describe("scheduler.guarded writes the heartbeat only after a completed pass", () => {
  const prisma = require("../src/lib/prisma")
  const { guarded } = require("../src/jobs/scheduler")

  test("success → heartbeat; throw → no heartbeat; DB down → skipped, no heartbeat", async () => {
    prisma.isAlive.mockResolvedValue(true)
    await guarded("emailRetry", async () => {})
    expect(readHeartbeats(file).emailRetry).toBeTruthy()

    await guarded("campaignSender", async () => { throw new Error("smtp down") })
    expect(readHeartbeats(file).campaignSender).toBeUndefined()

    prisma.isAlive.mockResolvedValue(false)
    prisma.recycle.mockResolvedValue()
    const fn = jest.fn()
    await guarded("abandonedCart", fn)
    expect(fn).not.toHaveBeenCalled()
    expect(readHeartbeats(file).abandonedCart).toBeUndefined()
  })
})
