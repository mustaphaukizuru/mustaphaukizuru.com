// =============================================================
// bioController.js · public Bio HTTP I/O (M12)
// =============================================================

const asyncHandler = require("../utils/asyncHandler")
const bioService = require("../services/bioService")

exports.experience = asyncHandler(async (_req, res) => {
  const items = await bioService.listExperience()
  res.json({ success: true, data: items })
})

exports.certificates = asyncHandler(async (_req, res) => {
  const result = await bioService.listCertificates()
  res.json({ success: true, data: result.items, grouped: result.grouped })
})

exports.skills = asyncHandler(async (_req, res) => {
  const result = await bioService.listSkills()
  res.json({ success: true, data: result.items, grouped: result.grouped })
})

exports.education = asyncHandler(async (_req, res) => {
  const items = await bioService.listEducation()
  res.json({ success: true, data: items })
})
