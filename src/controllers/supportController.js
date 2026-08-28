const asyncHandler   = require("../utils/asyncHandler")
const supportService = require("../services/supportService")

// Phase 9.2c · asyncHandler so unhandled errors flow into the central
// errorHandler middleware. Step 39 · all Prisma access moved to
// services/supportService.js — this file only validates input and shapes
// the HTTP response. Response shapes are unchanged.

// ─────────────────────────────────────────────────────────────────────────────
// MEMBER SUPPORT CONTROLLER
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/member/support/tickets
const getMyTickets = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" })

  // Best-effort: the service resolves to [] on a read error so the dashboard
  // widget never blows up the page.
  const tickets = await supportService.listTicketsForUser(userId)
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

  const ticket = await supportService.createTicket({ userId, subject: subjectTrimmed, message: messageTrimmed, priority })
  return res.status(201).json({ success: true, data: ticket })
})

// GET /api/member/support/tickets/:id
const getTicket = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  const { id } = req.params
  if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" })

  const ticket = await supportService.getTicketForUser(id, userId)
  if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" })
  return res.status(200).json({ success: true, data: ticket })
})

// POST /api/member/support/tickets/:id/messages
const replyToTicket = asyncHandler(async (req, res) => {
  const userId  = req.user?.id
  const { id }  = req.params
  const { message } = req.body
  if (!userId)  return res.status(401).json({ success: false, message: "Unauthorized" })
  if (!message || typeof message !== "string") return res.status(400).json({ success: false, message: "Message is required" })
  const messageTrimmed = message.trim()
  if (messageTrimmed.length < 1 || messageTrimmed.length > 5000) {
    return res.status(400).json({ success: false, message: "Message must be 1–5000 characters" })
  }

  if (!(await supportService.userOwnsTicket(id, userId))) {
    return res.status(404).json({ success: false, message: "Ticket not found" })
  }

  const msg = await supportService.createMemberMessage({ ticketId: id, userId, message: messageTrimmed })
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
  const { tickets, meta } = await supportService.listTicketsAdmin({ status, priority, category, page, limit })
  return res.status(200).json({ success: true, data: tickets, meta })
})

// GET /api/admin/support/tickets/:id
const adminGetTicket = asyncHandler(async (req, res) => {
  const ticket = await supportService.getTicketAdmin(req.params.id)
  if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" })
  return res.status(200).json({ success: true, data: ticket })
})

// POST /api/admin/support/tickets/:id/messages  (admin reply)
const adminReplyToTicket = asyncHandler(async (req, res) => {
  const adminId = req.user?.id
  const { message } = req.body
  if (!message) return res.status(400).json({ success: false, message: "Message is required" })

  const msg = await supportService.addAdminMessage({ ticketId: req.params.id, adminId, message })
  return res.status(201).json({ success: true, data: msg })
})

// PATCH /api/admin/support/tickets/:id
const adminUpdateTicket = asyncHandler(async (req, res) => {
  const { status, priority, assignedAdminId } = req.body
  const ticket = await supportService.updateTicketAdmin(req.params.id, { status, priority, assignedAdminId })
  return res.status(200).json({ success: true, data: ticket })
})

module.exports = {
  getMyTickets, createTicket, getTicket, replyToTicket,
  adminGetAllTickets, adminGetTicket, adminReplyToTicket, adminUpdateTicket,
}
