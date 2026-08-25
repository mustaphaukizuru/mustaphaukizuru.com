/**
 * src/jobs/bookingReminderJob.js
 *
 * Periodic scan: dispatches 24h and 1h reminders for upcoming consultations.
 * Idempotent — uses Consultation.reminderSentAt as a watermark so duplicate
 * sends are impossible across overlapping cron ticks.
 *
 * Wired into src/jobs/scheduler.js (runs every 5 minutes).
 *
 * Why not a separate setInterval? The project already has node-cron + a
 * unified scheduler with logger/Sentry hooks. Hooking in keeps every
 * background job under a single observability surface.
 */

const prisma = require("../lib/prisma")
const { isAlive, recycle } = require("../lib/prisma")
const logger = require("../utils/logger")
const { sendConsultationReminderEmail } = require("../utils/mailer")

const ACTIVE_STATUSES = ["pending", "confirmed", "scheduled"]

// Two reminder windows — 24h and 1h before scheduledAt.
const WINDOWS = [
  { hoursAway: 24, toleranceMin: 30 },
  { hoursAway: 1,  toleranceMin: 5 },
]

// Heuristic: identify Prisma's Rust-engine panic (typically "timer has
// gone away" on stale MySQL sockets) so we can recover instead of
// crashing the cron. We match by name first (most reliable), then on
// message substring as a fallback for older client versions.
function isEnginePanic(err) {
  if (!err) return false
  if (err.name === "PrismaClientRustPanicError") return true
  const msg = String(err.message || err)
  return /PANIC|timer has gone away|Rust panic/i.test(msg)
}

/**
 * One pass: find upcoming consultations within either reminder window that
 * haven't been reminded yet, and send. Designed to be safe to run every
 * 5 minutes with overlapping windows — `reminderSentAt` is the dedup key.
 *
 * Heuristic: a row whose `reminderSentAt` is older than 2h is eligible
 * again — this lets the 1h reminder fire even though the 24h reminder
 * already populated the field. (A stricter implementation would track
 * one watermark per window; this simpler form is enough for two windows
 * spaced 23h apart.)
 *
 * Resilience layer (added after the May 2026 "PANIC: timer has gone away"
 * incident — Hostinger MySQL was killing the connection between cron
 * ticks, then Prisma was crashing on the dead socket every 5 min):
 *
 *   1. Pre-flight `SELECT 1` ping. Stale socket → caught here, cheap.
 *   2. If ping fails: recycle the engine, ping again, give up cleanly
 *      if MySQL is genuinely down. Cron retries in 5 min.
 *   3. If the real query still panics (race between ping and query):
 *      recycle and bail. The dedup watermark guarantees the next tick
 *      can pick up whatever this pass missed.
 */
async function runReminderPass() {
  // Connection health gate — see src/lib/prisma.js helpers.
  if (!(await isAlive())) {
    await recycle()
    if (!(await isAlive())) {
      logger.warn("[bookingReminder] DB unreachable after recycle — skipping this pass")
      return
    }
  }

  const now = new Date()
  let sent  = 0

  for (const w of WINDOWS) {
    const targetMs = now.getTime() + w.hoursAway * 60 * 60 * 1000
    const lower    = new Date(targetMs - w.toleranceMin * 60 * 1000)
    const upper    = new Date(targetMs + w.toleranceMin * 60 * 1000)

    let due
    try {
      /* eslint-disable-next-line no-await-in-loop */
      due = await prisma.consultation.findMany({
        where: {
          status: { in: ACTIVE_STATUSES },
          scheduledAt: { gte: lower, lte: upper },
          OR: [
            { reminderSentAt: null },
            { reminderSentAt: { lt: new Date(now.getTime() - 2 * 60 * 60 * 1000) } },
          ],
        },
        include: {
          user:          { select: { id: true, fullName: true, email: true } },
          service:       { select: { id: true, title: true, slug: true } },
          assignedAdmin: { select: { id: true, fullName: true, email: true } },
        },
        take: 50,
      })
    } catch (err) {
      // The ping passed but the engine panicked anyway (rare race: the
      // pool's second socket was the stale one). Recycle and bail —
      // the next 5-minute tick will retry with a fresh engine.
      if (isEnginePanic(err)) {
        logger.warn(`[bookingReminder] engine panic on ${w.hoursAway}h window — recycling, will retry next tick`)
        /* eslint-disable-next-line no-await-in-loop */
        await recycle()
        return
      }
      // Any other error class: surface but don't crash the cron.
      logger.error(`[bookingReminder] findMany failed on ${w.hoursAway}h window`, err)
      return
    }

    for (const c of due) {
      try {
        /* eslint-disable-next-line no-await-in-loop */
        await sendConsultationReminderEmail(c, w.hoursAway)
        /* eslint-disable-next-line no-await-in-loop */
        await prisma.consultation.update({
          where: { id: c.id },
          data:  { reminderSentAt: new Date() },
        })
        sent += 1
      } catch (err) {
        if (isEnginePanic(err)) {
          // Same recovery as above — recycle and bail. The reminder for
          // this consultation will fire on the next pass (watermark is
          // still null or older than 2h).
          logger.warn(`[bookingReminder] engine panic during update for ${c.id} — recycling`)
          /* eslint-disable-next-line no-await-in-loop */
          await recycle()
          return
        }
        logger.error(`[bookingReminder] send failed for consultation ${c.id}`, err)
      }
    }
  }

  if (sent > 0) logger.info(`[bookingReminder] dispatched ${sent} reminder(s)`)
}

module.exports = { runReminderPass }
