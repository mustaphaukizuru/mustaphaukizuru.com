const asyncHandler = require("../utils/asyncHandler")
const newsletterService = require("../services/newsletterService")

const list = asyncHandler(async (req, res) => {
  const { status, page, limit, q } = req.query
  const result = await newsletterService.listSubscribers({
    status, q,
    page:  page  ? Number(page)  : 1,
    limit: limit ? Number(limit) : 50,
  })
  res.json({ success: true, data: result.items, pagination: result.pagination })
})

const remove = asyncHandler(async (req, res) => {
  const result = await newsletterService.deleteSubscriber(req.params.id)
  if (!result) {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Subscriber not found" })
  }
  res.json({ success: true, data: result })
})

const exportCsv = asyncHandler(async (req, res) => {
  const { status } = req.body || {}
  const { csv, count } = await newsletterService.exportSubscribersCsv({ status })
  const filename = `newsletter-subscribers-${new Date().toISOString().slice(0,10)}.csv`
  res.setHeader("Content-Type", "text/csv; charset=utf-8")
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
  res.setHeader("X-Subscriber-Count", String(count))
  res.send(csv)
})

module.exports = { list, remove, exportCsv }
