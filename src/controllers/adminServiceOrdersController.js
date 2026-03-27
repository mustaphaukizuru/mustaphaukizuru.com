const prisma = require("../lib/prisma")

const listServiceOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query
    const where = {}
    if (status) where.status = status

    const [orders, total] = await Promise.all([
      prisma.serviceOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (Number(page)-1)*Number(limit),
        take: Number(limit),
        include: {
          user:           { select: { id:true, fullName:true, email:true } },
          service:        { select: { id:true, title:true } },
          servicePackage: { select: { id:true, name:true, price:true } },
          order:          { select: { id:true, orderNumber:true, totalAmount:true, status:true } },
          consultations:  { orderBy: { scheduledAt: "asc" }, take: 1 },
          clientProject:  { select: { id:true, projectName:true, projectStatus:true } },
        },
      }).catch(() => []),
      prisma.serviceOrder.count({ where }).catch(() => 0),
    ])

    return res.status(200).json({ success: true, data: orders, meta: { total } })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

const getServiceOrder = async (req, res) => {
  try {
    const so = await prisma.serviceOrder.findUnique({
      where: { id: req.params.id },
      include: {
        user:           { select: { id:true, fullName:true, email:true, phone:true } },
        service:        true,
        servicePackage: true,
        order:          { select: { id:true, orderNumber:true, totalAmount:true, status:true, createdAt:true } },
        consultations:  { orderBy: { scheduledAt: "asc" } },
        clientProject:  { include: { milestones: { orderBy: { sortOrder:"asc" } }, files: true } },
      },
    })
    if (!so) return res.status(404).json({ success: false, message: "Service order not found" })
    return res.status(200).json({ success: true, data: so })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

const updateServiceOrder = async (req, res) => {
  try {
    const { status, notes, startDate, endDate } = req.body
    const data = {}
    if (status)    data.status    = status
    if (notes)     data.notes     = notes
    if (startDate) data.startDate = new Date(startDate)
    if (endDate)   data.endDate   = new Date(endDate)

    const so = await prisma.serviceOrder.update({ where: { id: req.params.id }, data })
    return res.status(200).json({ success: true, data: so })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

const scheduleConsultation = async (req, res) => {
  try {
    const { scheduledAt, meetingLink, assignedAdminId } = req.body
    const so = await prisma.serviceOrder.findUnique({ where: { id: req.params.id }, select: { userId:true } })
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
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

const createProject = async (req, res) => {
  try {
    const { projectName, description, startDate, dueDate } = req.body
    const so = await prisma.serviceOrder.findUnique({ where: { id: req.params.id }, select: { userId:true } })
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
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

const addMilestone = async (req, res) => {
  try {
    const { title, description, dueDate, sortOrder } = req.body
    if (!title) return res.status(400).json({ success: false, message: "title required" })
    const m = await prisma.projectMilestone.create({
      data: { projectId: req.params.projectId, title, description, dueDate: dueDate ? new Date(dueDate) : null, sortOrder: sortOrder || 0 },
    })
    return res.status(201).json({ success: true, data: m })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

const updateMilestone = async (req, res) => {
  try {
    const { status, title, dueDate } = req.body
    const data = {}
    if (status) { data.status = status; if (status === "completed") data.completedAt = new Date() }
    if (title)  data.title   = title
    if (dueDate) data.dueDate = new Date(dueDate)
    const m = await prisma.projectMilestone.update({ where: { id: req.params.milestoneId }, data })
    return res.status(200).json({ success: true, data: m })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

module.exports = { listServiceOrders, getServiceOrder, updateServiceOrder, scheduleConsultation, createProject, addMilestone, updateMilestone }
