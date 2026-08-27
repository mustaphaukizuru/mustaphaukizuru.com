const prisma       = require("../lib/prisma")
const asyncHandler = require("../utils/asyncHandler")
const { adminUpdateServiceOrder: adminUpdateServiceOrderSvc } = require("../services/serviceOrderService")

// Phase 9.2c · refactored to asyncHandler so unhandled errors flow into the
// central errorHandler middleware. The pre-Phase-9.2 code did
//   catch (err) { return res.status(500).json({ message: err.message }) }
// at seven different sites — every Prisma engine error, validation failure,
// or schema typo was being mirrored back to the client. errorHandler
// sanitises before returning.

const listServiceOrders = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query
  const where = {}
  if (status) where.status = status

  const [orders, total] = await Promise.all([
    prisma.serviceOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      include: {
        user:           { select: { id: true, fullName: true, email: true } },
        service:        { select: { id: true, title: true } },
        servicePackage: { select: { id: true, name: true, price: true, currency: true } },
        order:          { select: { id: true, orderNumber: true, totalAmount: true, currency: true, status: true, paidAt: true } },
        consultations:  { orderBy: { scheduledAt: "asc" }, take: 1 },
        clientProject:  { select: { id: true, projectName: true, projectStatus: true } },
      },
    }).catch(() => []),
    prisma.serviceOrder.count({ where }).catch(() => 0),
  ])

  return res.status(200).json({ success: true, data: orders.map(withDerived), meta: { total } })
})

/**
 * ServiceOrder has no money/paidAt columns of its own — they live on the
 * linked Order (or the package price before an order exists) — and the
 * project is the `clientProject` relation. Flatten what the admin pages read.
 */
function withDerived(so) {
  if (!so) return so
  const pkgPrice = so.servicePackage?.price
  return {
    ...so,
    totalAmount: so.order?.totalAmount ?? (pkgPrice != null ? pkgPrice : null),
    currency:    so.order?.currency ?? so.servicePackage?.currency ?? "MXN",
    paidAt:      so.order?.paidAt ?? null,
    projectId:   so.clientProject?.id ?? null,
  }
}

const getServiceOrder = asyncHandler(async (req, res) => {
  const so = await prisma.serviceOrder.findUnique({
    where: { id: req.params.id },
    include: {
      user:           { select: { id: true, fullName: true, email: true, phone: true } },
      service:        true,
      servicePackage: true,
      order:          { select: { id: true, orderNumber: true, totalAmount: true, currency: true, status: true, createdAt: true, paidAt: true } },
      consultations:  { orderBy: { scheduledAt: "asc" } },
      clientProject:  { include: { milestones: { orderBy: { sortOrder: "asc" } }, files: true } },
    },
  })
  if (!so) return res.status(404).json({ success: false, message: "Service order not found" })
  return res.status(200).json({ success: true, data: withDerived(so) })
})

const updateServiceOrder = asyncHandler(async (req, res) => {
  // Delegate to serviceOrderService so the AdminAuditLog row + the row
  // update land atomically. The service applies its own allowlist; the
  // ctx carries req.user.id + req.ip for the audit snapshot.
  const so = await adminUpdateServiceOrderSvc(req.params.id, req.body || {}, {
    adminUserId: req.user?.id || null,
    ipAddress:   req.ip || null,
  })
  return res.status(200).json({ success: true, data: so })
})

const scheduleConsultation = asyncHandler(async (req, res) => {
  const { scheduledAt, meetingLink, assignedAdminId } = req.body
  const so = await prisma.serviceOrder.findUnique({
    where:  { id: req.params.id },
    select: { userId: true },
  })
  if (!so) return res.status(404).json({ success: false, message: "Service order not found" })

  const c = await prisma.consultation.create({
    data: {
      serviceOrderId:  req.params.id,
      userId:          so.userId,
      assignedAdminId: assignedAdminId || req.user?.id,
      scheduledAt:     new Date(scheduledAt),
      meetingLink:     meetingLink || null,
      status:          "scheduled",
    },
  })
  return res.status(201).json({ success: true, data: c })
})

const createProject = asyncHandler(async (req, res) => {
  const { projectName, description, startDate, dueDate } = req.body
  const so = await prisma.serviceOrder.findUnique({
    where:  { id: req.params.id },
    select: { userId: true },
  })
  if (!so) return res.status(404).json({ success: false, message: "Service order not found" })

  const proj = await prisma.clientProject.create({
    data: {
      serviceOrderId:  req.params.id,
      userId:          so.userId,
      assignedAdminId: req.user?.id,
      projectName:     projectName || "New Project",
      description:     description || null,
      startDate:       startDate ? new Date(startDate) : null,
      dueDate:         dueDate   ? new Date(dueDate)   : null,
      projectStatus:   "planning",
    },
  })
  return res.status(201).json({ success: true, data: proj })
})

const addMilestone = asyncHandler(async (req, res) => {
  const { title, description, dueDate, sortOrder } = req.body
  if (!title) return res.status(400).json({ success: false, message: "title required" })
  const m = await prisma.projectMilestone.create({
    data: {
      projectId:   req.params.projectId,
      title,
      description,
      dueDate:     dueDate ? new Date(dueDate) : null,
      sortOrder:   sortOrder || 0,
    },
  })
  return res.status(201).json({ success: true, data: m })
})

const updateMilestone = asyncHandler(async (req, res) => {
  const { status, title, dueDate } = req.body
  const data = {}
  if (status) { data.status = status; if (status === "completed") data.completedAt = new Date() }
  if (title)   data.title   = title
  if (dueDate) data.dueDate = new Date(dueDate)
  const m = await prisma.projectMilestone.update({
    where: { id: req.params.milestoneId },
    data,
  })
  return res.status(200).json({ success: true, data: m })
})

module.exports = {
  listServiceOrders, getServiceOrder, updateServiceOrder,
  scheduleConsultation, createProject, addMilestone, updateMilestone,
}
