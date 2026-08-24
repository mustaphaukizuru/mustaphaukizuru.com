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
}

module.exports = { startScheduler }
