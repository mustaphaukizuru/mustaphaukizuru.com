/**
 * projectTrackingService.js · the anonymous "where is my project" lookup (T5-2).
 *
 * This is the first unauthenticated endpoint on the platform that returns
 * data about a specific, named client engagement, and the contract it obeys
 * is written down in docs/decisions/0006-tracking-code-public-surface.md.
 * Read that before adding a field.
 *
 * The short version, because the temptation is always to add one more thing:
 *
 *   - the response is built by ONE serializer with an explicit field list.
 *     Adding to it is a change to ADR 0006, not a convenience during a
 *     frontend task. The risk is never the first version; it is the fourth,
 *     when somebody adds the invoice total because a page needed it.
 *
 *   - no project name, because a project name is usually the client's name or
 *     names something unannounced. No amounts, no file names, no comments.
 *     Someone holding the code already knows whose project it is; someone who
 *     found a forwarded link learns only that work is progressing.
 *
 *   - no portal token. Returning one in a response keyed by a shareable code
 *     would turn the shareable code into a credential.
 *
 *   - a code stops answering once the project has been closed longer than
 *     PROJECT_ACCESS_GRACE_DAYS, reusing the lifetime the portal already has
 *     rather than inventing a second one.
 */

const prisma = require("../lib/prisma")
const logger = require("../utils/logger")
const { normalizeTrackingCode } = require("../utils/trackingCode")
const { serializePublicEvent } = require("./projectEventService")

const CLOSED_STATUSES = new Set(["completed", "cancelled"])

/** Same default and same env var as the member portal. */
function graceDays() {
  const n = Number(process.env.PROJECT_ACCESS_GRACE_DAYS)
  return Number.isFinite(n) && n >= 0 ? n : 30
}

/** Has a closed project passed its readable window? */
function isExpired(project, now = new Date()) {
  if (!project?.closedAt) return false
  const cutoff = new Date(project.closedAt)
  cutoff.setDate(cutoff.getDate() + graceDays())
  return now > cutoff
}

/**
 * Percent complete, from milestones.
 *
 * Zero milestones is 0, not 100: a project with no plan yet has made no
 * measurable progress, and dividing by zero to reach "done" would tell a
 * client their project was finished before it started.
 */
function percentComplete(milestones = []) {
  if (!milestones.length) return 0
  const done = milestones.filter((m) => m.status === "completed" || m.approvedAt).length
  return Math.round((done / milestones.length) * 100)
}

/**
 * The public projection. THE ONLY PLACE this response is shaped.
 *
 * @param {object} project  a project row with milestones, public events and a request count
 * @param {"en"|"es"} locale
 */
function serializePublicProject(project, locale = "en") {
  const milestones = project.milestones || []
  return {
    // The code the caller already holds, echoed so a client can confirm they
    // are looking at the right thing. Not the project name — see ADR 0006.
    reference: project.trackingCode,
    status: project.projectStatus,
    percentComplete: percentComplete(milestones),
    startDate: project.startDate?.toISOString?.() || null,
    dueDate: project.dueDate?.toISOString?.() || null,
    isClosed: CLOSED_STATUSES.has(project.projectStatus) || Boolean(project.closedAt),
    // Titles and status only. A milestone description can contain scope
    // notes, names and figures.
    milestones: milestones.map((m) => ({
      title: m.title,
      status: m.status,
      completedAt: m.completedAt?.toISOString?.() || null,
    })),
    // Already filtered to visibility "public" by the query; projected again
    // here so `detail` cannot leak through a future caller's carelessness.
    events: (project.events || []).map((e) => serializePublicEvent(e, locale)),
    // A count, not the requests. "You owe us two documents" is useful; which
    // documents is not the anonymous surface's business.
    openRequestCount: project.openRequestCount || 0,
    // Destinations, not credentials: no portal token (ADR 0006).
    links: {
      portal: "/portal",
      dashboard: "/dashboard/projects",
    },
  }
}

/**
 * Look up a project by tracking code.
 *
 * Returns null for unknown, malformed AND expired codes alike. A
 * distinguishable "expired" answer would confirm that a code was once real,
 * which is a small oracle but a free one to close.
 */
async function findByTrackingCode(rawCode, { locale = "en" } = {}) {
  const code = normalizeTrackingCode(rawCode)
  if (!code) return null

  const project = await prisma.clientProject.findUnique({
    where: { trackingCode: code },
    select: {
      id: true,
      trackingCode: true,
      projectStatus: true,
      startDate: true,
      dueDate: true,
      closedAt: true,
      milestones: {
        select: { title: true, status: true, completedAt: true, approvedAt: true },
        // ProjectMilestone has no createdAt; sortOrder is the plan's own order.
        orderBy: { sortOrder: "asc" },
      },
      events: {
        where: { visibility: "public" },
        select: { type: true, title: true, titleEs: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  })

  if (!project) return null
  if (isExpired(project)) return null

  const openRequestCount = await prisma.projectFileRequest.count({
    where: { projectId: project.id, status: { in: ["requested", "rejected"] } },
  })

  return serializePublicProject({ ...project, openRequestCount }, locale)
}

/**
 * Note a miss, so a sweep is visible rather than merely slow.
 *
 * In-memory and per-process, which is enough for its purpose: it is a signal
 * to look, not a control. The rate limiter is the control.
 */
const missCounts = new Map()
const MISS_ALERT_THRESHOLD = 10
const MISS_WINDOW_MS = 15 * 60 * 1000

function noteMiss(ip) {
  if (!ip) return
  const now = Date.now()
  const entry = missCounts.get(ip)
  if (!entry || now - entry.first > MISS_WINDOW_MS) {
    missCounts.set(ip, { count: 1, first: now })
    return
  }
  entry.count += 1
  if (entry.count === MISS_ALERT_THRESHOLD) {
    logger.warn?.(`[track] ${entry.count} consecutive unknown tracking codes from ${ip} — possible enumeration sweep`)
  }
  // Keep the map from growing without bound on a long-running process.
  if (missCounts.size > 5000) missCounts.clear()
}

function noteHit(ip) {
  if (ip) missCounts.delete(ip)
}

module.exports = {
  findByTrackingCode,
  serializePublicProject,
  percentComplete,
  isExpired,
  noteMiss,
  noteHit,
  MISS_ALERT_THRESHOLD,
}
