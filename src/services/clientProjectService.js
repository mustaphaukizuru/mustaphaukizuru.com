const prisma = require("../lib/prisma")

/* ──────────────────────────────────────────────────────────────────────────
 *  clientProjectService
 *
 *  Source-of-truth for ClientProject + ProjectMilestone + ProjectFile data.
 *  Used by:
 *    - admin controller (full CRUD on every project)
 *    - member controller (read-only on the user's own projects)
 *
 *  Design:
 *    - All admin reads use { include: { milestones: { orderBy: sortOrder },
 *      files: { orderBy: createdAt desc }, user, assignedAdmin, serviceOrder } }
 *    - Member reads are scoped by userId — never trust the client to filter
 *    - Milestone status changes return { project, milestone, isNewlyComplete }
 *      so the controller can fire an email only on the first completion
 *  ──────────────────────────────────────────────────────────────────── */

const VALID_PROJECT_STATUSES   = ["planning", "in_progress", "review", "completed", "cancelled"]
const VALID_MILESTONE_STATUSES = ["pending", "in_progress", "completed"]

const PROJECT_INCLUDE = {
  milestones: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
  files:      { orderBy: { createdAt: "desc" } },
  user:       { select: { id: true, fullName: true, email: true } },
  assignedAdmin: { select: { id: true, fullName: true, email: true } },
  serviceOrder: {
    select: {
      id: true,
      status: true,
      order: { select: { id: true, orderNumber: true } },
    },
  },
}

/* ── Admin · list every project ──────────────────────────────────────── */
async function listAdminProjects() {
  const rows = await prisma.clientProject.findMany({
    orderBy: [{ updatedAt: "desc" }],
    include: PROJECT_INCLUDE,
    take:    200,
  })
  return rows
}

/* ── Admin · single project ──────────────────────────────────────────── */
async function getAdminProject(id) {
  if (!id) throw new Error("Project id is required")
  return prisma.clientProject.findUnique({
    where: { id: String(id) },
    include: PROJECT_INCLUDE,
  })
}

/* ── Admin · create project linked to a ServiceOrder + User ──────────── */
async function createAdminProject(data) {
  if (!data.serviceOrderId) throw new Error("serviceOrderId is required")
  if (!data.userId)         throw new Error("userId is required")
  if (!data.projectName)    throw new Error("projectName is required")

  const status = VALID_PROJECT_STATUSES.includes(data.projectStatus)
    ? data.projectStatus : "planning"

  return prisma.clientProject.create({
    data: {
      serviceOrderId:  String(data.serviceOrderId),
      userId:          String(data.userId),
      assignedAdminId: data.assignedAdminId ? String(data.assignedAdminId) : null,
      projectName:     String(data.projectName).trim(),
      projectStatus:   status,
      startDate:       data.startDate ? new Date(data.startDate) : null,
      dueDate:         data.dueDate   ? new Date(data.dueDate)   : null,
      description:     data.description?.trim() || null,
    },
    include: PROJECT_INCLUDE,
  })
}

/* ── Admin · update project metadata ─────────────────────────────────── */
async function updateAdminProject(id, data) {
  if (!id) throw new Error("Project id is required")

  const patch = {}
  if ("projectName"     in data) patch.projectName     = String(data.projectName).trim()
  if ("description"     in data) patch.description     = data.description?.trim() || null
  if ("startDate"       in data) patch.startDate       = data.startDate ? new Date(data.startDate) : null
  if ("dueDate"         in data) patch.dueDate         = data.dueDate   ? new Date(data.dueDate)   : null
  if ("assignedAdminId" in data) patch.assignedAdminId = data.assignedAdminId ? String(data.assignedAdminId) : null
  if ("projectStatus"   in data) {
    if (!VALID_PROJECT_STATUSES.includes(data.projectStatus)) {
      throw new Error(`Invalid project status. Expected one of: ${VALID_PROJECT_STATUSES.join(", ")}`)
    }
    patch.projectStatus = data.projectStatus
  }

  return prisma.clientProject.update({
    where: { id: String(id) },
    data:  patch,
    include: PROJECT_INCLUDE,
  })
}

async function deleteAdminProject(id) {
  if (!id) throw new Error("Project id is required")
  // Collect file keys BEFORE the cascade deletes the rows, so the controller
  // can unlink the bytes on disk afterwards.
  const files = await prisma.projectFile.findMany({
    where: { projectId: String(id) }, select: { filePath: true },
  })
  await prisma.clientProject.delete({ where: { id: String(id) } })
  return { id: String(id), deleted: true, filePaths: files.map((f) => f.filePath) }
}

/* ── Admin · milestone CRUD ──────────────────────────────────────────── */

async function createMilestone(projectId, data) {
  if (!projectId)   throw new Error("Project id is required")
  if (!data.title)  throw new Error("Milestone title is required")

  // Auto-assign sortOrder = max + 1 so new milestones land at the bottom
  const last = await prisma.projectMilestone.findFirst({
    where: { projectId: String(projectId) },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  })
  const sortOrder = data.sortOrder != null ? Number(data.sortOrder) : ((last?.sortOrder ?? -1) + 1)

  const status = VALID_MILESTONE_STATUSES.includes(data.status) ? data.status : "pending"

  return prisma.projectMilestone.create({
    data: {
      projectId:   String(projectId),
      title:       String(data.title).trim(),
      description: data.description?.trim() || null,
      status,
      dueDate:     data.dueDate ? new Date(data.dueDate) : null,
      completedAt: status === "completed" ? new Date() : null,
      sortOrder,
    },
  })
}

async function updateMilestone(milestoneId, data) {
  if (!milestoneId) throw new Error("Milestone id is required")

  const existing = await prisma.projectMilestone.findUnique({
    where: { id: String(milestoneId) },
    include: { project: true },
  })
  if (!existing) {
    const err = new Error("Milestone not found")
    err.code = "P2025"
    throw err
  }

  const patch = {}
  if ("title"       in data) patch.title       = String(data.title).trim()
  if ("description" in data) patch.description = data.description?.trim() || null
  if ("dueDate"     in data) patch.dueDate     = data.dueDate ? new Date(data.dueDate) : null
  if ("sortOrder"   in data) patch.sortOrder   = Number(data.sortOrder)

  let isNewlyComplete = false
  if ("status" in data) {
    if (!VALID_MILESTONE_STATUSES.includes(data.status)) {
      throw new Error(`Invalid milestone status. Expected one of: ${VALID_MILESTONE_STATUSES.join(", ")}`)
    }
    patch.status = data.status
    if (data.status === "completed" && existing.status !== "completed") {
      patch.completedAt = new Date()
      isNewlyComplete = true
    } else if (data.status !== "completed") {
      patch.completedAt = null
    }
  }

  const updated = await prisma.projectMilestone.update({
    where: { id: String(milestoneId) },
    data:  patch,
  })

  return { milestone: updated, project: existing.project, isNewlyComplete }
}

async function deleteMilestone(milestoneId) {
  if (!milestoneId) throw new Error("Milestone id is required")
  await prisma.projectMilestone.delete({ where: { id: String(milestoneId) } })
  return { id: String(milestoneId), deleted: true }
}

/* ── Admin · file management ─────────────────────────────────────────── */

async function attachFile(projectId, { fileName, filePath, fileType, uploadedById }) {
  if (!projectId) throw new Error("Project id is required")
  if (!fileName || !filePath) throw new Error("fileName and filePath are required")
  return prisma.projectFile.create({
    data: {
      projectId:    String(projectId),
      uploadedById: uploadedById ? String(uploadedById) : null,
      fileName:     String(fileName).trim(),
      filePath:     String(filePath),
      fileType:     fileType || null,
    },
  })
}

async function deleteFile(fileId) {
  if (!fileId) throw new Error("File id is required")
  const file = await prisma.projectFile.findUnique({ where: { id: String(fileId) } })
  if (!file) {
    const err = new Error("File not found")
    err.code = "P2025"
    throw err
  }
  await prisma.projectFile.delete({ where: { id: String(fileId) } })
  return { id: file.id, filePath: file.filePath, deleted: true }
}

/* ── Member · scoped reads for the buyer's own projects ──────────────── */

async function listMyProjects(userId) {
  if (!userId) throw new Error("userId is required")
  return prisma.clientProject.findMany({
    where: { userId: String(userId) },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      milestones: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: { id: true, status: true, completedAt: true },
      },
      _count: { select: { files: true } },
    },
    take: 200,
  })
}

async function getMyProject({ userId, projectId }) {
  if (!userId)    throw new Error("userId is required")
  if (!projectId) throw new Error("Project id is required")
  return prisma.clientProject.findFirst({
    where: { id: String(projectId), userId: String(userId) },
    include: PROJECT_INCLUDE,
  })
}

module.exports = {
  // admin
  listAdminProjects,
  getAdminProject,
  createAdminProject,
  updateAdminProject,
  deleteAdminProject,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  attachFile,
  deleteFile,
  // member
  listMyProjects,
  getMyProject,
  // constants
  VALID_PROJECT_STATUSES,
  VALID_MILESTONE_STATUSES,
}
