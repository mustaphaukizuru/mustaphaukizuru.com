const prisma = require("../lib/prisma")
const logger = require("../utils/logger")
const projectEvents = require("../services/projectEventService")
const projectInvoices = require("../services/projectInvoiceService")
const projectEmails = require("../services/projectEmailService")

/**
 * weeklyDigestJob.js · one Monday email per active project (T5-15)
 *
 * Between a milestone landing and an invoice going out, a client hears
 * nothing. The tracker is there for them to check, but checking is a thing
 * people do when they are already worried. This is the message that arrives
 * before the worry.
 *
 * THE RULE THAT MAKES IT SURVIVABLE
 *
 * A digest that arrives every Monday saying "nothing happened" is a digest
 * people filter, and once filtered it is gone for the week something DID
 * happen. So: nothing to report, no email. Not a shorter email — none.
 *
 * "Nothing" means no client-visible events in seven days, no outstanding
 * documents and no unpaid invoices. The second and third are deliberately
 * part of it: a week where nothing moved but the client still owes us a
 * document is exactly the week worth writing.
 *
 * OPT-OUT
 *
 * Per project, not per person. A client with three projects may want the
 * digest for the one that is live and not for the two that are winding
 * down, and one global switch would make them choose all or nothing.
 */

/** How far back a digest looks. */
const WINDOW_DAYS = 7
/** At most this many events in one email; the rest is "and N more". */
const MAX_EVENTS = 8

function weekAgo(now) {
  return new Date(now.getTime() - WINDOW_DAYS * 86_400_000)
}

/**
 * Build one project's digest, or null when there is nothing to say.
 *
 * Separated from the send so the decision "is this worth an email" is
 * testable without a mail transport.
 */
async function buildDigest(project, { now = new Date() } = {}) {
  const since = weekAgo(now)

  const [events, openRequests, billing] = await Promise.all([
    // The client's ceiling, never the admin one — a digest is an email, and
    // an email is the easiest thing in the world to forward.
    prisma.projectEvent.findMany({
      where: {
        projectId: project.id,
        createdAt: { gte: since },
        visibility: { in: projectEvents.visibilitiesFor("client") },
      },
      orderBy: { createdAt: "desc" },
      take: MAX_EVENTS + 1,
    }).catch(() => []),

    prisma.projectFileRequest.findMany({
      where: { projectId: project.id, status: { in: ["requested", "rejected"] } },
      orderBy: [{ dueAt: "asc" }],
      select: { id: true, title: true, titleEs: true, dueAt: true },
    }).catch(() => []),

    projectInvoices.listForProject(project.id).catch(() => ({ billing: null })),
  ])

  const unpaid = billing?.billing?.unpaidCount || 0

  // The rule. Nothing moved, nothing owed, nothing outstanding — no email.
  if (!events.length && !openRequests.length && !unpaid) return null

  return {
    project,
    events: events.slice(0, MAX_EVENTS),
    moreEvents: Math.max(0, events.length - MAX_EVENTS),
    openRequests,
    billing: billing?.billing || null,
  }
}

/**
 * One pass. Monday morning, Mexico City.
 *
 * Every project is independent: one that fails to build or send must not
 * stop the rest, because the alternative is that a single bad row silences
 * the digest for every client.
 */
async function runWeeklyDigestPass({ now = new Date() } = {}) {
  const projects = await prisma.clientProject.findMany({
    where: {
      closedAt: null,
      purgedAt: null,
      digestOptOut: false,
      // No code, no digest: every project email refuses to send without one
      // rather than mail a literal placeholder (T5-6), so this would be a
      // guaranteed no-op with a warning per project per week.
      trackingCode: { not: null },
    },
    select: {
      id: true, userId: true, projectName: true, trackingCode: true,
      projectStatus: true, assignedAdminId: true,
    },
    take: 500,
  })

  let sent = 0
  let skipped = 0

  for (const project of projects) {
    try {
      const digest = await buildDigest(project, { now })
      if (!digest) { skipped += 1; continue }
      const ok = await projectEmails.sendWeeklyDigest(digest)
      if (ok) sent += 1
      else skipped += 1
    } catch (err) {
      logger.error(`[weeklyDigest] ${project.id}: ${err.message}`)
      skipped += 1
    }
  }

  if (sent || skipped) {
    logger.info(`[weeklyDigest] ${sent} sent, ${skipped} skipped, ${projects.length} active projects`)
  }
  return { sent, skipped, projects: projects.length }
}

module.exports = { runWeeklyDigestPass, buildDigest, WINDOW_DAYS, MAX_EVENTS }
