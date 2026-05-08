// =============================================================
// bioService.js · public Bio API (M12)
// Read-only — powers the About page sections.
// =============================================================

const prisma = require("../lib/prisma")

exports.listExperience = async () => {
  return prisma.experience.findMany({
    where: { isVisible: true },
    orderBy: [{ displayOrder: "asc" }, { startDate: "desc" }],
  })
}

exports.listCertificates = async () => {
  const items = await prisma.certificate.findMany({
    where: { isVisible: true },
    orderBy: [{ displayOrder: "asc" }, { issueDate: "desc" }],
  })
  // Group by category for the About page render
  const grouped = items.reduce((acc, c) => {
    const key = c.category || "general"
    if (!acc[key]) acc[key] = []
    acc[key].push(c)
    return acc
  }, {})
  return { items, grouped }
}

exports.listEducation = async () => {
  return prisma.education.findMany({
    where: { isVisible: true },
    orderBy: [{ displayOrder: "asc" }, { startDate: "desc" }],
  })
}

exports.listSkills = async () => {
  const items = await prisma.skill.findMany({
    where: { isVisible: true },
    orderBy: [{ category: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
  })
  const grouped = items.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = []
    acc[s.category].push(s)
    return acc
  }, {})
  return { items, grouped }
}
