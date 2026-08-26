// =============================================================
// bioController.js · public Bio HTTP I/O (M12)
// =============================================================

const asyncHandler = require("../utils/asyncHandler")
const bioService = require("../services/bioService")
const cvPdfService = require("../services/cvPdfService")

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

/**
 * GET /bio/cv.pdf?lang=en|es&track=fullstack|ict-stem|support
 * Server-generated CV from the Bio CMS rows (Tier 3). Cached on disk per
 * lang+track+bio version; browsers/CDN may hold it for an hour.
 */
exports.cvPdf = asyncHandler(async (req, res) => {
  const { buffer, fileName, version } = await cvPdfService.getCvPdf({
    lang:  req.query.lang,
    track: req.query.track,
  })
  res.set({
    "Content-Type":        "application/pdf",
    "Content-Length":      String(buffer.length),
    "Content-Disposition": `inline; filename="mustapha-ukizuru-cv-${fileName}"`,
    "Cache-Control":       "public, max-age=3600",
    "ETag":                `"cv-${fileName}-${version}"`,
  })
  res.send(buffer)
})
