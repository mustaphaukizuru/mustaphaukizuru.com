/**
 * fileRequestReminderJob.js · nudge a client about an outstanding document (T5-3).
 *
 * A document request that nobody chases is an email thread with extra steps.
 * This is the chasing: once a day, any request still `requested` whose due
 * date is close or past gets one reminder, and not another for 48 hours.
 *
 * DOUBLE-SEND IS THE FAILURE MODE, so the claim comes first. Each request is
 * claimed with a conditional `updateMany` that stamps `remindedAt` — the same
 * shape cancelStaleOrders.js uses. If two processes run the sweep at once,
 * exactly one of them sees `count === 1` and sends; the other moves on. A
 * client being nagged twice about the same file is the kind of small rudeness
 * that makes people stop reading the emails.
 *
 * Reminders are also never sent for a `rejected` request. That one is already
 * back with the client with a note attached, and the rejection itself was the
 * nudge.
 */

const prisma = require("../lib/prisma")
const logger = require("../utils/logger")
const { notify } = require("../services/notificationService")
const projectEmails = require("../services/projectEmailService")

/** How close to the due date a request starts being chased. */
const DUE_WITHIN_DAYS = 2
/** Never remind about the same request more often than this. */
const REMINDER_COOLDOWN_HOURS = 48

function hoursAgo(n) {
  const d = new Date()
  d.setHours(d.getHours() - n)
  return d
}

function daysAhead(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}

async function runFileRequestReminderPass({ now = new Date() } = {}) {
  const cooldown = hoursAgo(REMINDER_COOLDOWN_HOURS)

  const candidates = await prisma.projectFileRequest.findMany({
    where: {
      status: "requested",
      // A request with no due date is not overdue and is not chased. Silence
      // is the right default for "whenever you can".
      dueAt: { not: null, lte: daysAhead(DUE_WITHIN_DAYS) },
      OR: [{ remindedAt: null }, { remindedAt: { lte: cooldown } }],
    },
    select: {
      id: true, projectId: true, title: true, titleEs: true, dueAt: true, remindedAt: true,
      instructions: true, instructionsEs: true,
      project: {
        select: {
          id: true, userId: true, projectName: true, closedAt: true,
          trackingCode: true, assignedAdminId: true,
        },
      },
    },
    take: 200,
  })

  let reminded = 0
  let skipped = 0

  for (const request of candidates) {
    // A closed project should not be chasing anyone for paperwork.
    if (!request.project || request.project.closedAt) { skipped += 1; continue }

    try {
      // Claim first. The where clause repeats the conditions so a request
      // reminded by another process between the read and here is not
      // reminded again.
      const claim = await prisma.projectFileRequest.updateMany({
        where: {
          id: request.id,
          status: "requested",
          OR: [{ remindedAt: null }, { remindedAt: { lte: cooldown } }],
        },
        data: { remindedAt: now },
      })
      if (claim.count !== 1) { skipped += 1; continue }

      const overdue = Boolean(request.dueAt && request.dueAt < now)
      await notify(request.project.userId, {
        type: "project",
        title: overdue ? "A document is overdue" : "A document is due soon",
        message: request.title,
        linkUrl: `/dashboard/projects/${request.projectId}?request=${request.id}`,
      })
      // T5-6 · and the email. AFTER the notification and after the claim, so
      // a mail failure cannot cause a second reminder: remindedAt is already
      // stamped and the cooldown holds either way.
      await projectEmails.sendFileReminder({ project: request.project, request, overdue })
      reminded += 1
    } catch (err) {
      // One bad row must not abort the sweep. remindedAt is already stamped,
      // so the cooldown protects against a retry storm on a persistent
      // failure — the next pass in 48 hours will try again.
      logger.error(`[fileRequestReminder] ${request.id}: ${err.message}`)
    }
  }

  if (reminded || skipped) {
    logger.info(`[fileRequestReminder] ${reminded} reminded, ${skipped} skipped, ${candidates.length} candidates`)
  }
  return { reminded, skipped, candidates: candidates.length }
}

module.exports = {
  runFileRequestReminderPass,
  DUE_WITHIN_DAYS,
  REMINDER_COOLDOWN_HOURS,
}
