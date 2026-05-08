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
  try {
    cron.schedule("15 0 * * *", async () => {
      try {
        await aggregateDailyMetrics()
      } catch (err) {
        logger.error("[scheduler] aggregateDailyMetrics failed", err)
      }
    }, { timezone: process.env.TZ || "UTC" })

    logger.info("[scheduler] registered daily analytics aggregation · 00:15 UTC")
  } catch (err) {
    logger.error("[scheduler] failed to register aggregateDailyMetrics", err)
  }

  // ── Booking reminders · every 5 minutes ─────────────────────────────
  // Idempotent — Consultation.reminderSentAt prevents duplicate sends even
  // across overlapping cron ticks. Fires the 24h and 1h reminder windows.
  try {
    cron.schedule("*/5 * * * *", async () => {
      try {
        await runReminderPass()
      } catch (err) {
        logger.error("[scheduler] bookingReminderJob failed", err)
      }
    })

    logger.info("[scheduler] registered booking reminder pass · every 5 min")
  } catch (err) {
    logger.error("[scheduler] failed to register bookingReminderJob", err)
  }
}

module.exports = { startScheduler }
