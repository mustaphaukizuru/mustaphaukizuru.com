const asyncHandler = require("../utils/asyncHandler")
const contactService = require("../services/contactService")

/**
 * Admin contact-message controller.
 *
 * All endpoints require admin auth — mounted under `/api/v1/admin/contact-messages`
 * with `protect` + `adminOnly` middleware applied at the router level.
 *
 *   GET    /         → paginated list with filters
 *   GET    /stats    → counts per status (for dashboard tile)
 *   GET    /:id      → full single message
 *   PATCH  /:id      → update status (read/replied)
 *   DELETE /:id      → hard delete (GDPR)
 */

const list = asyncHandler(async (req, res) => {
  const { status, q, page, limit } = req.query
  const result = await contactService.listContactMessages({
    status,
    q,
    page:  page  ? Number(page)  : 1,
    limit: limit ? Number(limit) : 50,
  })
  res.json({ success: true, data: result.items, pagination: result.pagination })
})

const stats = asyncHandler(async (_req, res) => {
  const data = await contactService.getContactMessageStats()
  res.json({ success: true, data })
})

const getOne = asyncHandler(async (req, res) => {
  const item = await contactService.getContactMessageById(req.params.id)
  if (!item) {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Contact message not found" })
  }
  res.json({ success: true, data: item })
})

const updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body || {}
  try {
    const item = await contactService.updateContactMessageStatus(req.params.id, status)
    if (!item) {
      return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Contact message not found" })
    }
    res.json({ success: true, data: item })
  } catch (err) {
    if (err.code === "VALIDATION_ERROR") {
      return res.status(err.statusCode || 400).json({
        success: false, code: err.code, message: err.message,
      })
    }
    throw err
  }
})

const remove = asyncHandler(async (req, res) => {
  const item = await contactService.deleteContactMessage(req.params.id)
  if (!item) {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Contact message not found" })
  }
  res.json({ success: true, data: { id: item.id, removed: true } })
})

module.exports = { list, stats, getOne, updateStatus, remove }
