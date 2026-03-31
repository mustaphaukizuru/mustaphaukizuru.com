const prisma = require("../lib/prisma")

// ─────────────────────────────────────────────────────────────────────────────
// MEMBER SUPPORT CONTROLLER
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/member/support/tickets
const getMyTickets = async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" })

    const tickets = await prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { messages: true } } },
    }).catch(() => [])

    return res.status(200).json({ success: true, data: tickets })
  } catch (err) {
    return res.status(200).json({ success: true, data: [] })
  }
}

// POST /api/member/support/tickets
const createTicket = async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" })

    const { subject, message, priority = "medium" } = req.body
    if (!subject || !message) {
      return res.status(400).json({ success: false, message: "Subject and message are required" })
    }
    const subjectTrimmed = String(subject).trim()
    const messageTrimmed = String(message).trim()
    if (subjectTrimmed.length < 3 || subjectTrimmed.length > 200) {
      return res.status(400).json({ success: false, message: "Subject must be 3–200 characters" })
    }
    if (messageTrimmed.length < 10 || messageTrimmed.length > 5000) {
      return res.status(400).json({ success: false, message: "Message must be 10–5000 characters" })
    }
    const allowedPriorities = ["low", "medium", "high"]
    const sanitizedPriority = allowedPriorities.includes(priority) ? priority : "medium"

    const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}`

    // Create ticket with initial message field on ticket itself (schema has message field)
    const ticket = await prisma.supportTicket.create({
      data: {
        ticketNumber,
        userId,
        subject,
        message,           // ← required field on SupportTicket
        priority: sanitizedPriority,
        status: "open",
        // Also create first message in the thread
        messages: {
          create: {
            senderId:   userId,
            message,           // ← SupportMessage.message (not body)
            senderRole: "member",
          },
        },
      },
      include: { _count: { select: { messages: true } } },
    })

    return res.status(201).json({ success: true, data: ticket })
  } catch (err) {
    console.error("[createTicket]", err.message)
    return res.status(500).json({ success: false, message: err.message || "Failed to create ticket" })
  }
}

// GET /api/member/support/tickets/:id
const getTicket = async (req, res) => {
  try {
    const userId = req.user?.id
    const { id } = req.params
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" })

    const ticket = await prisma.supportTicket.findFirst({
      where: { id, userId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    })

    if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" })
    return res.status(200).json({ success: true, data: ticket })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

// POST /api/member/support/tickets/:id/messages
const replyToTicket = async (req, res) => {
  try {
    const userId  = req.user?.id
    const { id }  = req.params
    const { message } = req.body
    if (!userId)  return res.status(401).json({ success: false, message: "Unauthorized" })
    if (!message) return res.status(400).json({ success: false, message: "Message is required" })

    const ticket = await prisma.supportTicket.findFirst({ where: { id, userId } })
    if (!ticket)  return res.status(404).json({ success: false, message: "Ticket not found" })

    const msg = await prisma.supportMessage.create({
      data: {
        ticketId:   id,
        senderId:   userId,    // ← senderId not userId
        message,               // ← message not body
        senderRole: "member",
      },
    })

    return res.status(201).json({ success: true, data: msg })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN SUPPORT CONTROLLER
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/support/tickets
const adminGetAllTickets = async (req, res) => {
  try {
    const { status, priority, page = 1, limit = 20 } = req.query
    const where = {}
    if (status)   where.status   = status
    if (priority) where.priority = priority

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:  (Number(page) - 1) * Number(limit),
        take:  Number(limit),
        include: {
          user: { select: { id: true, fullName: true, email: true } },
          _count: { select: { messages: true } },
        },
      }),
      prisma.supportTicket.count({ where }),
    ])

    return res.status(200).json({ success: true, data: tickets, meta: { total, page: Number(page), limit: Number(limit) } })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

// GET /api/admin/support/tickets/:id
const adminGetTicket = async (req, res) => {
  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: req.params.id },
      include: {
        user:     { select: { id: true, fullName: true, email: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    })
    if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" })
    return res.status(200).json({ success: true, data: ticket })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

// POST /api/admin/support/tickets/:id/messages  (admin reply)
const adminReplyToTicket = async (req, res) => {
  try {
    const adminId = req.user?.id
    const { message } = req.body
    if (!message) return res.status(400).json({ success: false, message: "Message is required" })

    const msg = await prisma.supportMessage.create({
      data: {
        ticketId:   req.params.id,
        senderId:   adminId,
        message,
        senderRole: "admin",
      },
    })

    // Update ticket status to in_progress if still open
    await prisma.supportTicket.updateMany({
      where: { id: req.params.id, status: "open" },
      data:  { status: "in_progress" },
    })

    return res.status(201).json({ success: true, data: msg })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

// PATCH /api/admin/support/tickets/:id
const adminUpdateTicket = async (req, res) => {
  try {
    const { status, priority, assignedAdminId } = req.body
    const data = {}
    if (status)          data.status          = status
    if (priority)        data.priority        = priority
    if (assignedAdminId !== undefined) data.assignedAdminId = assignedAdminId
    if (status === "resolved") data.resolvedAt = new Date()
    if (status === "closed")   data.closedAt   = new Date()

    const ticket = await prisma.supportTicket.update({
      where: { id: req.params.id },
      data,
    })
    return res.status(200).json({ success: true, data: ticket })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

module.exports = {
  getMyTickets, createTicket, getTicket, replyToTicket,
  adminGetAllTickets, adminGetTicket, adminReplyToTicket, adminUpdateTicket,
}
