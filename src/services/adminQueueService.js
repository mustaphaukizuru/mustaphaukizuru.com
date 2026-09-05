const prisma = require("../lib/prisma")
const logger = require("../utils/logger")

/**
 * adminQueueService.js · everything waiting, across every project (T5-16)
 *
 * The operator's day is currently a tour: open each project, scroll for a
 * submitted document, an unanswered comment, a milestone that came back with
 * changes. Nothing anywhere says "these six things are waiting on you", and
 * the cost of that is not effort — it is the one that gets missed.
 *
 * TWO LISTS, AND THE SPLIT IS THE POINT
 *
 * `waitingOnMe`     the operator is the blocker. These are the ones to do.
 * `waitingOnClient` the client is. These are the ones to CHASE, and they are
 *                   a different action — a nudge, not an hour of work.
 *
 * Mixing them into one "open items" count is how a queue becomes wallpaper:
 * a number that never reaches zero because half of it was never yours.
 *
 * Closed and purged projects are excluded everywhere. A finished project with
 * an unanswered comment from March is not a task.
 */

/** How many rows of each kind, at most. A queue is a to-do list, not a report. */
const PER_KIND = 25

/** Only live work. */
const ACTIVE_PROJECT = { closedAt: null, purgedAt: null }

function projectRef(project) {
  return {
    id: project.id,
    name: project.projectName,
    trackingCode: project.trackingCode || null,
  }
}

/**
 * Everything the operator is blocking.
 *
 * Each row carries the link that lands on the thing itself — a queue that
 * says "a document is waiting" and drops you on a project page is a queue
 * you stop using.
 */
async function waitingOnMe() {
  const [requests, changesRequested, comments, tickets, changeRequests] = await Promise.all([
    // A document the client has sent and nobody has reviewed. First, because
    // the client is now waiting on us having already done their part.
    prisma.projectFileRequest.findMany({
      where: { status: "submitted", project: ACTIVE_PROJECT },
      orderBy: { submittedAt: "asc" },
      take: PER_KIND,
      select: {
        id: true, title: true, submittedAt: true,
        project: { select: { id: true, projectName: true, trackingCode: true } },
      },
    }),

    // A milestone the client sent back. The work is blocked until it is
    // looked at, and the client has already said what they want.
    prisma.projectMilestone.findMany({
      where: {
        changesRequestedAt: { not: null },
        status: { notIn: ["completed", "approved"] },
        project: ACTIVE_PROJECT,
      },
      orderBy: { changesRequestedAt: "asc" },
      take: PER_KIND,
      select: {
        id: true, title: true, changesRequestedAt: true, clientNote: true,
        project: { select: { id: true, projectName: true, trackingCode: true } },
      },
    }),

    // A client comment nobody has answered.
    prisma.projectComment.findMany({
      where: { authorRole: "client", resolvedAt: null, project: ACTIVE_PROJECT },
      orderBy: { createdAt: "asc" },
      take: PER_KIND,
      select: {
        id: true, body: true, createdAt: true, milestoneId: true,
        project: { select: { id: true, projectName: true, trackingCode: true } },
      },
    }),

    prisma.supportTicket.findMany({
      where: { status: { in: ["open", "in_progress"] }, project: ACTIVE_PROJECT },
      orderBy: { updatedAt: "asc" },
      take: PER_KIND,
      select: {
        id: true, subject: true, status: true, updatedAt: true,
        project: { select: { id: true, projectName: true, trackingCode: true } },
      },
    }),

    // Extra work the client has asked for and nobody has priced.
    prisma.changeRequest.findMany({
      where: { status: "requested", project: ACTIVE_PROJECT },
      orderBy: { createdAt: "asc" },
      take: PER_KIND,
      select: {
        id: true, title: true, createdAt: true,
        project: { select: { id: true, projectName: true, trackingCode: true } },
      },
    }),
  ])

  return [
    ...requests.map((r) => ({
      kind: "review_document",
      id: r.id,
      title: r.title,
      since: r.submittedAt,
      project: projectRef(r.project),
      href: `/admin/client-projects/${r.project.id}?request=${r.id}`,
    })),
    ...changesRequested.map((m) => ({
      kind: "changes_requested",
      id: m.id,
      title: m.title,
      detail: m.clientNote || null,
      since: m.changesRequestedAt,
      project: projectRef(m.project),
      href: `/admin/client-projects/${m.project.id}?milestone=${m.id}`,
    })),
    ...comments.map((c) => ({
      kind: "unanswered_comment",
      id: c.id,
      title: String(c.body || "").slice(0, 120),
      since: c.createdAt,
      project: projectRef(c.project),
      href: `/admin/client-projects/${c.project.id}?comment=${c.id}`,
    })),
    ...tickets.map((t) => ({
      kind: "open_ticket",
      id: t.id,
      title: t.subject,
      since: t.updatedAt,
      project: projectRef(t.project),
      href: `/admin/client-projects/${t.project.id}?ticket=${t.id}`,
    })),
    ...changeRequests.map((cr) => ({
      kind: "quote_change_request",
      id: cr.id,
      title: cr.title,
      since: cr.createdAt,
      project: projectRef(cr.project),
      href: `/admin/client-projects/${cr.project.id}?changeRequest=${cr.id}`,
    })),
  // Oldest first. A queue sorted newest-first buries the thing that has been
  // waiting longest, which is the one most likely to have been forgotten.
  ].sort((a, b) => new Date(a.since) - new Date(b.since))
}

/** Everything the CLIENT is blocking — to chase, not to do. */
async function waitingOnClient() {
  const [approvals, requests, invoices] = await Promise.all([
    prisma.projectMilestone.findMany({
      where: { status: "awaiting_client", project: ACTIVE_PROJECT },
      orderBy: { id: "asc" },
      take: PER_KIND,
      select: {
        id: true, title: true, dueDate: true,
        project: { select: { id: true, projectName: true, trackingCode: true } },
      },
    }),

    prisma.projectFileRequest.findMany({
      where: { status: { in: ["requested", "rejected"] }, project: ACTIVE_PROJECT },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
      take: PER_KIND,
      select: {
        id: true, title: true, dueAt: true, status: true, remindedAt: true,
        project: { select: { id: true, projectName: true, trackingCode: true } },
      },
    }),

    prisma.invoice.findMany({
      where: { status: { in: ["issued", "overdue"] } },
      orderBy: { dueDate: "asc" },
      take: PER_KIND,
      select: {
        id: true, invoiceNumber: true, dueDate: true, status: true,
        totalAmount: true, currency: true, orderId: true, serviceOrderId: true,
      },
    }),
  ])

  const now = new Date()
  return [
    ...approvals.map((m) => ({
      kind: "awaiting_approval",
      id: m.id,
      title: m.title,
      due: m.dueDate,
      overdue: Boolean(m.dueDate && m.dueDate < now),
      project: projectRef(m.project),
      href: `/admin/client-projects/${m.project.id}?milestone=${m.id}`,
    })),
    ...requests.map((r) => ({
      kind: "awaiting_document",
      id: r.id,
      title: r.title,
      due: r.dueAt,
      overdue: Boolean(r.dueAt && r.dueAt < now),
      // So the operator can see at a glance whether a nudge has already gone
      // out, and not send a second one by hand on top of the job's.
      remindedAt: r.remindedAt,
      project: projectRef(r.project),
      href: `/admin/client-projects/${r.project.id}?request=${r.id}`,
    })),
    ...invoices.map((i) => ({
      kind: "unpaid_invoice",
      id: i.id,
      title: i.invoiceNumber,
      due: i.dueDate,
      overdue: i.status === "overdue" || Boolean(i.dueDate && i.dueDate < now),
      amount: Number(i.totalAmount),
      currency: i.currency,
      project: null,
      href: "/admin/invoices",
    })),
  ].sort((a, b) => {
    // Overdue first, then by date. What is late is what needs the call.
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
    if (!a.due) return 1
    if (!b.due) return -1
    return new Date(a.due) - new Date(b.due)
  })
}

/**
 * Both lists, plus the two counts the sidebar badge and dashboard tile read.
 *
 * Never throws: this powers a badge on every admin page, and a queue that
 * cannot be built must not take the admin shell down with it.
 */
async function getQueue() {
  try {
    const [mine, theirs] = await Promise.all([waitingOnMe(), waitingOnClient()])
    return {
      waitingOnMe: mine,
      waitingOnClient: theirs,
      counts: {
        // The badge shows only what the operator can act on. A number that
        // includes what they are waiting for is a number that never reaches
        // zero, and a badge that never reaches zero stops being read.
        me: mine.length,
        client: theirs.length,
      },
    }
  } catch (err) {
    logger.error(`[adminQueue] ${err.message}`)
    return { waitingOnMe: [], waitingOnClient: [], counts: { me: 0, client: 0 }, error: true }
  }
}

module.exports = { PER_KIND, getQueue, waitingOnMe, waitingOnClient }
