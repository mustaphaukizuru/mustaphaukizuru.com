const asyncHandler = require("../utils/asyncHandler")
const adminServiceService = require("../services/adminServiceService")

/* ── Service collection ───────────────────────────────────────────────── */

const list = asyncHandler(async (req, res) => {
  const { page, limit, includeArchived } = req.query
  const result = await adminServiceService.listAllServices({
    page:            page  ? Number(page)  : 1,
    limit:           limit ? Number(limit) : 50,
    includeArchived: includeArchived === "true" || includeArchived === "1",
  })
  res.json({
    success:    true,
    data:       result.items,
    pagination: result.pagination,
  })
})

const getOne = asyncHandler(async (req, res) => {
  const service = await adminServiceService.getServiceForAdmin(req.params.id)
  if (!service) {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Service not found" })
  }
  res.json({ success: true, data: service })
})

const create = asyncHandler(async (req, res) => {
  const service = await adminServiceService.createService(req.body || {}, req.user?.id)
  res.status(201).json({ success: true, data: service })
})

const update = asyncHandler(async (req, res) => {
  const service = await adminServiceService.updateService(req.params.id, req.body || {})
  if (!service) {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Service not found" })
  }
  res.json({ success: true, data: service })
})

const softDelete = asyncHandler(async (req, res) => {
  const service = await adminServiceService.softDeleteService(req.params.id)
  if (!service) {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Service not found" })
  }
  res.json({ success: true, data: service })
})

/* ── Package subroutes ────────────────────────────────────────────────── */

const addPackage = asyncHandler(async (req, res) => {
  const pkg = await adminServiceService.addPackage(req.params.id, req.body || {})
  res.status(201).json({ success: true, data: pkg })
})

const updatePackage = asyncHandler(async (req, res) => {
  const { id, pid } = req.params
  const pkg = await adminServiceService.updatePackage(id, pid, req.body || {})
  if (!pkg) {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Package not found" })
  }
  res.json({ success: true, data: pkg })
})

const removePackage = asyncHandler(async (req, res) => {
  const { id, pid } = req.params
  const result = await adminServiceService.removePackage(id, pid)
  if (!result) {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Package not found" })
  }
  res.json({ success: true, data: result })
})

/* ── Feature subroutes ────────────────────────────────────────────────── */

const addFeature = asyncHandler(async (req, res) => {
  const feature = await adminServiceService.addFeature(req.params.id, req.body || {})
  res.status(201).json({ success: true, data: feature })
})

const removeFeature = asyncHandler(async (req, res) => {
  const { id, fid } = req.params
  const result = await adminServiceService.removeFeature(id, fid)
  if (!result) {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Feature not found" })
  }
  res.json({ success: true, data: result })
})

module.exports = {
  list, getOne, create, update, softDelete,
  addPackage, updatePackage, removePackage,
  addFeature, removeFeature,
}
