const asyncHandler = require("../utils/asyncHandler")
const leadService = require("../services/leadService")

/** GET /api/v1/admin/leads?q=&source=&page=&limit= */
const list = asyncHandler(async (req, res) => {
  const { q, source, page, limit } = req.query || {}
  const result = await leadService.listLeads({ q, source, page, limit })
  return res.json({ success: true, ...result })
})

/** GET /api/v1/admin/leads/:email */
const timeline = asyncHandler(async (req, res) => {
  const result = await leadService.getLeadTimeline(req.params.email)
  if (!result) return res.status(404).json({ success: false, message: "Lead not found" })
  return res.json({ success: true, data: result })
})

module.exports = { list, timeline }
