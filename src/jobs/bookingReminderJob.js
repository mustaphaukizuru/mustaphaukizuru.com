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
const logger = require("../utils/logger")
const { sendConsultationReminderEmail } = require("../utils/mailer")

const ACTIVE_STATUSES = ["pending", "confirmed", "scheduled"]

// Two reminder windows — 24h and 1h before scheduledAt.
const WINDOWS = [
  { hoursAway: 24, toleranceMin: 30 },
  { hoursAway: 1,  toleranceMin: 5 },
]

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
 */
async function runReminderPass() {
  const now = new Date()
  let sent  = 0

  for (const w of WINDOWS) {
    const targetMs = now.getTime() + w.hoursAway * 60 * 60 * 1000
    const lower    = new Date(targetMs - w.toleranceMin * 60 * 1000)
    const upper    = new Date(targetMs + w.toleranceMin * 60 * 1000)

    /* eslint-disable no-await-in-loop */
    const due = await prisma.consultation.findMany({
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

    for (const c of due) {
      try {
        await sendConsultationReminderEmail(c, w.hoursAway)
        await prisma.consultation.update({
          where: { id: c.id },
          data:  { reminderSentAt: new Date() },
        })
        sent += 1
      } catch (err) {
        logger.error(`[bookingReminder] send failed for consultation ${c.id}`, err)
      }
    }
    /* eslint-enable no-await-in-loop */
  }

  if (sent > 0) logger.info(`[bookingReminder] dispatched ${sent} reminder(s)`)
}

module.exports = { runReminderPass }
