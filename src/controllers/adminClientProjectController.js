const asyncHandler = require("../utils/asyncHandler")
const fs    = require("fs/promises")
const logger = require("../utils/logger")
const prisma = require("../lib/prisma")
const { sendProjectFile, resolveSafePath } = require("./clientProjectController")
const { createComment, resolveComment, onMilestoneAwaitingClient } = require("../services/projectPortalService")
const { mintPortalLink } = require("../services/portalAccessService")
const { createCaseStudyDraft } = require("../services/projectCaseStudyService")
const fileRequests = require("../services/projectFileRequestService")
const projectEvents = require("../services/projectEventService")
const { notify } = require("../services/notificationService")
const { notifyFileRequested, notifyFileReviewed, notifyProjectPhase } = require("../services/notificationService")
const projectEmails = require("../services/projectEmailService")
const {
  listAdminProjects, getAdminProject, createAdminProject, updateAdminProject, deleteAdminProject,
  createMilestone, updateMilestone, deleteMilestone,
  attachFile, deleteFile,
  VALID_PROJECT_STATUSES, VALID_MILESTONE_STATUSES,
} = require("../services/clientProjectService")
const { addAdminMessage } = require("../services/supportService")
const changeRequestService = require("../services/changeRequestService")
const { sendTemplateEmail } = require("../services/emailService")
const { notifyProjectMilestoneCompleted } = require("../services/notificationService")

const { resolveUserLocale } = require("../utils/resolveUserLocale")
function badRequest(res, message)        { return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message } }) }
function notFound(res)                    { return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Project or milestone not found" } }) }

/* ── Projects ────────────────────────────────────────────────────────── */
const listProjects = asyncHandler(async (_req, res) => {
  const data = await listAdminProjects()
  res.status(200).json({ success: true, data })
})

const getProject = asyncHandler(async (req, res) => {
  const project = await getAdminProject(req.params.id)
  if (!project) return notFound(res)
  res.status(200).json({ success: true, data: project })
})

const createProject = asyncHandler(async (req, res) => {
  if (!req.body?.serviceOrderId) return badRequest(res, "serviceOrderId is required")
  if (!req.body?.userId)         return badRequest(res, "userId is required")
  if (!req.body?.projectName)    return badRequest(res, "projectName is required")
  try {
    const created = await createAdminProject(req.body)
    res.status(201).json({ success: true, data: created })
  } catch (e) {
    if (e?.code === "P2002") return badRequest(res, "A project already exists for that service order")
    if (e?.code === "P2003") return badRequest(res, "Service order or user not found")
    throw e
  }
})

/**
 * T5-6 · which phase changes are worth an email.
 *
 * Not `planning` — that is where a project starts, and project.tracking-code
 * already covered it. Not `cancelled` — that deserves a conversation, and an
 * automated "your project is now cancelled" is the wrong way to hear it. The
 * in-app notification still fires for both.
 */
const EMAILED_PHASES = new Set(["in_progress", "review", "completed"])

const updateProject = asyncHandler(async (req, res) => {
  try {
    // Read the status before the write so both side-effects below describe a
    // TRANSITION: re-saving an already-complete project should not send the
    // client a second "it is done" email.
    const statusChanging = typeof req.body?.projectStatus === "string"
    const before = statusChanging
      ? await prisma.clientProject.findUnique({ where: { id: String(req.params.id) }, select: { projectStatus: true } })
      : null
    const updated = await updateAdminProject(req.params.id, req.body)
    const moved = Boolean(before && before.projectStatus !== updated.projectStatus)

    if (moved && updated.projectStatus === "completed") {
      sendReviewRequest({ req, project: updated })
        .catch((err) => logger.error("[project] review-request email failed:", err.message))
    }
    if (moved) {
      notifyProjectPhase(updated.userId, { project: updated, status: updated.projectStatus })
        .catch((err) => logger.warn(`[project] phase notify failed: ${err.message}`))
      if (EMAILED_PHASES.has(updated.projectStatus)) {
        projectEmails.sendStatusUpdate({ project: updated, status: updated.projectStatus, locale: resolveUserLocale({ req }) })
          .catch((err) => logger.warn(`[project] status-update email failed: ${err.message}`))
      }
    }
    res.status(200).json({ success: true, data: updated })
  } catch (e) {
    if (e?.code === "P2025") return notFound(res)
    if (e?.statusCode && e?.code) return res.status(e.statusCode).json({ success: false, error: { code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) } })
    if (e?.message?.startsWith("Invalid project status")) return badRequest(res, e.message)
    throw e
  }
})

const removeProject = asyncHandler(async (req, res) => {
  try {
    const result = await deleteAdminProject(req.params.id)
    // DB cascade removed the ProjectFile rows; remove the bytes too, or the
    // storage tree slowly fills with orphans nobody can reach.
    for (const p of result.filePaths || []) await unlinkProjectFile(p)
    res.status(200).json({ success: true, data: { id: result.id, deleted: true } })
  } catch (e) {
    if (e?.code === "P2025") return notFound(res)
    throw e
  }
})

/** Email the client asking for a review of the just-completed project. */
async function sendReviewRequest({ req, project }) {
  const to = project.user?.email || (await fetchUserEmail(project.userId))
  if (!to) return
  const base = (process.env.FRONTEND_URL || process.env.CLIENT_URL || "").replace(/\/$/, "")
  return sendTemplateEmail({
    locale:      resolveUserLocale({ req }),
    to,
    templateKey: "project.review-request",
    userId:      project.userId,
    variables: {
      projectName: project.projectName,
      serviceName: project.serviceOrder?.service?.title || project.projectName,
      reviewUrl:   `${base}/dashboard/projects/${project.id}?review=1`,
    },
  })
}

/**
 * POST /admin/client-projects/:id/case-study-draft
 * Creates a draft Portfolio row from the project and returns the edit URL.
 */
const createCaseStudy = asyncHandler(async (req, res) => {
  try {
    const data = await createCaseStudyDraft(req.params.id, req.user?.id)
    res.status(201).json({ success: true, data })
  } catch (e) {
    if (e?.statusCode && e?.code) return res.status(e.statusCode).json({ success: false, error: { code: e.code, message: e.message } })
    throw e
  }
})

/**
 * POST /admin/client-projects/:id/portal-link
 * Mints (or rotates) the no-login magic link for this project.
 */
const createPortalLink = asyncHandler(async (req, res) => {
  try {
    const data = await mintPortalLink(req.params.id)
    res.status(201).json({ success: true, data })
  } catch (e) {
    if (e?.statusCode && e?.code) return res.status(e.statusCode).json({ success: false, error: { code: e.code, message: e.message } })
    throw e
  }
})

/* ── Milestones ──────────────────────────────────────────────────────── */
const addMilestone = asyncHandler(async (req, res) => {
  if (!req.body?.title) return badRequest(res, "title is required")
  try {
    const created = await createMilestone(req.params.id, req.body)
    res.status(201).json({ success: true, data: created })
  } catch (e) {
    if (e?.code === "P2003") return badRequest(res, "Project not found")
    throw e
  }
})

const patchMilestone = asyncHandler(async (req, res) => {
  try {
    const { milestone, project, isNewlyComplete, isNewlyAwaitingClient } = await updateMilestone(req.params.milestoneId, req.body)
    // Delivered for review → client gets an in-app notification + email so
    // the one-click approval actually reaches them.
    if (isNewlyAwaitingClient) {
      const dashboardUrl = `${(process.env.FRONTEND_URL || process.env.CLIENT_URL || "").replace(/\/$/, "")}/dashboard/projects/${project.id}`
      onMilestoneAwaitingClient({ project, milestone })
        .catch((err) => logger.error("[milestone] awaiting-client notification failed:", err.message))
      sendTemplateEmail({
        locale: resolveUserLocale({ req }),
        to:          (await fetchUserEmail(project.userId)),
        templateKey: "project.approval-requested",
        userId:      project.userId,
        variables: { projectName: project.projectName, milestoneTitle: milestone.title, dashboardUrl },
      }).catch((err) => logger.error("[milestone] approval-requested email failed:", err.message))
    }
    // Fire customer email + in-app notification when admin marks a milestone
    // done — first transition only so a re-save with no change doesn't spam.
    if (isNewlyComplete) {
      const dashboardUrl = `${(process.env.FRONTEND_URL || process.env.CLIENT_URL || "").replace(/\/$/, "")}/dashboard/projects/${project.id}`
      sendTemplateEmail({
        locale: resolveUserLocale({ req }),
        to:          (await fetchUserEmail(project.userId)),
        templateKey: "project.milestone-completed",
        userId:      project.userId,
        variables: {
          projectName:    project.projectName,
          milestoneTitle: milestone.title,
          dashboardUrl,
        },
      }).catch((err) => logger.error("[milestone] customer email failed:", err.message))

      notifyProjectMilestoneCompleted(project.userId, { project, milestone })
        .catch((err) => logger.error("[milestone] in-app notification failed:", err.message))
    }
    res.status(200).json({ success: true, data: milestone })
  } catch (e) {
    if (e?.code === "P2025") return notFound(res)
    if (e?.message?.startsWith("Invalid milestone status")) return badRequest(res, e.message)
    throw e
  }
})

const removeMilestone = asyncHandler(async (req, res) => {
  try {
    const result = await deleteMilestone(req.params.milestoneId)
    res.status(200).json({ success: true, data: result })
  } catch (e) {
    if (e?.code === "P2025") return notFound(res)
    throw e
  }
})

/* ── Files (multer-uploaded; stored under <storage>/projects/) ───────── */
const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) return badRequest(res, "No file uploaded")
  const projectId = req.params.id

  // Stored as a storage-relative key; resolved by resolveSafePath on read.
  const relPath = `/files/projects/${projectId}/${req.file.filename}`
  try {
    const created = await attachFile(projectId, {
      fileName:      req.file.originalname,
      filePath:      relPath,
      fileType:      req.file.mimetype,
      fileSize:      req.file.size,
      uploadedById:  req.user?.id,
      milestoneId:   req.body?.milestoneId || null,
      isDeliverable: String(req.body?.isDeliverable || "") === "true",
    })
    res.status(201).json({ success: true, data: created })
  } catch (e) {
    // Best-effort cleanup if DB insert fails
    try { await fs.unlink(req.file.path) } catch {}
    throw e
  }
})

const removeFile = asyncHandler(async (req, res) => {
  try {
    const result = await deleteFile(req.params.fileId)
    await unlinkProjectFile(result.filePath)
    res.status(200).json({ success: true, data: { id: result.id, deleted: true } })
  } catch (e) {
    if (e?.code === "P2025") return notFound(res)
    throw e
  }
})

/**
 * GET /api/v1/admin/client-projects/:id/files/:fileId/download
 * Admin download — no ownership scope, but the same safe-path + stream tail
 * as the member endpoint. Replaces the direct /files/projects/* link that
 * app.js now 403s.
 */
const downloadFile = asyncHandler(async (req, res) => {
  const file = await prisma.projectFile.findFirst({
    where:   { id: String(req.params.fileId), projectId: String(req.params.id) },
    include: { project: { select: { id: true, projectName: true } } },
  })
  if (!file) return notFound(res)
  return sendProjectFile({ file, req, res, userId: req.user?.id, action: "project.file.downloaded.admin" })
})

/* ── Tier 2 · comments (admin side) ──────────────────────────────────── */
const addAdminComment = asyncHandler(async (req, res) => {
  try {
    const comment = await createComment({
      projectId: req.params.id, authorId: req.user?.id, authorRole: "admin",
      body: req.body?.body, milestoneId: req.body?.milestoneId || null, fileId: req.body?.fileId || null,
    })
    res.status(201).json({ success: true, data: comment })
  } catch (e) {
    if (e?.statusCode && e?.code) return res.status(e.statusCode).json({ success: false, error: { code: e.code, message: e.message } })
    throw e
  }
})

/**
 * POST /admin/client-projects/:id/tickets/:ticketId/messages
 * Admin reply with attachments (multipart `files[]`, stored under the
 * project's folder). The service verifies the ticket belongs to project :id.
 */
const replyProjectTicket = asyncHandler(async (req, res) => {
  const files = req.files || (req.file ? [req.file] : [])
  const message = String(req.body?.message || "").trim()
  if (!message) {
    await Promise.all(files.map((f) => fs.unlink(f.path).catch(() => null)))
    return badRequest(res, "Message is required")
  }
  try {
    const msg = await addAdminMessage({ ticketId: req.params.ticketId, projectId: req.params.id, adminId: req.user?.id, message, files })
    res.status(201).json({ success: true, data: msg })
  } catch (e) {
    await Promise.all(files.map((f) => fs.unlink(f.path).catch(() => null)))
    if (e?.statusCode && e?.code) return res.status(e.statusCode).json({ success: false, error: { code: e.code, message: e.message } })
    throw e
  }
})

const toggleResolveComment = asyncHandler(async (req, res) => {
  try {
    const comment = await resolveComment({ commentId: req.params.commentId, adminId: req.user?.id })
    res.status(200).json({ success: true, data: comment })
  } catch (e) {
    if (e?.statusCode && e?.code) return res.status(e.statusCode).json({ success: false, error: { code: e.code, message: e.message } })
    throw e
  }
})

/* ── Tier 4 · change requests (admin side) ───────────────────────────── */

/** POST /admin/client-projects/:id/change-requests/:crId/quote { amount, note, currency? } */
const quoteChangeRequest = asyncHandler(async (req, res) => {
  try {
    const data = await changeRequestService.quoteRequest({
      projectId: req.params.id, crId: req.params.crId,
      amount: req.body?.amount, note: req.body?.note, currency: req.body?.currency,
      adminId: req.user?.id, req,
    })
    res.status(200).json({ success: true, data })
  } catch (e) {
    if (e?.statusCode && e?.code) return res.status(e.statusCode).json({ success: false, error: { code: e.code, message: e.message } })
    throw e
  }
})

/** POST /admin/client-projects/:id/change-requests/:crId/done */
const completeChangeRequest = asyncHandler(async (req, res) => {
  try {
    const data = await changeRequestService.markDone({ projectId: req.params.id, crId: req.params.crId })
    res.status(200).json({ success: true, data })
  } catch (e) {
    if (e?.statusCode && e?.code) return res.status(e.statusCode).json({ success: false, error: { code: e.code, message: e.message } })
    throw e
  }
})

/** Best-effort disk cleanup; tolerates already-missing files and bad paths. */
async function unlinkProjectFile(filePath) {
  const abs = resolveSafePath(filePath)
  if (!abs) return
  try { await fs.unlink(abs) } catch {}
}

/* ── helper ──────────────────────────────────────────────────────────── */
async function fetchUserEmail(userId) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  return u?.email || null
}

/* ── Document requests (T5-3) ─────────────────────────────────────────────
 * Asking a client for a file, as a row rather than an email thread. The
 * client is notified in-app immediately; the email is T5-6 and lands once
 * its templates are seeded.
 */

/** GET /admin/client-projects/:id/file-requests */
const listFileRequests = asyncHandler(async (req, res) => {
  const rows = await fileRequests.listForProject(req.params.id)
  res.json({ success: true, data: rows.map((r) => fileRequests.serialize(r)) })
})

/** POST /admin/client-projects/:id/file-requests */
const addFileRequest = asyncHandler(async (req, res) => {
  const { request, project } = await fileRequests.createRequest(req.params.id, req.body, {
    requestedById: req.user?.id || null,
  })

  // Best-effort, both of them: the request exists whether or not the client
  // can be told right now, and a failed notification must not lose it.
  notifyFileRequested(project.userId, { project, request })
    .catch((e) => logger.warn(`[fileRequest] notify failed: ${e.message}`))
  projectEmails.sendFileRequested({ project, request, locale: resolveUserLocale({ req }) })
    .catch((e) => logger.warn(`[fileRequest] email failed: ${e.message}`))

  res.status(201).json({ success: true, data: fileRequests.serialize(request) })
})

/** PATCH /admin/client-projects/:id/file-requests/:reqId */
const reviewFileRequest = asyncHandler(async (req, res) => {
  const updated = await fileRequests.reviewRequest(req.params.reqId, {
    action: req.body?.action,
    reviewNote: req.body?.reviewNote,
  })

  const project = await prisma.clientProject.findUnique({
    where: { id: updated.projectId },
    // trackingCode and projectName because the email needs both; the
    // notification only needed the id.
    select: { id: true, userId: true, projectName: true, trackingCode: true },
  })
  if (project) {
    notifyFileReviewed(project.userId, { project, request: updated })
      .catch((e) => logger.warn(`[fileRequest] notify failed: ${e.message}`))
    // Cancelled sends nothing. "We no longer need that thing we asked you
    // for" is worth a notification badge and not worth an email.
    projectEmails.sendFileReviewed({ project, request: updated, locale: resolveUserLocale({ req }) })
      .catch((e) => logger.warn(`[fileRequest] email failed: ${e.message}`))
  }

  res.json({ success: true, data: fileRequests.serialize(updated) })
})

/**
 * GET /admin/client-projects/:id/events  (T5-5)
 *
 * The full timeline at admin visibility — the same rows the client sees plus
 * the ones written narrower than "client". Admin routers are all behind
 * protect + admin, so there is no per-row gate here beyond the audience.
 */
const listEvents = asyncHandler(async (req, res) => {
  const rows = await projectEvents.listForProject(req.params.id, { audience: "admin", limit: 200 })
  res.json({ success: true, data: rows.map((r) => projectEvents.serializeEvent(r)) })
})

module.exports = {
  listProjects, getProject, createProject, updateProject, removeProject,
  addMilestone, patchMilestone, removeMilestone,
  uploadFile, removeFile, downloadFile,
  addAdminComment, toggleResolveComment, replyProjectTicket,
  createPortalLink, createCaseStudy, sendReviewRequest,
  quoteChangeRequest, completeChangeRequest,
  listFileRequests, addFileRequest, reviewFileRequest, listEvents,
}
