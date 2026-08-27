/**
 * projectPortalService · Tier 2 client-portal collaboration.
 *
 * Everything the CLIENT can do inside a project, plus the admin-side
 * counterparts that share the same rules:
 *   - lifecycle guard   (closed → read-only, expired → 410)
 *   - client uploads     (ProjectFile rows with uploadedByRole = "client")
 *   - comments           (project / milestone / file anchored, both roles)
 *   - one-click approval / request-changes on awaiting_client milestones
 *   - previewUrl validation (link always; iframe only for allow-listed hosts)
 *   - admin-directed notifications for every client action
 *
 * clientProjectService stays the CRUD source of truth; this module composes
 * it. Nothing here throws raw Prisma errors at the controller — every
 * failure is an Error with `.code` + `.statusCode` the controllers map 1:1.
 */

const prisma = require("../lib/prisma")
const logger = require("../utils/logger")
const { notifyAdminsProjectActivity, notifyProjectComment, notifyMilestoneAwaitingClient } = require("./notificationService")

const CLOSED_STATUSES = new Set(["completed", "cancelled"])

function graceDays() {
  const n = Number(process.env.PROJECT_ACCESS_GRACE_DAYS)
  return Number.isFinite(n) && n >= 0 ? n : 30
}

function err(message, code, statusCode = 400, details) {
  const e = new Error(message)
  e.code = code
  e.statusCode = statusCode
  if (details) e.details = details
  return e
}

/* ── Lifecycle ─────────────────────────────────────────────────────────── */

/**
 * @returns {{ isClosed:boolean, isExpired:boolean, readOnly:boolean, expiresAt:Date|null }}
 */
function lifecycle(project, now = new Date()) {
  const closedAt = project?.closedAt ? new Date(project.closedAt)
    : (CLOSED_STATUSES.has(project?.projectStatus) ? new Date(project.updatedAt || now) : null)
  const isClosed = Boolean(closedAt)
  const expiresAt = closedAt ? new Date(closedAt.getTime() + graceDays() * 24 * 60 * 60 * 1000) : null
  const isExpired = Boolean(expiresAt && now.getTime() > expiresAt.getTime())
  return { isClosed, isExpired, readOnly: isClosed, expiresAt }
}

/** Throw 410 for expired projects (member reads) — caller passes the row. */
function assertReadable(project) {
  const lc = lifecycle(project)
  if (lc.isExpired) throw err("This project is no longer available. Contact support if you need its files.", "PROJECT_EXPIRED", 410)
  return lc
}

/** Throw 409 for closed projects (member writes). */
function assertWritable(project) {
  const lc = assertReadable(project)
  if (lc.readOnly) throw err("This project is closed — it can still be viewed, but no longer accepts uploads, comments or approvals.", "PROJECT_CLOSED", 409)
  return lc
}

async function loadOwnedProject({ userId, projectId }) {
  const project = await prisma.clientProject.findFirst({
    where:  { id: String(projectId), userId: String(userId) },
    select: { id: true, userId: true, projectName: true, projectStatus: true, closedAt: true, updatedAt: true, assignedAdminId: true },
  })
  if (!project) throw err("Project not found", "NOT_FOUND", 404)
  return project
}

/* ── Preview URL ───────────────────────────────────────────────────────── */

function previewFrameHosts() {
  return String(process.env.PREVIEW_FRAME_HOSTS || "")
    .split(",").map((s) => s.trim()).filter(Boolean)
}

/** Only http(s) URLs; returns the normalised string or throws. */
function validatePreviewUrl(value) {
  if (value == null || String(value).trim() === "") return null
  let u
  try { u = new URL(String(value).trim()) } catch { throw err("previewUrl must be an absolute http(s) URL", "VALIDATION_ERROR", 400) }
  if (!["http:", "https:"].includes(u.protocol)) throw err("previewUrl must use http or https", "VALIDATION_ERROR", 400)
  return u.toString().slice(0, 2000)
}

/** Host allow-list match: exact origin or `https://*.example.com` wildcard. */
function previewCanFrame(previewUrl) {
  if (!previewUrl) return false
  let u
  try { u = new URL(previewUrl) } catch { return false }
  return previewFrameHosts().some((pattern) => {
    try {
      const p = new URL(pattern.replace("*.", "wildcard."))
      if (p.protocol !== u.protocol) return false
      if (pattern.includes("*.")) {
        const suffix = p.hostname.replace(/^wildcard\./, "")
        return u.hostname === suffix || u.hostname.endsWith(`.${suffix}`)
      }
      return p.hostname === u.hostname
    } catch { return false }
  })
}

/* ── Client uploads ────────────────────────────────────────────────────── */

async function attachClientFiles({ userId, projectId, files = [], milestoneId = null }) {
  const project = await loadOwnedProject({ userId, projectId })
  assertWritable(project)
  if (!files.length) throw err("No files uploaded", "VALIDATION_ERROR", 400)

  if (milestoneId) {
    const ms = await prisma.projectMilestone.findFirst({ where: { id: String(milestoneId), projectId: project.id }, select: { id: true } })
    if (!ms) throw err("Milestone not found on this project", "NOT_FOUND", 404)
  }

  const rows = await prisma.$transaction(files.map((f) => prisma.projectFile.create({
    data: {
      projectId:      project.id,
      uploadedById:   String(userId),
      uploadedByRole: "client",
      milestoneId:    milestoneId ? String(milestoneId) : null,
      fileName:       String(f.originalname || f.fileName || "file").trim().slice(0, 255),
      filePath:       `/files/projects/${project.id}/${f.filename}`,
      fileType:       f.mimetype || null,
      fileSize:       Number.isFinite(f.size) ? f.size : null,
    },
  })))

  await prisma.activityLog.create({
    data: {
      userId:      String(userId),
      action:      "project.file.uploaded",
      entityType:  "ClientProject",
      entityId:    project.id,
      description: `Client uploaded ${rows.length} file(s) to ${project.projectName}`,
    },
  }).catch(() => null)

  notifyAdminsProjectActivity({
    project, kind: "upload",
    summary: `${rows.length} file(s) uploaded: ${rows.slice(0, 3).map((r) => r.fileName).join(", ")}${rows.length > 3 ? "…" : ""}`,
  }).catch((e) => logger.warn("[portal] admin notify failed", e.message))

  return rows
}

/* ── Comments ──────────────────────────────────────────────────────────── */

const COMMENT_INCLUDE = {
  author: { select: { id: true, fullName: true, role: true } },
}

async function listComments({ projectId, milestoneId, take = 200 }) {
  return prisma.projectComment.findMany({
    where:   { projectId: String(projectId), ...(milestoneId ? { milestoneId: String(milestoneId) } : {}) },
    orderBy: { createdAt: "asc" },
    include: COMMENT_INCLUDE,
    take:    Math.min(500, Math.max(1, take)),
  })
}

async function createComment({ projectId, authorId, authorRole, body, milestoneId = null, fileId = null }) {
  const text = String(body || "").trim()
  if (!text) throw err("Comment body is required", "VALIDATION_ERROR", 400)
  if (text.length > 5000) throw err("Comment is too long (max 5000 characters)", "VALIDATION_ERROR", 400)
  if (!["admin", "client"].includes(authorRole)) throw err("Invalid author role", "VALIDATION_ERROR", 400)

  const project = authorRole === "client"
    ? await loadOwnedProject({ userId: authorId, projectId })
    : await prisma.clientProject.findUnique({ where: { id: String(projectId) }, select: { id: true, userId: true, projectName: true, projectStatus: true, closedAt: true, updatedAt: true, assignedAdminId: true } })
  if (!project) throw err("Project not found", "NOT_FOUND", 404)
  if (authorRole === "client") assertWritable(project)

  if (milestoneId) {
    const ms = await prisma.projectMilestone.findFirst({ where: { id: String(milestoneId), projectId: project.id }, select: { id: true } })
    if (!ms) throw err("Milestone not found on this project", "NOT_FOUND", 404)
  }
  if (fileId) {
    const f = await prisma.projectFile.findFirst({ where: { id: String(fileId), projectId: project.id }, select: { id: true } })
    if (!f) throw err("File not found on this project", "NOT_FOUND", 404)
  }

  const comment = await prisma.projectComment.create({
    data: {
      projectId:   project.id,
      milestoneId: milestoneId ? String(milestoneId) : null,
      fileId:      fileId ? String(fileId) : null,
      authorId:    String(authorId),
      authorRole,
      body:        text,
    },
    include: COMMENT_INCLUDE,
  })

  if (authorRole === "client") {
    notifyAdminsProjectActivity({ project, kind: "comment", summary: text.slice(0, 140) })
      .catch((e) => logger.warn("[portal] admin notify failed", e.message))
  } else {
    notifyProjectComment(project.userId, { project, comment })
      .catch((e) => logger.warn("[portal] client notify failed", e.message))
  }
  return comment
}

async function resolveComment({ commentId, adminId }) {
  const c = await prisma.projectComment.findUnique({ where: { id: String(commentId) } })
  if (!c) throw err("Comment not found", "NOT_FOUND", 404)
  return prisma.projectComment.update({
    where: { id: c.id },
    data:  { resolvedAt: c.resolvedAt ? null : new Date() },
    include: COMMENT_INCLUDE,
  }).then((row) => { void adminId; return row })
}

/* ── Approvals ─────────────────────────────────────────────────────────── */

async function loadOwnedMilestone({ userId, projectId, milestoneId }) {
  const project = await loadOwnedProject({ userId, projectId })
  assertWritable(project)
  const ms = await prisma.projectMilestone.findFirst({ where: { id: String(milestoneId), projectId: project.id } })
  if (!ms) throw err("Milestone not found on this project", "NOT_FOUND", 404)
  return { project, ms }
}

async function approveMilestone({ userId, projectId, milestoneId, note = null }) {
  const { project, ms } = await loadOwnedMilestone({ userId, projectId, milestoneId })
  if (ms.status !== "awaiting_client") {
    throw err(`Milestone is "${ms.status}" — only milestones awaiting your review can be approved`, "INVALID_STATE", 409)
  }
  const updated = await prisma.projectMilestone.update({
    where: { id: ms.id },
    data:  {
      status:             "approved",
      approvedAt:         new Date(),
      approvedById:       String(userId),
      changesRequestedAt: null,
      clientNote:         note ? String(note).trim().slice(0, 2000) : null,
    },
  })
  await prisma.activityLog.create({
    data: {
      userId: String(userId), action: "project.milestone.approved", entityType: "ProjectMilestone", entityId: ms.id,
      description: `Client approved "${ms.title}" on ${project.projectName}`,
    },
  }).catch(() => null)
  notifyAdminsProjectActivity({ project, kind: "approval", summary: `"${ms.title}" approved${note ? ` — ${String(note).slice(0, 100)}` : ""}` })
    .catch((e) => logger.warn("[portal] admin notify failed", e.message))
  return updated
}

async function requestMilestoneChanges({ userId, projectId, milestoneId, note }) {
  const text = String(note || "").trim()
  if (!text) throw err("Tell us what should change (note is required)", "VALIDATION_ERROR", 400)
  const { project, ms } = await loadOwnedMilestone({ userId, projectId, milestoneId })
  if (!["awaiting_client", "approved"].includes(ms.status)) {
    throw err(`Milestone is "${ms.status}" — changes can be requested only on delivered work`, "INVALID_STATE", 409)
  }
  const updated = await prisma.projectMilestone.update({
    where: { id: ms.id },
    data:  {
      status:             "in_progress",
      approvedAt:         null,
      approvedById:       null,
      changesRequestedAt: new Date(),
      clientNote:         text.slice(0, 2000),
    },
  })
  // The note is also a comment on the milestone so the thread carries it.
  await prisma.projectComment.create({
    data: { projectId: project.id, milestoneId: ms.id, authorId: String(userId), authorRole: "client", body: text.slice(0, 5000) },
  }).catch(() => null)
  await prisma.activityLog.create({
    data: {
      userId: String(userId), action: "project.milestone.changes_requested", entityType: "ProjectMilestone", entityId: ms.id,
      description: `Client requested changes on "${ms.title}" (${project.projectName})`,
    },
  }).catch(() => null)
  notifyAdminsProjectActivity({ project, kind: "changes", summary: `Changes requested on "${ms.title}": ${text.slice(0, 120)}` })
    .catch((e) => logger.warn("[portal] admin notify failed", e.message))
  return updated
}

/** Admin moved a milestone to awaiting_client → tell the client. */
async function onMilestoneAwaitingClient({ project, milestone }) {
  return notifyMilestoneAwaitingClient(project.userId, { project, milestone })
}

module.exports = {
  lifecycle, assertReadable, assertWritable, loadOwnedProject,
  validatePreviewUrl, previewCanFrame, previewFrameHosts,
  attachClientFiles,
  listComments, createComment, resolveComment,
  approveMilestone, requestMilestoneChanges, onMilestoneAwaitingClient,
  CLOSED_STATUSES,
}
