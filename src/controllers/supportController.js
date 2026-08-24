const prisma       = require("../lib/prisma")
const asyncHandler = require("../utils/asyncHandler")
const { sendSupportTicketEmail, sendSupportReplyEmail } = require("../utils/mailer")
const { notifySupportTicketCreated, notifySupportReply } = require("../services/notificationService")

// Phase 9.2c · refactored to asyncHandler so unhandled errors flow into the
// central errorHandler middleware. The pre-Phase-9.2 code did
//   catch (err) { return res.status(500).json({ message: err.message }) }
// at seven different sites — every Prisma engine error, validation failure,
// or schema typo was being mirrored back to the client. errorHandler
// sanitises before returning.
//
// Behaviour preserved: getMyTickets still soft-fails to an empty array
// (best-effort dashboard listing); all other endpoints now propagate to
// the error middleware.

// ─────────────────────────────────────────────────────────────────────────────
// MEMBER SUPPORT CONTROLLER
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/member/support/tickets
const getMyTickets = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" })

  // Best-effort: a dashboard widget should never blow up the page if the
  // table read errors. The inner .catch() returns [] so we still 200 with
  // an empty array instead of letting the error reach the handler.
  const tickets = await prisma.supportTicket.findMany({
    where:   { userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { messages: true } } },
    take:    200,
  }).catch(() => [])

  return res.status(200).json({ success: true, data: tickets })
})

// POST /api/member/support/tickets
const createTicket = asyncHandler(async (req, res) => {
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

  // Email + notification (non-blocking)
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, fullName: true } }).catch(() => null)
  sendSupportTicketEmail(ticket, user).catch(() => {})
  notifySupportTicketCreated(userId, ticket.ticketNumber).catch(() => {})

  return res.status(201).json({ success: true, data: ticket })
})

// GET /api/member/support/tickets/:id
const getTicket = asyncHandler(async (req, res) => {
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
})

// POST /api/member/support/tickets/:id/messages
const replyToTicket = asyncHandler(async (req, res) => {
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
})

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN SUPPORT CONTROLLER
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/support/tickets
//
// M16 — supports filtering by category (e.g. ?category=refund_request) and
// includes the linked Order (when present) so the admin UI can render a
// "View order" + "Open refund modal" deep-link without an extra round-trip.
const adminGetAllTickets = asyncHandler(async (req, res) => {
  const { status, priority, category, page = 1, limit = 20 } = req.query
  const where = {}
  if (status)   where.status   = status
  if (priority) where.priority = priority
  if (category) where.category = category

  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip:  (Number(page) - 1) * Number(limit),
      take:  Number(limit),
      include: {
        user:   { select: { id: true, fullName: true, email: true } },
        order:  { select: { id: true, orderNumber: true, status: true, totalAmount: true, currency: true } },
        _count: { select: { messages: true } },
      },
    }),
    prisma.supportTicket.count({ where }),
  ])

  return res.status(200).json({ success: true, data: tickets, meta: { total, page: Number(page), limit: Number(limit) } })
})

// GET /api/admin/support/tickets/:id
//
// M16 — includes the linked Order (when present) so the admin can act on
// refund_request tickets without leaving the page.
const adminGetTicket = asyncHandler(async (req, res) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: req.params.id },
    include: {
      user:     { select: { id: true, fullName: true, email: true } },
      order:    { select: { id: true, orderNumber: true, status: true, totalAmount: true, currency: true, paidAt: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  })
  if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" })
  return res.status(200).json({ success: true, data: ticket })
})

// POST /api/admin/support/tickets/:id/messages  (admin reply)
const adminReplyToTicket = asyncHandler(async (req, res) => {
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

  // Email + notification to ticket owner (non-blocking)
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: req.params.id },
    select: { ticketNumber: true, subject: true, userId: true },
  }).catch(() => null)
  if (ticket) {
    const ticketUser = await prisma.user.findUnique({
      where: { id: ticket.userId },
      select: { email: true, fullName: true },
    }).catch(() => null)
    sendSupportReplyEmail(ticket, ticketUser, message).catch(() => {})
    notifySupportReply(ticket.userId, ticket.ticketNumber).catch(() => {})
  }

  return res.status(201).json({ success: true, data: msg })
})

// PATCH /api/admin/support/tickets/:id
const adminUpdateTicket = asyncHandler(async (req, res) => {
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
})

module.exports = {
  getMyTickets, createTicket, getTicket, replyToTicket,
  adminGetAllTickets, adminGetTicket, adminReplyToTicket, adminUpdateTicket,
}
