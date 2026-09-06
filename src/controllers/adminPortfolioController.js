const asyncHandler = require("../utils/asyncHandler")
const adminPortfolioService = require("../services/adminPortfolioService")

/* ── Collection ─────────────────────────────────────────────────────── */

const list = asyncHandler(async (req, res) => {
  const { status, isFeatured, page, limit } = req.query
  const result = await adminPortfolioService.listAll({
    status,
    isFeatured,
    page:  page  ? Number(page)  : 1,
    limit: limit ? Number(limit) : 50,
  })
  res.json({
    success:    true,
    data:       result.items,
    pagination: result.pagination,
  })
})

const getOne = asyncHandler(async (req, res) => {
  const row = await adminPortfolioService.getOne(req.params.id)
  if (!row) {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Portfolio item not found" })
  }
  res.json({ success: true, data: row })
})

const create = asyncHandler(async (req, res) => {
  const row = await adminPortfolioService.create(req.body || {}, req.user?.id)
  res.status(201).json({ success: true, data: row })
})

const update = asyncHandler(async (req, res) => {
  const row = await adminPortfolioService.update(req.params.id, req.body || {})
  if (!row) {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Portfolio item not found" })
  }
  res.json({ success: true, data: row })
})

const softDelete = asyncHandler(async (req, res) => {
  const row = await adminPortfolioService.softDelete(req.params.id)
  if (!row) {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Portfolio item not found" })
  }
  res.json({ success: true, data: row })
})

/* ── Bulk reorder ───────────────────────────────────────────────────── */
// IMPORTANT: This route must be declared BEFORE /:id routes in the router
// so Express doesn't match "order" as a bare id.

const reorder = asyncHandler(async (req, res) => {
  const { orderedIds } = req.body || {}
  const result = await adminPortfolioService.bulkReorder(orderedIds)
  res.json({ success: true, data: result })
})

/* ── Image uploads (cover + gallery) ───────────────────────────────── */

function publicUrlForUpload(req) {
  // multer stores to /public/images/portfolio/<filename>. We expose it as
  // /images/portfolio/<filename> — the Express static server in app.js serves
  // /public at site root.
  const filename = req.file?.filename
  if (!filename) return null
  return `/images/portfolio/${filename}`
}

const uploadCover = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "No file uploaded" })
  }
  const publicUrl = publicUrlForUpload(req)
  const row = await adminPortfolioService.setCover(req.params.id, publicUrl)
  if (!row) {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Portfolio item not found" })
  }
  res.json({ success: true, data: { coverImage: publicUrl, portfolio: row } })
})

const uploadGallery = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "No file uploaded" })
  }
  const publicUrl = publicUrlForUpload(req)
  const row = await adminPortfolioService.appendGalleryImage(req.params.id, publicUrl)
  if (!row) {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Portfolio item not found" })
  }
  res.json({ success: true, data: { galleryImage: publicUrl, portfolio: row } })
})

module.exports = {
  list, getOne, create, update, softDelete,
  reorder, uploadCover, uploadGallery,
}
