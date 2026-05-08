// =============================================================
// adminBioController.js · Admin Bio CRUD HTTP I/O (M12)
// =============================================================

const asyncHandler = require("../utils/asyncHandler")
const adminBioService = require("../services/adminBioService")

function badRequest(res, message, details) {
  return res.status(400).json({
    success: false,
    error: { code: "VALIDATION_ERROR", message, ...(details ? { details } : {}) },
  })
}
function reqStr(v, n) { return typeof v !== "string" || !v.trim() ? `${n} is required` : null }

// ---- Experience -----------------------------------------------

exports.listExperience = asyncHandler(async (_req, res) => {
  const items = await adminBioService.listExperience()
  res.json({ success: true, data: items })
})

exports.createExperience = asyncHandler(async (req, res) => {
  const errs = []
  for (const [v, n] of [
    [req.body.role, "role"],
    [req.body.company, "company"],
    [req.body.description, "description"],
  ]) {
    const e = reqStr(v, n); if (e) errs.push(e)
  }
  if (!req.body.startDate || isNaN(new Date(req.body.startDate).getTime())) {
    errs.push("startDate is required")
  }
  if (errs.length) return badRequest(res, "Invalid experience payload", errs)

  const created = await adminBioService.createExperience(req.body)
  res.status(201).json({ success: true, data: created })
})

exports.updateExperience = asyncHandler(async (req, res) => {
  const updated = await adminBioService.updateExperience(req.params.id, req.body)
  res.json({ success: true, data: updated })
})

exports.deleteExperience = asyncHandler(async (req, res) => {
  await adminBioService.deleteExperience(req.params.id)
  res.json({ success: true, data: { id: req.params.id, deleted: true } })
})

// ---- Certificate ----------------------------------------------

exports.listCertificates = asyncHandler(async (_req, res) => {
  const items = await adminBioService.listCertificates()
  res.json({ success: true, data: items })
})

exports.createCertificate = asyncHandler(async (req, res) => {
  const errs = []
  for (const [v, n] of [
    [req.body.title, "title"],
    [req.body.issuer, "issuer"],
  ]) {
    const e = reqStr(v, n); if (e) errs.push(e)
  }
  if (!req.body.issueDate || isNaN(new Date(req.body.issueDate).getTime())) {
    errs.push("issueDate is required")
  }
  if (errs.length) return badRequest(res, "Invalid certificate payload", errs)

  const created = await adminBioService.createCertificate(req.body)
  res.status(201).json({ success: true, data: created })
})

exports.updateCertificate = asyncHandler(async (req, res) => {
  const updated = await adminBioService.updateCertificate(req.params.id, req.body)
  res.json({ success: true, data: updated })
})

exports.deleteCertificate = asyncHandler(async (req, res) => {
  await adminBioService.deleteCertificate(req.params.id)
  res.json({ success: true, data: { id: req.params.id, deleted: true } })
})

// ---- Skill ----------------------------------------------------

exports.listSkills = asyncHandler(async (_req, res) => {
  const items = await adminBioService.listSkills()
  res.json({ success: true, data: items })
})

exports.createSkill = asyncHandler(async (req, res) => {
  const errs = []
  const e1 = reqStr(req.body.name, "name");         if (e1) errs.push(e1)
  const e2 = reqStr(req.body.category, "category"); if (e2) errs.push(e2)
  if (errs.length) return badRequest(res, "Invalid skill payload", errs)

  try {
    const created = await adminBioService.createSkill(req.body)
    res.status(201).json({ success: true, data: created })
  } catch (err) {
    if (err.code === "INVALID_SKILL_CATEGORY") return badRequest(res, "Invalid skill category")
    throw err
  }
})

exports.updateSkill = asyncHandler(async (req, res) => {
  try {
    const updated = await adminBioService.updateSkill(req.params.id, req.body)
    res.json({ success: true, data: updated })
  } catch (err) {
    if (err.code === "INVALID_SKILL_CATEGORY") return badRequest(res, "Invalid skill category")
    throw err
  }
})

exports.deleteSkill = asyncHandler(async (req, res) => {
  await adminBioService.deleteSkill(req.params.id)
  res.json({ success: true, data: { id: req.params.id, deleted: true } })
})

// ---- Education ------------------------------------------------

exports.listEducation = asyncHandler(async (_req, res) => {
  const items = await adminBioService.listEducation()
  res.json({ success: true, data: items })
})

exports.createEducation = asyncHandler(async (req, res) => {
  const errs = []
  for (const [v, n] of [
    [req.body.degree, "degree"],
    [req.body.institution, "institution"],
    [req.body.description, "description"],
  ]) {
    const e = reqStr(v, n); if (e) errs.push(e)
  }
  if (!req.body.startDate || isNaN(new Date(req.body.startDate).getTime())) {
    errs.push("startDate is required")
  }
  if (errs.length) return badRequest(res, "Invalid education payload", errs)

  const created = await adminBioService.createEducation(req.body)
  res.status(201).json({ success: true, data: created })
})

exports.updateEducation = asyncHandler(async (req, res) => {
  const updated = await adminBioService.updateEducation(req.params.id, req.body)
  res.json({ success: true, data: updated })
})

exports.deleteEducation = asyncHandler(async (req, res) => {
  await adminBioService.deleteEducation(req.params.id)
  res.json({ success: true, data: { id: req.params.id, deleted: true } })
})
