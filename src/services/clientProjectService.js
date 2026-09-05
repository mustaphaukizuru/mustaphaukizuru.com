const prisma = require("../lib/prisma")
const { withUniqueTrackingCode } = require("../utils/trackingCode")
const { validatePreviewUrl, assertAccessStateChange } = require("./projectPortalService")

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
const VALID_MILESTONE_STATUSES = ["pending", "in_progress", "awaiting_client", "approved", "completed"]
const CLOSED_PROJECT_STATUSES  = new Set(["completed", "cancelled"])

const PROJECT_INCLUDE = {
  milestones: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
  files:      {
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { id: true, fullName: true, role: true } } },
  },
  comments:   {
    orderBy: { createdAt: "asc" },
    take:    500,
    include: { author: { select: { id: true, fullName: true, role: true } } },
  },
  tickets:    {
    orderBy: { createdAt: "desc" },
    take:    50,
    select:  { id: true, ticketNumber: true, subject: true, status: true, priority: true, updatedAt: true, createdAt: true },
  },
  // Tier 4 · extra-work requests (quotes are Decimal — serialised by the
  // JSON layer; the change-request endpoints return numbers).
  changeRequests: { orderBy: { createdAt: "desc" }, take: 100 },
  user:       { select: { id: true, fullName: true, email: true } },
  assignedAdmin: { select: { id: true, fullName: true, email: true } },
  serviceOrder: {
    select: {
      id: true,
      status: true,
      order:   { select: { id: true, orderNumber: true } },
      // Tier 4 · the member review form posts to /services/:slug/reviews
      service: { select: { id: true, slug: true, title: true } },
    },
  },
  // Tier 4 · reviews collected for this project (client-side "already reviewed")
  reviews: {
    orderBy: { createdAt: "desc" },
    take:    5,
    select:  { id: true, userId: true, rating: true, status: true, createdAt: true },
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

  // T5-1 · every project gets its tracking code at birth. withUniqueTrackingCode
  // redraws on the P2002 that a collision would raise, so the one time ~2^39
  // works against us it is a retry rather than a failed project creation.
  return withUniqueTrackingCode((trackingCode) => prisma.clientProject.create({
    data: {
      serviceOrderId:  String(data.serviceOrderId),
      userId:          String(data.userId),
      assignedAdminId: data.assignedAdminId ? String(data.assignedAdminId) : null,
      projectName:     String(data.projectName).trim(),
      projectStatus:   status,
      startDate:       data.startDate ? new Date(data.startDate) : null,
      dueDate:         data.dueDate   ? new Date(data.dueDate)   : null,
      description:     data.description?.trim() || null,
      trackingCode,
    },
    include: PROJECT_INCLUDE,
  }))
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
  if ("previewUrl"      in data) patch.previewUrl      = validatePreviewUrl(data.previewUrl)
  // Tier 4 · NDA click-wrap toggles. Version is free text (<=16) so "2026-08"
  // or "v2" both work; bumping it re-gates the client.
  if ("requiresNda"     in data) patch.requiresNda     = data.requiresNda === true || data.requiresNda === "true"
  if ("ndaVersion"      in data) {
    const v = data.ndaVersion == null ? "" : String(data.ndaVersion).trim()
    if (v.length > 16) throw new Error("ndaVersion must be 16 characters or fewer")
    patch.ndaVersion = v || null
  }
  // Tier 4 · kill switch / handover gate. Throws 409 UNPAID_INVOICES when
  // moving to handover with an outstanding balance.
  if ("accessState"     in data) patch.accessState     = await assertAccessStateChange(String(id), String(data.accessState || ""))
  if ("projectStatus"   in data) {
    if (!VALID_PROJECT_STATUSES.includes(data.projectStatus)) {
      throw new Error(`Invalid project status. Expected one of: ${VALID_PROJECT_STATUSES.join(", ")}`)
    }
    patch.projectStatus = data.projectStatus
    // Lifecycle: stamp closedAt on the first move into a closed state, clear
    // it if the project is reopened. Member writes key off this column.
    if (CLOSED_PROJECT_STATUSES.has(data.projectStatus)) {
      const existing = await prisma.clientProject.findUnique({ where: { id: String(id) }, select: { closedAt: true } })
      if (!existing?.closedAt) patch.closedAt = new Date()
    } else {
      patch.closedAt = null
    }
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
  let isNewlyAwaitingClient = false
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
    // Delivered for review → the client gets a notification + email once.
    if (data.status === "awaiting_client" && existing.status !== "awaiting_client") {
      isNewlyAwaitingClient = true
      patch.changesRequestedAt = null
    }
    // Admin reset to an earlier stage clears a stale approval.
    if (["pending", "in_progress", "awaiting_client"].includes(data.status)) {
      patch.approvedAt = null
      patch.approvedById = null
    }
  }

  const updated = await prisma.projectMilestone.update({
    where: { id: String(milestoneId) },
    data:  patch,
  })

  return { milestone: updated, project: existing.project, isNewlyComplete, isNewlyAwaitingClient }
}

async function deleteMilestone(milestoneId) {
  if (!milestoneId) throw new Error("Milestone id is required")
  await prisma.projectMilestone.delete({ where: { id: String(milestoneId) } })
  return { id: String(milestoneId), deleted: true }
}

/* ── Admin · file management ─────────────────────────────────────────── */

async function attachFile(projectId, { fileName, filePath, fileType, fileSize, uploadedById, milestoneId, isDeliverable }) {
  if (!projectId) throw new Error("Project id is required")
  if (!fileName || !filePath) throw new Error("fileName and filePath are required")
  return prisma.projectFile.create({
    data: {
      projectId:      String(projectId),
      uploadedById:   uploadedById ? String(uploadedById) : null,
      uploadedByRole: "admin",
      milestoneId:    milestoneId ? String(milestoneId) : null,
      fileName:       String(fileName).trim(),
      filePath:       String(filePath),
      fileType:       fileType || null,
      fileSize:       Number.isFinite(Number(fileSize)) ? Number(fileSize) : null,
      isDeliverable:  Boolean(isDeliverable),
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
        select: { id: true, title: true, status: true, completedAt: true },
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
