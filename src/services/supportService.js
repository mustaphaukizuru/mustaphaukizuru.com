/**
 * supportService · all Prisma access for support tickets + messages.
 *
 * Extracted from supportController (roadmap step 39) so the controller only
 * parses input and shapes the HTTP response. Ownership checks live here.
 */

const prisma   = require("../lib/prisma")
const { sendSupportTicketEmail, sendSupportReplyEmail } = require("../utils/mailer")
const { notifySupportTicketCreated, notifySupportReply, notifyAdminsProjectActivity } = require("../services/notificationService")
const { loadOwnedProject, assertWritable } = require("./projectPortalService")
const logger = require("../utils/logger")

const ALLOWED_PRIORITIES = ["low", "medium", "high"]

const ORDER_SUMMARY_SELECT = { id: true, orderNumber: true, status: true, totalAmount: true, currency: true }
const USER_SUMMARY_SELECT  = { id: true, fullName: true, email: true }
const PROJECT_SUMMARY_SELECT = { id: true, projectName: true, projectStatus: true }
/** Attachment rows live in ProjectFile (anchored by supportMessageId) and are
 *  downloaded through GET /member/projects/:projectId/files/:id/download. */
const ATTACHMENT_SELECT = { id: true, projectId: true, fileName: true, fileType: true, fileSize: true, uploadedByRole: true, createdAt: true }
const MESSAGES_INCLUDE  = { orderBy: { createdAt: "asc" }, include: { attachments: { select: ATTACHMENT_SELECT } } }

function err(message, code, statusCode = 400) {
  const e = new Error(message)
  e.code = code
  e.statusCode = statusCode
  return e
}

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
    include: { messages: MESSAGES_INCLUDE, project: { select: PROJECT_SUMMARY_SELECT } },
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

/* ───────────────────────── project-scoped tickets (Tier 2) ────────────── */

// Closest TicketCategory for "I need help with my project"; `general` is the
// catch-all and `technical` lets the admin inbox filter project help apart.
const PROJECT_TICKET_CATEGORY = "technical"

function validateTicketText({ subject, message }) {
  const subjectTrimmed = String(subject || "").trim()
  const messageTrimmed = String(message || "").trim()
  if (subjectTrimmed.length < 3 || subjectTrimmed.length > 200) throw err("Subject must be 3–200 characters", "VALIDATION_ERROR", 400)
  if (messageTrimmed.length < 10 || messageTrimmed.length > 5000) throw err("Message must be 10–5000 characters", "VALIDATION_ERROR", 400)
  return { subject: subjectTrimmed, message: messageTrimmed }
}

/** Multer rows → ProjectFile rows anchored to a support message. */
async function attachTicketFiles({ projectId, uploadedById, role, messageId, files = [] }) {
  if (!files.length) return []
  return prisma.$transaction(files.map((f) => prisma.projectFile.create({
    data: {
      projectId:        String(projectId),
      uploadedById:     String(uploadedById),
      uploadedByRole:   role,
      supportMessageId: String(messageId),
      fileName:         String(f.originalname || f.fileName || "file").trim().slice(0, 255),
      filePath:         `/files/projects/${projectId}/${f.filename}`,
      fileType:         f.mimetype || null,
      fileSize:         Number.isFinite(f.size) ? f.size : null,
    },
    select: ATTACHMENT_SELECT,
  })))
}

/** Newest first, bounded; scoped to the owner AND the project. */
async function listProjectTicketsForUser({ userId, projectId }) {
  const project = await loadOwnedProject({ userId, projectId })
  return prisma.supportTicket.findMany({
    where:   { userId: String(userId), projectId: project.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { messages: true } } },
    take:    100,
  })
}

async function getProjectTicketForUser({ userId, projectId, ticketId }) {
  const project = await loadOwnedProject({ userId, projectId })
  const ticket = await prisma.supportTicket.findFirst({
    where:   { id: String(ticketId), userId: String(userId), projectId: project.id },
    include: { messages: MESSAGES_INCLUDE },
  })
  if (!ticket) throw err("Ticket not found", "NOT_FOUND", 404)
  return ticket
}

async function createProjectTicket({ userId, projectId, subject, message, priority = "medium", milestoneId = null, files = [] }) {
  const project = await loadOwnedProject({ userId, projectId })
  assertWritable(project)
  const text = validateTicketText({ subject, message })
  const sanitizedPriority = ALLOWED_PRIORITIES.includes(priority) ? priority : "medium"

  let milestone = null
  if (milestoneId) {
    milestone = await prisma.projectMilestone.findFirst({ where: { id: String(milestoneId), projectId: project.id }, select: { id: true, title: true } })
    if (!milestone) throw err("Milestone not found on this project", "NOT_FOUND", 404)
  }
  // SupportTicket has no milestone FK — the milestone title is folded into
  // the subject so the thread and the admin inbox both carry the context.
  const subjectFinal = milestone ? `[${milestone.title}] ${text.subject}`.slice(0, 200) : text.subject

  const ticket = await prisma.supportTicket.create({
    data: {
      ticketNumber: generateTicketNumber(),
      userId:       String(userId),
      projectId:    project.id,
      category:     PROJECT_TICKET_CATEGORY,
      subject:      subjectFinal,
      message:      text.message,
      priority:     sanitizedPriority,
      status:       "open",
      messages:     { create: { senderId: String(userId), message: text.message, senderRole: "member" } },
    },
    include: { messages: MESSAGES_INCLUDE, _count: { select: { messages: true } } },
  })

  const firstMessage = ticket.messages?.[0]
  if (files.length && firstMessage) {
    firstMessage.attachments = await attachTicketFiles({ projectId: project.id, uploadedById: userId, role: "client", messageId: firstMessage.id, files })
  }

  await prisma.activityLog.create({
    data: {
      userId:      String(userId),
      action:      "project.ticket.opened",
      entityType:  "SupportTicket",
      entityId:    ticket.id,
      description: `Client opened ticket ${ticket.ticketNumber} on ${project.projectName}: ${subjectFinal}`,
    },
  }).catch(() => null)

  notifyAdminsProjectActivity({
    project, kind: "ticket",
    summary: `${ticket.ticketNumber} · ${subjectFinal}${files.length ? ` (${files.length} attachment${files.length > 1 ? "s" : ""})` : ""}`,
  }).catch((e) => logger.warn("[tickets] admin notify failed", e.message))

  const user = await prisma.user
    .findUnique({ where: { id: String(userId) }, select: { email: true, fullName: true } })
    .catch(() => null)
  sendSupportTicketEmail(ticket, user).catch(() => {})

  return ticket
}

/** Member reply on a project ticket — both the project and the ticket must be owned. */
async function createProjectTicketMessage({ userId, projectId, ticketId, message, files = [] }) {
  const project = await loadOwnedProject({ userId, projectId })
  assertWritable(project)
  const text = String(message || "").trim()
  if (!text) throw err("Message is required", "VALIDATION_ERROR", 400)
  if (text.length > 5000) throw err("Message must be at most 5000 characters", "VALIDATION_ERROR", 400)

  const ticket = await prisma.supportTicket.findFirst({
    where:  { id: String(ticketId), userId: String(userId), projectId: project.id },
    select: { id: true, ticketNumber: true, status: true },
  })
  if (!ticket) throw err("Ticket not found", "NOT_FOUND", 404)

  const msg = await prisma.supportMessage.create({
    data: { ticketId: ticket.id, senderId: String(userId), message: text, senderRole: "member" },
  })
  msg.attachments = await attachTicketFiles({ projectId: project.id, uploadedById: userId, role: "client", messageId: msg.id, files })

  // A client reply on a resolved ticket reopens it — nobody watches a resolved queue.
  if (ticket.status === "resolved") {
    await prisma.supportTicket.updateMany({ where: { id: ticket.id, status: "resolved" }, data: { status: "open", resolvedAt: null } }).catch(() => null)
  }

  notifyAdminsProjectActivity({ project, kind: "ticket", summary: `${ticket.ticketNumber} · reply: ${text.slice(0, 140)}` })
    .catch((e) => logger.warn("[tickets] admin notify failed", e.message))

  return msg
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
        project: { select: PROJECT_SUMMARY_SELECT },
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
      project:  { select: PROJECT_SUMMARY_SELECT },
      messages: MESSAGES_INCLUDE,
    },
  })
}

/**
 * Admin reply. `files` (multer rows) are only honoured when the ticket is
 * project-scoped — attachments are ProjectFile rows and need a project to
 * live in. Callers routed through /admin/client-projects/:id/tickets/… pass
 * `projectId` so the ticket↔project pairing is verified.
 */
async function addAdminMessage({ ticketId, adminId, message, files = [], projectId = null }) {
  let ticketProjectId = null
  if (files.length || projectId) {
    const t = await prisma.supportTicket.findFirst({
      where:  { id: String(ticketId), ...(projectId ? { projectId: String(projectId) } : {}) },
      select: { id: true, projectId: true },
    })
    if (!t) throw err("Ticket not found", "NOT_FOUND", 404)
    if (files.length && !t.projectId) throw err("Attachments are only supported on project tickets", "VALIDATION_ERROR", 400)
    ticketProjectId = t.projectId
  }

  const msg = await prisma.supportMessage.create({
    data: { ticketId, senderId: adminId, message, senderRole: "admin" },
  })
  if (files.length) {
    msg.attachments = await attachTicketFiles({ projectId: ticketProjectId, uploadedById: adminId, role: "admin", messageId: msg.id, files })
  }

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
  PROJECT_TICKET_CATEGORY,
  listProjectTicketsForUser,
  getProjectTicketForUser,
  createProjectTicket,
  createProjectTicketMessage,
  getTicketForUser,
  userOwnsTicket,
  createMemberMessage,
  listTicketsAdmin,
  getTicketAdmin,
  addAdminMessage,
  updateTicketAdmin,
}
