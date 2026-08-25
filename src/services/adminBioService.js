// @ts-check
// =============================================================
// adminBioService.js · Admin Bio CRUD (M12)
// =============================================================

const prisma = require("../lib/prisma")

const SKILL_CATEGORIES = new Set([
  "frontend", "backend", "tools", "database", "cloud", "language", "soft_skill",
])

// ---- Experience -----------------------------------------------

exports.listExperience = async () =>
  prisma.experience.findMany({ orderBy: [{ displayOrder: "asc" }, { startDate: "desc" }], take: 200 })

exports.createExperience = async (data) =>
  prisma.experience.create({
    data: {
      role:          data.role,
      company:       data.company,
      companyLogo:   data.companyLogo ?? null,
      location:      data.location ?? null,
      startDate:     new Date(data.startDate),
      endDate:       data.endDate ? new Date(data.endDate) : null,
      description:   data.description,
      highlights:    data.highlights ?? null,
      tools:         data.tools ?? null,
      displayOrder:  Number(data.displayOrder ?? 0),
      isVisible:     data.isVisible !== false,
    },
  })

exports.updateExperience = async (id, data) => {
  const patch = {}
  for (const k of [
    "role", "company", "companyLogo", "location",
    "description", "highlights", "tools", "isVisible",
  ]) if (k in data) patch[k] = data[k]
  if ("startDate"    in data) patch.startDate    = new Date(data.startDate)
  if ("endDate"      in data) patch.endDate      = data.endDate ? new Date(data.endDate) : null
  if ("displayOrder" in data) patch.displayOrder = Number(data.displayOrder)
  return prisma.experience.update({ where: { id: String(id) }, data: patch })
}

exports.deleteExperience = async (id) => {
  await prisma.experience.delete({ where: { id: String(id) } })
  return { id: String(id), deleted: true }
}

// ---- Certificate ----------------------------------------------

exports.listCertificates = async () =>
  prisma.certificate.findMany({ orderBy: [{ displayOrder: "asc" }, { issueDate: "desc" }], take: 200 })

exports.createCertificate = async (data) =>
  prisma.certificate.create({
    data: {
      title:          data.title,
      issuer:         data.issuer,
      issuerLogo:     data.issuerLogo ?? null,
      issueDate:      new Date(data.issueDate),
      expiryDate:     data.expiryDate ? new Date(data.expiryDate) : null,
      credentialId:   data.credentialId ?? null,
      credentialUrl:  data.credentialUrl ?? null,
      pdfUrl:         data.pdfUrl ?? null,
      category:       data.category ?? null,
      displayOrder:   Number(data.displayOrder ?? 0),
      isVisible:      data.isVisible !== false,
    },
  })

exports.updateCertificate = async (id, data) => {
  const patch = {}
  for (const k of [
    "title", "issuer", "issuerLogo",
    "credentialId", "credentialUrl", "pdfUrl", "category", "isVisible",
  ]) if (k in data) patch[k] = data[k]
  if ("issueDate"    in data) patch.issueDate    = new Date(data.issueDate)
  if ("expiryDate"   in data) patch.expiryDate   = data.expiryDate ? new Date(data.expiryDate) : null
  if ("displayOrder" in data) patch.displayOrder = Number(data.displayOrder)
  return prisma.certificate.update({ where: { id: String(id) }, data: patch })
}

exports.deleteCertificate = async (id) => {
  await prisma.certificate.delete({ where: { id: String(id) } })
  return { id: String(id), deleted: true }
}

// ---- Skill ----------------------------------------------------

exports.listSkills = async () =>
  prisma.skill.findMany({ orderBy: [{ category: "asc" }, { displayOrder: "asc" }, { name: "asc" }], take: 200 })

exports.createSkill = async (data) => {
  if (!SKILL_CATEGORIES.has(data.category)) {
    const e = new Error("INVALID_SKILL_CATEGORY"); e.code = "INVALID_SKILL_CATEGORY"; e.status = 400; throw e
  }
  const proficiency = Math.max(1, Math.min(5, Number(data.proficiency) || 3))
  return prisma.skill.create({
    data: {
      name:          data.name,
      category:      data.category,
      proficiency,
      iconKey:       data.iconKey ?? null,
      yearsUsing:    data.yearsUsing ? Number(data.yearsUsing) : null,
      displayOrder:  Number(data.displayOrder ?? 0),
      isVisible:     data.isVisible !== false,
    },
  })
}

exports.updateSkill = async (id, data) => {
  if (data.category && !SKILL_CATEGORIES.has(data.category)) {
    const e = new Error("INVALID_SKILL_CATEGORY"); e.code = "INVALID_SKILL_CATEGORY"; e.status = 400; throw e
  }
  const patch = {}
  for (const k of ["name", "category", "iconKey", "isVisible"]) if (k in data) patch[k] = data[k]
  if ("proficiency"  in data) patch.proficiency  = Math.max(1, Math.min(5, Number(data.proficiency)))
  if ("yearsUsing"   in data) patch.yearsUsing   = data.yearsUsing ? Number(data.yearsUsing) : null
  if ("displayOrder" in data) patch.displayOrder = Number(data.displayOrder)
  return prisma.skill.update({ where: { id: String(id) }, data: patch })
}

exports.deleteSkill = async (id) => {
  await prisma.skill.delete({ where: { id: String(id) } })
  return { id: String(id), deleted: true }
}

// ---- Education ------------------------------------------------

exports.listEducation = async () =>
  prisma.education.findMany({ orderBy: [{ displayOrder: "asc" }, { startDate: "desc" }], take: 200 })

exports.createEducation = async (data) =>
  prisma.education.create({
    data: {
      degree:          data.degree,
      institution:     data.institution,
      institutionLogo: data.institutionLogo ?? null,
      location:        data.location ?? null,
      startDate:       new Date(data.startDate),
      endDate:         data.endDate ? new Date(data.endDate) : null,
      description:     data.description,
      highlights:      data.highlights ?? null,
      fieldOfStudy:    data.fieldOfStudy ?? null,
      grade:           data.grade ?? null,
      displayOrder:    Number(data.displayOrder ?? 0),
      isVisible:       data.isVisible !== false,
    },
  })

exports.updateEducation = async (id, data) => {
  const patch = {}
  for (const k of [
    "degree", "institution", "institutionLogo", "location",
    "description", "highlights", "fieldOfStudy", "grade", "isVisible",
  ]) if (k in data) patch[k] = data[k]
  if ("startDate"    in data) patch.startDate    = new Date(data.startDate)
  if ("endDate"      in data) patch.endDate      = data.endDate ? new Date(data.endDate) : null
  if ("displayOrder" in data) patch.displayOrder = Number(data.displayOrder)
  return prisma.education.update({ where: { id: String(id) }, data: patch })
}

exports.deleteEducation = async (id) => {
  await prisma.education.delete({ where: { id: String(id) } })
  return { id: String(id), deleted: true }
}
