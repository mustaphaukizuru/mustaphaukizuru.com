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
const projectEvents = require("./projectEventService")
const fileRequests = require("./projectFileRequestService")

const CLOSED_STATUSES = new Set(["completed", "cancelled"])
const ACCESS_STATES = ["active", "suspended", "handover"]
const UNPAID_INVOICE_STATUSES = ["issued", "overdue"]

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

async function loadOwnedProject({ userId, projectId, skipNda = false }) {
  const project = await prisma.clientProject.findFirst({
    where:  { id: String(projectId), userId: String(userId) },
    select: {
      id: true, userId: true, projectName: true, projectStatus: true, closedAt: true, updatedAt: true, assignedAdminId: true,
      requiresNda: true, ndaVersion: true, accessState: true,
    },
  })
  if (!project) throw err("Project not found", "NOT_FOUND", 404)
  // Tier 4 · every client write (upload, comment, approval, ticket) goes
  // through here, so the NDA gate is enforced once, centrally.
  if (!skipNda) await assertNdaAccepted(project, userId)
  return project
}

/* ── NDA click-wrap (Tier 4) ───────────────────────────────────────────── */

const NDA_TYPE = "nda"
const NDA_DEFAULT_VERSION = "1"
const AGREEMENT_TYPES = new Set([NDA_TYPE])

/** Effective NDA version for a project — admins may leave ndaVersion empty. */
function ndaVersionOf(project) {
  return String(project?.ndaVersion || NDA_DEFAULT_VERSION).trim().slice(0, 16)
}

/**
 * @returns {{ required:boolean, accepted:boolean, version:string|null, acceptedAt:Date|null }}
 * A project that does not require an NDA reports accepted=true so callers
 * can branch on `required && !accepted` without a second check.
 */
async function ndaStatus(project, userId) {
  if (!project?.requiresNda) return { required: false, accepted: true, version: null, acceptedAt: null }
  const version = ndaVersionOf(project)
  const row = await prisma.projectAgreement.findFirst({
    where:  { projectId: project.id, userId: String(userId), type: NDA_TYPE, version },
    select: { acceptedAt: true },
  })
  return { required: true, accepted: Boolean(row), version, acceptedAt: row?.acceptedAt || null }
}

async function assertNdaAccepted(project, userId) {
  const nda = await ndaStatus(project, userId)
  if (nda.required && !nda.accepted) {
    throw err("Please accept the project NDA before continuing.", "NDA_REQUIRED", 403, { version: nda.version })
  }
  return nda
}

/**
 * Strip everything covered by the NDA from a member project payload.
 * Header data (name, status, dates, lead) stays so the gate has context.
 */
function applyNdaGate(project) {
  return { ...project, milestones: [], files: [], comments: [], tickets: [], previewUrl: null, ndaGate: true }
}

/** POST /member/projects/:id/agreements — idempotent per (project, user, type, version). */
async function acceptAgreement({ userId, projectId, type, version, ipAddress = null, userAgent = null }) {
  const kind = String(type || "").trim().toLowerCase()
  if (!AGREEMENT_TYPES.has(kind)) throw err("Unsupported agreement type", "VALIDATION_ERROR", 400)
  const project = await loadOwnedProject({ userId, projectId, skipNda: true })
  assertReadable(project)
  if (!project.requiresNda) throw err("This project does not require an NDA", "INVALID_STATE", 409)
  const expected = ndaVersionOf(project)
  const given = String(version || "").trim()
  if (given && given !== expected) {
    throw err(`NDA version mismatch — please reload and accept version ${expected}`, "NDA_VERSION_MISMATCH", 409, { version: expected })
  }
  const row = await prisma.projectAgreement.upsert({
    where:  { projectId_userId_type_version: { projectId: project.id, userId: String(userId), type: kind, version: expected } },
    update: {},
    create: {
      projectId: project.id, userId: String(userId), type: kind, version: expected,
      ipAddress: ipAddress ? String(ipAddress).slice(0, 64) : null,
      userAgent: userAgent ? String(userAgent).slice(0, 512) : null,
    },
  })
  await prisma.activityLog.create({
    data: {
      userId: String(userId), action: "project.nda.accepted", entityType: "ClientProject", entityId: project.id,
      description: `Client accepted NDA v${expected} on ${project.projectName}`, ipAddress: ipAddress || null,
    },
  }).catch(() => null)
  return { type: kind, version: expected, acceptedAt: row.acceptedAt }
}

/* ── Access state (Tier 4 kill switch / handover gate) ─────────────────── */

function suspendGraceDays() {
  const n = Number(process.env.PROJECT_SUSPEND_GRACE_DAYS)
  return Number.isFinite(n) && n >= 0 ? n : 14
}

/**
 * Invoices that belong to a project = manual invoices raised against its
 * ServiceOrder + invoices on any order linked to it (the original service
 * order, accepted change-request orders). Unpaid = issued | overdue.
 */
function unpaidInvoiceWhere({ serviceOrderId, orderIds }) {
  const or = []
  if (serviceOrderId) or.push({ serviceOrderId })
  if (orderIds.length) or.push({ orderId: { in: orderIds } })
  if (!or.length) return null
  return { status: { in: UNPAID_INVOICE_STATUSES }, OR: or }
}

async function loadBillingLinks(projectId) {
  const p = await prisma.clientProject.findUnique({
    where:  { id: String(projectId) },
    select: {
      id: true, serviceOrderId: true, accessState: true,
      serviceOrder:   { select: { orderId: true } },
      changeRequests: { where: { orderId: { not: null } }, select: { orderId: true } },
    },
  })
  if (!p) return null
  const orderIds = [p.serviceOrder?.orderId, ...(p.changeRequests || []).map((c) => c.orderId)].filter(Boolean)
  return { ...p, orderIds }
}

/** Number of issued/overdue invoices on the project's linked orders. */
async function countUnpaidInvoices(projectId) {
  const links = await loadBillingLinks(projectId)
  if (!links) throw err("Project not found", "NOT_FOUND", 404)
  const where = unpaidInvoiceWhere(links)
  if (!where) return 0
  return prisma.invoice.count({ where })
}

/** Admin gate: handover only with a zero balance. Returns the validated state. */
async function assertAccessStateChange(projectId, next) {
  if (!ACCESS_STATES.includes(next)) throw err(`Invalid accessState. Expected one of: ${ACCESS_STATES.join(", ")}`, "VALIDATION_ERROR", 400)
  if (next === "handover") {
    const unpaid = await countUnpaidInvoices(projectId)
    if (unpaid > 0) throw err(`Handover is blocked: ${unpaid} unpaid invoice${unpaid === 1 ? "" : "s"} on this project`, "UNPAID_INVOICES", 409, { unpaid })
  }
  return next
}

/** 402 for deliverables while the project is suspended. */
function assertDeliverableAccess(project, file) {
  if (file?.isDeliverable && project?.accessState === "suspended") {
    throw err("This deliverable is on hold until the outstanding invoice is paid.", "PAYMENT_REQUIRED", 402)
  }
}

/**
 * Member-facing projection: while suspended the live preview is withheld
 * (URL omitted entirely, not just hidden) and `access` carries the state.
 */
function presentForMember(project, lc) {
  const state = ACCESS_STATES.includes(project?.accessState) ? project.accessState : "active"
  const suspended = state === "suspended"
  const { previewUrl, ...rest } = project
  return {
    ...rest,
    previewUrl:      suspended ? null : previewUrl || null,
    previewCanFrame: suspended ? false : previewCanFrame(previewUrl),
    access: {
      readOnly:  lc.readOnly,
      isClosed:  lc.isClosed,
      expiresAt: lc.expiresAt,
      state,
      suspended,
      handover:  state === "handover",
    },
  }
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

async function attachClientFiles({ userId, projectId, files = [], milestoneId = null, fileRequestId = null }) {
  const project = await loadOwnedProject({ userId, projectId })
  assertWritable(project)
  if (!files.length) throw err("No files uploaded", "VALIDATION_ERROR", 400)

  if (milestoneId) {
    const ms = await prisma.projectMilestone.findFirst({ where: { id: String(milestoneId), projectId: project.id }, select: { id: true } })
    if (!ms) throw err("Milestone not found on this project", "NOT_FOUND", 404)
  }

  // T5-3 · uploading against a document request. The id arrives from the
  // browser, so this checks it belongs to THIS project before anything is
  // written — otherwise a client could answer someone else's request by
  // guessing an id. It also enforces the request's own extension allowlist,
  // on top of the global one multer has already applied.
  let fileRequest = null
  if (fileRequestId) {
    fileRequest = await fileRequests.assertUploadable(
      fileRequestId,
      project.id,
      files.map((f) => f.originalname || f.fileName || ""),
    )
  }

  const rows = await prisma.$transaction(files.map((f) => prisma.projectFile.create({
    data: {
      projectId:      project.id,
      uploadedById:   String(userId),
      uploadedByRole: "client",
      milestoneId:    milestoneId ? String(milestoneId) : null,
      fileRequestId:  fileRequest ? fileRequest.id : null,
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

  if (fileRequest) {
    // Answers the request, and records file.received with the request's
    // title rather than the file name.
    await fileRequests.markSubmitted(fileRequest, rows[0])
  }

  // One event per upload, at "client" visibility: a file NAME can carry the
  // client's own client, a case number, a salary band. Never public.
  // Skipped when this upload answered a request — markSubmitted already
  // recorded that, and two events for one action reads as two uploads.
  for (const row of (fileRequest ? [] : rows)) {
    await projectEvents.record({
      projectId: project.id,
      type: "file.received",
      actorRole: "client",
      detail: row.fileName,
      detailEs: row.fileName,
      refs: { fileId: row.id, milestoneId: row.milestoneId || null },
    })
  }

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
  // The comment BODY is not carried into the event. The timeline says a
  // conversation happened; the conversation itself lives in the thread,
  // where the access rules for it already are.
  await projectEvents.record({
    projectId: project.id,
    type: "comment.added",
    actorRole: authorRole === "client" ? "client" : "admin",
    refs: { milestoneId: comment.milestoneId || null, fileId: comment.fileId || null },
  })
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
  // The client-facing event, beside the admin activityLog row above. The
  // note is deliberately NOT carried into the detail: the client wrote it
  // for us, and this event is public-adjacent.
  await projectEvents.record({
    projectId: project.id,
    type: "milestone.approved",
    actorRole: "client",
    detail: ms.title,
    detailEs: ms.title,
    refs: { milestoneId: ms.id },
  })
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
  await projectEvents.record({
    projectId: project.id,
    type: "milestone.changes_requested",
    actorRole: "client",
    detail: ms.title,
    detailEs: ms.title,
    refs: { milestoneId: ms.id },
  })
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
  ndaStatus, assertNdaAccepted, applyNdaGate, acceptAgreement, ndaVersionOf, NDA_DEFAULT_VERSION,
  ACCESS_STATES, UNPAID_INVOICE_STATUSES, suspendGraceDays,
  loadBillingLinks, unpaidInvoiceWhere, countUnpaidInvoices, assertAccessStateChange,
  assertDeliverableAccess, presentForMember,
  validatePreviewUrl, previewCanFrame, previewFrameHosts,
  attachClientFiles,
  listComments, createComment, resolveComment,
  approveMilestone, requestMilestoneChanges, onMilestoneAwaitingClient,
  CLOSED_STATUSES,
}
