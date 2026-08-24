/**
 * supportService · all Prisma access for support tickets + messages.
 *
 * Extracted from supportController (roadmap step 39) so the controller only
 * parses input and shapes the HTTP response. Ownership checks live here.
 */

const prisma   = require("../lib/prisma")
const { sendSupportTicketEmail, sendSupportReplyEmail } = require("../utils/mailer")
const { notifySupportTicketCreated, notifySupportReply } = require("../services/notificationService")

const ALLOWED_PRIORITIES = ["low", "medium", "high"]

const ORDER_SUMMARY_SELECT = { id: true, orderNumber: true, status: true, totalAmount: true, currency: true }
const USER_SUMMARY_SELECT  = { id: true, fullName: true, email: true }

/* ───────────────────────────── member ─────────────────────────────────── */

/** Best-effort listing — resolves to [] on any DB error (dashboard widget). */
async function listTicketsForUser(userId) {
  return prisma.supportTicket.findMany({
    where:   { userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { messages: true } } },
    take:    200,
  }).catch(() => [])
}

function generateTicketNumber() {
  return `TKT-${Date.now().toString(36).toUpperCase()}`
}

async function createTicket({ userId, subject, message, priority = "medium" }) {
  const sanitizedPriority = ALLOWED_PRIORITIES.includes(priority) ? priority : "medium"

  // Ticket + first thread message in one write (schema keeps `message` on the ticket too).
  const ticket = await prisma.supportTicket.create({
    data: {
      ticketNumber: generateTicketNumber(),
      userId,
      subject,
      message,
      priority: sanitizedPriority,
      status:   "open",
      messages: {
        create: { senderId: userId, message, senderRole: "member" },
      },
    },
    include: { _count: { select: { messages: true } } },
  })

  // Email + notification (non-blocking, best-effort)
  const user = await prisma.user
    .findUnique({ where: { id: userId }, select: { email: true, fullName: true } })
    .catch(() => null)
  sendSupportTicketEmail(ticket, user).catch(() => {})
  notifySupportTicketCreated(userId, ticket.ticketNumber).catch(() => {})

  return ticket
}

/** Ticket owned by `userId`, with its message thread. Returns null if not found / not owned. */
async function getTicketForUser(id, userId) {
  return prisma.supportTicket.findFirst({
    where:   { id, userId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  })
}

/** Ownership check without the thread payload. */
async function userOwnsTicket(id, userId) {
  const ticket = await prisma.supportTicket.findFirst({ where: { id, userId }, select: { id: true } })
  return Boolean(ticket)
}

/** Member reply. Caller is responsible for the ownership check (userOwnsTicket). */
async function createMemberMessage({ ticketId, userId, message }) {
  return prisma.supportMessage.create({
    data: { ticketId, senderId: userId, message, senderRole: "member" },
  })
}

/* ───────────────────────────── admin ──────────────────────────────────── */

async function listTicketsAdmin({ status, priority, category, page = 1, limit = 20 } = {}) {
  const where = {}
  if (status)   where.status   = status
  if (priority) where.priority = priority
  if (category) where.category = category

  const pageNum  = Number(page)
  const limitNum = Number(limit)

  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip:    (pageNum - 1) * limitNum,
      take:    limitNum,
      include: {
        user:   { select: USER_SUMMARY_SELECT },
        order:  { select: ORDER_SUMMARY_SELECT },
        _count: { select: { messages: true } },
      },
    }),
    prisma.supportTicket.count({ where }),
  ])

  return { tickets, meta: { total, page: pageNum, limit: limitNum } }
}

async function getTicketAdmin(id) {
  return prisma.supportTicket.findUnique({
    where: { id },
    include: {
      user:     { select: USER_SUMMARY_SELECT },
      order:    { select: { ...ORDER_SUMMARY_SELECT, paidAt: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  })
}

async function addAdminMessage({ ticketId, adminId, message }) {
  const msg = await prisma.supportMessage.create({
    data: { ticketId, senderId: adminId, message, senderRole: "admin" },
  })

  // open → in_progress on first admin reply
  await prisma.supportTicket.updateMany({
    where: { id: ticketId, status: "open" },
    data:  { status: "in_progress" },
  })

  // Email + notification to the ticket owner (non-blocking, best-effort)
  const ticket = await prisma.supportTicket
    .findUnique({ where: { id: ticketId }, select: { ticketNumber: true, subject: true, userId: true } })
    .catch(() => null)
  if (ticket) {
    const ticketUser = await prisma.user
      .findUnique({ where: { id: ticket.userId }, select: { email: true, fullName: true } })
      .catch(() => null)
    sendSupportReplyEmail(ticket, ticketUser, message).catch(() => {})
    notifySupportReply(ticket.userId, ticket.ticketNumber).catch(() => {})
  }

  return msg
}

async function updateTicketAdmin(id, { status, priority, assignedAdminId } = {}) {
  const data = {}
  if (status)          data.status          = status
  if (priority)        data.priority        = priority
  if (assignedAdminId !== undefined) data.assignedAdminId = assignedAdminId
  if (status === "resolved") data.resolvedAt = new Date()
  if (status === "closed")   data.closedAt   = new Date()

  return prisma.supportTicket.update({ where: { id }, data })
}

module.exports = {
  ALLOWED_PRIORITIES,
  listTicketsForUser,
  createTicket,
  getTicketForUser,
  userOwnsTicket,
  createMemberMessage,
  listTicketsAdmin,
  getTicketAdmin,
  addAdminMessage,
  updateTicketAdmin,
}
