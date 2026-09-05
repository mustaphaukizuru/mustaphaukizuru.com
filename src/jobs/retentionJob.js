/**
 * src/jobs/retentionJob.js · T1-3 · retention for the unbounded tables
 *
 * PageView, AnalyticsEvent, EmailLog, ActivityLog and Notification grew with
 * every visit, send and click and nothing ever deleted a row; expired
 * Session rows stayed until the user logged in again. On a shared MySQL host
 * that is a disk quota with a date on it.
 *
 * One nightly pass, one policy table, per-table windows read from
 * RETENTION_<TABLE>_DAYS (defaults below). Deletes in chunks of CHUNK ids
 * so a first run over a year of rows never holds a lock for long. Supports
 * { dryRun } — and the first deploy SHOULD run dry (RETENTION_DRY_RUN=1) so
 * the candidate counts are read before anything is removed.
 *
 * What is deliberately kept:
 *   - EmailLog rows still `queued` or with a `nextAttemptAt` — that is
 *     emailRetryJob's queue; deleting it drops mail silently. The window
 *     must also exceed the abandoned-cart dedupe lookback (7 days), which
 *     180 does by a wide margin.
 *   - AdminAuditLog, Refund, Payment, Order, Invoice — never touched here.
 *   - ProjectEvent (T5) is append-only history and is not in the policy.
 *
 * DailyMetric is what survives for analytics: aggregateDailyMetrics rolls
 * PageView and AnalyticsEvent up nightly, so the admin analytics page reads
 * raw rows only inside the window and the rollup beyond it.
 */
const prisma = require("../lib/prisma")
const logger = require("../utils/logger")

const DAY_MS = 24 * 60 * 60 * 1000
const CHUNK  = 5000

/** table → { envKey, defaultDays } — windows in days, by createdAt. */
const POLICY = Object.freeze({
  pageView:       { envKey: "RETENTION_PAGEVIEW_DAYS",       defaultDays: 90 },
  analyticsEvent: { envKey: "RETENTION_ANALYTICSEVENT_DAYS", defaultDays: 180 },
  emailLog:       { envKey: "RETENTION_EMAILLOG_DAYS",       defaultDays: 180 },
  activityLog:    { envKey: "RETENTION_ACTIVITYLOG_DAYS",    defaultDays: 365 },
  notification:   { envKey: "RETENTION_NOTIFICATION_DAYS",   defaultDays: 180 },
})

function windowDays(table, env = process.env) {
  const p = POLICY[table]
  const n = Number(env[p.envKey])
  return Number.isFinite(n) && n > 0 ? n : p.defaultDays
}

/** The WHERE for each table's sweep. EmailLog protects the retry queue. */
function whereFor(table, cutoff) {
  const base = { createdAt: { lt: cutoff } }
  if (table === "emailLog") {
    return { AND: [base, { status: { not: "queued" } }, { nextAttemptAt: null }] }
  }
  return base
}

// `now` is deliberately not a parameter: whereFor() has already turned it
// into a cutoff, and a second clock in here could disagree with it.
async function sweep(model, where, { dryRun, chunk }) {
  if (dryRun) {
    const candidates = await prisma[model].count({ where })
    return { candidates, deleted: 0 }
  }
  let deleted = 0
  for (;;) {
    const rows = await prisma[model].findMany({ where, select: { id: true }, take: chunk })
    if (rows.length === 0) break
    const r = await prisma[model].deleteMany({ where: { id: { in: rows.map((x) => x.id) } } })
    deleted += r.count
    if (rows.length < chunk) break
  }
  return { candidates: deleted, deleted }
}

/**
 * @param {object} [opts]
 * @param {boolean} [opts.dryRun]  default from RETENTION_DRY_RUN=1
 * @param {Date}    [opts.now]
 * @param {number}  [opts.chunk]
 * @returns {Promise<{ dryRun: boolean, tables: Record<string, object>, deleted: number }>}
 */
async function runRetentionPass({ dryRun = process.env.RETENTION_DRY_RUN === "1", now = new Date(), chunk = CHUNK } = {}) {
  const tables = {}
  let total = 0

  for (const table of Object.keys(POLICY)) {
    const days   = windowDays(table)
    const cutoff = new Date(now.getTime() - days * DAY_MS)
    const result = await sweep(table, whereFor(table, cutoff), { dryRun, chunk, now })
    tables[table] = { days, cutoff: cutoff.toISOString(), ...result }
    total += result.deleted
  }

  // Sessions expire on their own clock, not a retention window.
  const sessionWhere = { expiresAt: { lt: now } }
  const sessions = await sweep("session", sessionWhere, { dryRun, chunk, now })
  tables.session = { days: null, cutoff: now.toISOString(), ...sessions }
  total += sessions.deleted

  const summary = Object.entries(tables)
    .map(([t, r]) => `${t}=${dryRun ? `${r.candidates} candidate(s)` : `${r.deleted} deleted`}`)
    .join(" · ")
  logger.info(`[retention] ${dryRun ? "DRY RUN · " : ""}${summary}`)

  return { dryRun, tables, deleted: total }
}

module.exports = { runRetentionPass, windowDays, whereFor, POLICY, CHUNK }
