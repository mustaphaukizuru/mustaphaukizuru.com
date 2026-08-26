const asyncHandler = require("../utils/asyncHandler")
const fs    = require("fs/promises")
const logger = require("../utils/logger")
const prisma = require("../lib/prisma")
const { sendProjectFile, resolveSafePath } = require("./clientProjectController")
const {
  listAdminProjects, getAdminProject, createAdminProject, updateAdminProject, deleteAdminProject,
  createMilestone, updateMilestone, deleteMilestone,
  attachFile, deleteFile,
  VALID_PROJECT_STATUSES, VALID_MILESTONE_STATUSES,
} = require("../services/clientProjectService")
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

const updateProject = asyncHandler(async (req, res) => {
  try {
    const updated = await updateAdminProject(req.params.id, req.body)
    res.status(200).json({ success: true, data: updated })
  } catch (e) {
    if (e?.code === "P2025") return notFound(res)
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
    const { milestone, project, isNewlyComplete } = await updateMilestone(req.params.milestoneId, req.body)
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
      fileName:     req.file.originalname,
      filePath:     relPath,
      fileType:     req.file.mimetype,
      uploadedById: req.user?.id,
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

module.exports = {
  listProjects, getProject, createProject, updateProject, removeProject,
  addMilestone, patchMilestone, removeMilestone,
  uploadFile, removeFile, downloadFile,
}
