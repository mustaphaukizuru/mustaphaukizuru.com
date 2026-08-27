/**
 * src/jobs/scheduler.js
 *
 * Cron-style scheduler. Wired up from src/server.js after the HTTP server
 * starts listening so misconfiguration here cannot block the API from
 * coming up. Each job is registered defensively — a failure in one job
 * cannot stop the others from running.
 *
 * Schedules use node-cron syntax:
 *   ┌──── minute       (0-59)
 *   │ ┌── hour         (0-23)
 *   │ │ ┌── day-of-mo  (1-31)
 *   │ │ │ ┌── month    (1-12)
 *   │ │ │ │ ┌── day-of-week (0-7)
 *   │ │ │ │ │
 *   * * * * *
 *
 * To disable scheduled jobs in a specific environment (e.g. preview /
 * staging that shouldn't pollute analytics), set DISABLE_CRON=1.
 */

const logger = require("../utils/logger")

let cron = null
try {
  cron = require("node-cron")
} catch {
  // node-cron not installed yet — operator runs `npm install` after pulling
  // this branch. Without it, the API still boots; jobs just don't run.
  logger.warn("[scheduler] node-cron not installed — cron jobs disabled. Run `npm install` to enable.")
}

const { aggregateDailyMetrics } = require("./aggregateDailyMetrics")
const { runReminderPass } = require("./bookingReminderJob")
const { cancelStaleOrders } = require("./cancelStaleOrders")
const { runCampaignSenderPass } = require("./campaignSenderJob")
const { runEmailRetryPass } = require("./emailRetryJob")
const { runBackupPass } = require("./backupDatabaseJob")
const { runAbandonedCartPass } = require("./abandonedCartJob")
const { runProjectPurgePass } = require("./projectPurgeJob")
const { runInvoiceDunningPass } = require("./invoiceDunningJob")

// In-process overlap guards — a slow pass (SMTP stalls, DB hiccup) must not
// be joined by the next tick.
const running = new Set()
async function guarded(name, fn) {
  if (running.has(name)) {
    logger.warn(`[scheduler] ${name} still running — skipping this tick`)
    return
  }
  running.add(name)
  try { await fn() }
  catch (err) { logger.error(`[scheduler] ${name} failed`, err) }
  finally { running.delete(name) }
}

function startScheduler() {
  if (process.env.DISABLE_CRON === "1") {
    logger.info("[scheduler] DISABLE_CRON=1 — skipping all jobs")
    return
  }
  if (!cron) return

  // ── M14 · Daily analytics aggregation ───────────────────────────────
  // Runs at 00:15 every day to roll up the previous day. The 15-minute
  // offset ensures any straggling 23:59 requests have committed before
  // we count them.
  // The aggregation window is computed in UTC (aggregateDailyMetrics.js),
  // so the trigger must be UTC too — with TZ set the job would otherwise
  // fire at 00:15 local and roll up a UTC day that hasn't finished.
  try {
    cron.schedule("15 0 * * *", () => guarded("aggregateDailyMetrics", aggregateDailyMetrics), { timezone: "UTC" })
    logger.info("[scheduler] registered daily analytics aggregation · 00:15 UTC")
  } catch (err) {
    logger.error("[scheduler] failed to register aggregateDailyMetrics", err)
  }

  // ── Booking reminders · every 5 minutes ─────────────────────────────
  // Idempotent — Consultation.reminderSentAt prevents duplicate sends; the
  // overlap guard prevents two passes from racing on the same rows.
  try {
    cron.schedule("*/5 * * * *", () => guarded("bookingReminders", runReminderPass))
    logger.info("[scheduler] registered booking reminder pass · every 5 min")
  } catch (err) {
    logger.error("[scheduler] failed to register bookingReminderJob", err)
  }

  // ── Stale pending orders · hourly ───────────────────────────────────
  // Cancels checkouts abandoned > 24h and releases their coupons.
  try {
    cron.schedule("7 * * * *", () => guarded("cancelStaleOrders", () => cancelStaleOrders()))
    logger.info("[scheduler] registered stale-order janitor · hourly")
  } catch (err) {
    logger.error("[scheduler] failed to register cancelStaleOrders", err)
  }

  // ── Campaign sender · every minute ──────────────────────────────────
  // Drains queued EmailCampaignRecipient rows (50 per campaign per tick)
  // for campaigns in status "sending". The overlap guard keeps two passes
  // from racing on the same rows.
  try {
    cron.schedule("* * * * *", () => guarded("campaignSender", runCampaignSenderPass))
    logger.info("[scheduler] registered campaign sender · every minute")
  } catch (err) {
    logger.error("[scheduler] failed to register campaignSenderJob", err)
  }

  // ── Email retry · every 5 minutes ───────────────────────────────────
  // Re-sends EmailLog rows that failed transiently (nextAttemptAt due,
  // attempts < 3). emailService updates the same row so no duplicates.
  try {
    cron.schedule("*/5 * * * *", () => guarded("emailRetry", runEmailRetryPass))
    logger.info("[scheduler] registered email retry pass · every 5 min")
  } catch (err) {
    logger.error("[scheduler] failed to register emailRetryJob", err)
  }

  // ── D1 · Nightly database backup · 03:30 UTC ────────────────────────
  // A JSON dump of every table to persistent storage, pruned to the newest
  // 14. The backup script existed and worked; it just never ran unless
  // someone remembered — and with .env pointing at production and no dev
  // database, "a backup exists" and "a backup ran last night" were very
  // different guarantees. 03:30 UTC is after the 00:15 analytics roll-up
  // and the quietest hour for a Mexico-based audience. UTC for the same
  // reason as the aggregation: a TZ change must not silently move it.
  // The job probes the DB first and skips (loudly) rather than write a
  // partial file if the connection is dead.
  try {
    cron.schedule("30 3 * * *", () => guarded("databaseBackup", () => runBackupPass()), { timezone: "UTC" })
    logger.info("[scheduler] registered nightly database backup · 03:30 UTC")
  } catch (err) {
    logger.error("[scheduler] failed to register backupDatabaseJob", err)
  }

  // ── S2 · Abandoned-cart reminder · every 30 minutes ─────────────────
  // One email, once, when a signed-in customer's active cart has had no
  // activity for 3 hours. Deduped per user through EmailLog (7 days), never
  // touches Cart.status, batch-capped, and probes the DB before sending.
  // Half-hourly is a deliberate middle: hourly would make "3 hours quiet"
  // mean anywhere from 3 to 4; every 5 minutes would hammer SMTP on a
  // backlog for no gain in a reminder nobody expects to the minute.
  try {
    cron.schedule("*/30 * * * *", () => guarded("abandonedCart", () => runAbandonedCartPass()))
    logger.info("[scheduler] registered abandoned-cart reminder · every 30 min")
  } catch (err) {
    logger.error("[scheduler] failed to register abandonedCartJob", err)
  }

  // ── Tier 4 · Project file purge · 04:00 UTC ─────────────────────────
  // Unlinks deliverables of projects closed for PROJECT_PURGE_DAYS (60) and
  // stamps purgedAt on the rows; metadata stays. After the 03:30 backup so
  // the last snapshot still lists the files. UTC for the same reason as
  // the other nightly jobs — a TZ change must not move it.
  try {
    cron.schedule("0 4 * * *", () => guarded("projectPurge", () => runProjectPurgePass()), { timezone: "UTC" })
    logger.info("[scheduler] registered project file purge · 04:00 UTC")
  } catch (err) {
    logger.error("[scheduler] failed to register projectPurgeJob", err)
  }
  // ── Tier 4 · Invoice dunning · 08:00 UTC ────────────────────────────
  // Manual invoices past their due date turn overdue (late fee recorded
  // once, one email), paid orders reconcile their invoice, and projects
  // with long-overdue balances are suspended / reinstated. Daily in the
  // morning (Mexico) so the client reads the reminder during the day.
  try {
    cron.schedule("0 8 * * *", () => guarded("invoiceDunning", () => runInvoiceDunningPass()), { timezone: "UTC" })
    logger.info("[scheduler] registered invoice dunning · 08:00 UTC")
  } catch (err) {
    logger.error("[scheduler] failed to register invoiceDunningJob", err)
  }
}

module.exports = { startScheduler }
