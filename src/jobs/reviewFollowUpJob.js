const prisma = require("../lib/prisma")
const logger = require("../utils/logger")
const { sendTemplateEmail } = require("../services/emailService")
const { resolveUserLocale } = require("../utils/resolveUserLocale")

/**
 * reviewFollowUpJob.js · one nudge, a week later (T5-21)
 *
 * A review-request email already goes out the moment a project is marked
 * complete. That is the worst possible moment to ask: the client is still
 * checking the deliverables, and the request lands in the same hour as three
 * other emails from us.
 *
 * A week later they know whether the work was any good, and — this is the
 * part that matters — most of the people who WOULD write something have
 * simply forgotten. This is the reminder for them, and only for them.
 *
 * THREE CONDITIONS, AND EACH IS A WAY OF NOT BEING ANNOYING
 *
 *   completed seven days ago   long enough to have an opinion
 *   no Review on the project   they have not already done it
 *   reviewRequestedAt is null  they have not already been nudged
 *
 * The third is what makes it ONCE. A client who did not want to review the
 * work after the first ask did not want to after the second either, and a
 * third would be the message that makes them stop reading us.
 */

/** How long after completion the nudge goes out. */
const FOLLOW_UP_DAYS = 7
/** A ceiling, so a backlog cannot become a mailshot. */
const MAX_PER_PASS = 50

function frontendBase() {
  return String(process.env.FRONTEND_URL || process.env.CLIENT_URL || "").replace(/\/$/, "")
}

async function runReviewFollowUpPass({ now = new Date() } = {}) {
  const cutoff = new Date(now.getTime() - FOLLOW_UP_DAYS * 86_400_000)

  const projects = await prisma.clientProject.findMany({
    where: {
      projectStatus: "completed",
      closedAt: { not: null, lte: cutoff },
      purgedAt: null,
      // Not yet nudged.
      reviewRequestedAt: null,
      // And no review exists for this project. `none` rather than a second
      // query: a client who reviewed on day two must never be asked again.
      reviews: { none: {} },
    },
    select: {
      id: true, userId: true, projectName: true, trackingCode: true, closedAt: true,
      serviceOrder: { select: { service: { select: { title: true } } } },
      user: { select: { email: true, fullName: true, profile: { select: { country: true } } } },
    },
    take: MAX_PER_PASS,
  })

  let sent = 0
  let skipped = 0

  for (const project of projects) {
    const to = project.user?.email
    if (!to) { skipped += 1; continue }

    try {
      // Stamped BEFORE the send, and that order is deliberate. If the mail
      // fails we have burned the one nudge — but the alternative is that a
      // send which succeeds and then fails to stamp asks the same client
      // again tomorrow, and every day after. Silence is the cheaper failure.
      const claim = await prisma.clientProject.updateMany({
        where: { id: project.id, reviewRequestedAt: null },
        data:  { reviewRequestedAt: now },
      })
      // Another process got there first.
      if (claim.count !== 1) { skipped += 1; continue }

      const base = frontendBase()
      const result = await sendTemplateEmail({
        to,
        // A distinct template, not a resend of the completion email. A
        // week later the client already ignored those words once.
        templateKey: "project.review-follow-up",
        locale: resolveUserLocale({ user: project.user }),
        userId: project.userId,
        variables: {
          customerName: String(project.user?.fullName || "there").split(" ")[0],
          projectName:  project.projectName,
          serviceName:  project.serviceOrder?.service?.title || project.projectName,
          reviewUrl:    `${base}/dashboard/projects/${project.id}?review=1`,
        },
      })
      if (result?.ok === false) {
        logger.warn(`[reviewFollowUp] ${project.id}: ${result.error}`)
        skipped += 1
      } else {
        sent += 1
      }
    } catch (err) {
      logger.error(`[reviewFollowUp] ${project.id}: ${err.message}`)
      skipped += 1
    }
  }

  if (sent || skipped) {
    logger.info(`[reviewFollowUp] ${sent} sent, ${skipped} skipped, ${projects.length} eligible`)
  }
  return { sent, skipped, eligible: projects.length }
}

module.exports = { runReviewFollowUpPass, FOLLOW_UP_DAYS, MAX_PER_PASS }
