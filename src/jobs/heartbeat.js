/**
 * heartbeat.js · the cron dead-man switch.
 *
 * Every scheduled job runs through scheduler.guarded(). Until now a job
 * that stopped running — a stuck overlap guard, a scheduler that never
 * registered after a bad deploy, DISABLE_CRON left on by accident — was
 * invisible: nothing recorded that it used to run. guarded() now writes the
 * time of each job's last SUCCESSFUL pass here, and GET /api/v1/health/jobs
 * compares that against the job's expected interval. The uptime workflow
 * fails when any job is older than twice its interval.
 *
 * The file lives under STORAGE_PATHS.logs, which persists across deploys,
 * so a fresh clone still knows when each job last ran. No schema.
 */
const fs   = require("fs")
const path = require("path")
const { STORAGE_PATHS, ensureDir } = require("../config/storagePaths")

const MIN  = 60 * 1000
const HOUR = 60 * MIN
const DAY  = 24 * HOUR

/** Expected interval per job name, as registered in scheduler.js. */
const JOB_INTERVALS = Object.freeze({
  aggregateDailyMetrics: DAY,
  bookingReminders:      5 * MIN,
  cancelStaleOrders:     HOUR,
  campaignSender:        MIN,
  emailRetry:            5 * MIN,
  databaseBackup:        DAY,
  abandonedCart:         30 * MIN,
  projectPurge:          DAY,
  invoiceDunning:        DAY,
  fulfillmentReconcile:  15 * MIN,
  retention:             DAY,
})

/** A job is stale after twice its interval, never sooner than ten minutes. */
const MIN_ALLOWANCE_MS = 10 * MIN

function heartbeatFile() {
  return process.env.CRON_HEARTBEAT_FILE || path.join(STORAGE_PATHS.logs, "cron-heartbeat.json")
}

function readHeartbeats(file = heartbeatFile()) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"))
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

/** Record a successful pass. Read-modify-write; the file is tiny. */
function recordHeartbeat(name, { at = new Date(), file = heartbeatFile() } = {}) {
  const current = readHeartbeats(file)
  current[name] = at.toISOString()
  ensureDir(path.dirname(file))
  fs.writeFileSync(file, JSON.stringify(current, null, 2))
  return current
}

/**
 * Staleness per job. A job that has never recorded a pass is only stale
 * once the process has been up longer than its allowance — a fresh boot is
 * not a dead cron. With DISABLE_CRON=1 nothing is expected to run, so
 * nothing is stale, and the payload says so.
 */
function jobsStatus({
  now = new Date(),
  file = heartbeatFile(),
  intervals = JOB_INTERVALS,
  uptimeMs = process.uptime() * 1000,
  disabled = process.env.DISABLE_CRON === "1",
} = {}) {
  const beats = readHeartbeats(file)
  const jobs = {}
  let stale = 0
  for (const [name, intervalMs] of Object.entries(intervals)) {
    const last = beats[name] ? new Date(beats[name]) : null
    const allowanceMs = Math.max(2 * intervalMs, MIN_ALLOWANCE_MS)
    const ageMs = last && !Number.isNaN(last.getTime()) ? now.getTime() - last.getTime() : null
    const isStale = !disabled && (ageMs != null ? ageMs > allowanceMs : uptimeMs > allowanceMs)
    if (isStale) stale += 1
    jobs[name] = {
      lastSuccess: ageMs != null ? last.toISOString() : null,
      intervalMs,
      allowanceMs,
      ageMs,
      stale: isStale,
    }
  }
  return { disabled, stale, jobs, checkedAt: now.toISOString() }
}

module.exports = { JOB_INTERVALS, MIN_ALLOWANCE_MS, heartbeatFile, readHeartbeats, recordHeartbeat, jobsStatus }
