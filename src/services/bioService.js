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

/* ── Proof numbers (Tier 3) ─────────────────────────────────────────────
 * Public social-proof counters for the Home strip and the About hero,
 * computed from the DB instead of hardcoded in web/src/data/homeData.js.
 * Served through lib/ttlCache for PROOF_TTL_MS (10 min; disabled under
 * test so per-test prisma mocks are never bridged). */

const { cache } = require("../lib/ttlCache")

const PROOF_TTL_MS = process.env.NODE_ENV === "test" ? 0 : (Number(process.env.PROOF_TTL_MS) || 10 * 60_000)
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000

function yearsSince(date, now = new Date()) {
  if (!date) return 0
  const start = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(start.getTime())) return 0
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / MS_PER_YEAR))
}

async function getProofUncached() {
  const [projects, clientRows, reviewAgg, firstExperience] = await Promise.all([
    prisma.portfolio.count({ where: { status: "published" } }),
    prisma.clientProject.findMany({ distinct: ["userId"], select: { userId: true } }),
    prisma.review.aggregate({ where: { status: "approved" }, _count: { _all: true }, _avg: { rating: true } }),
    prisma.experience.findFirst({
      where: { isVisible: true },
      orderBy: { startDate: "asc" },
      select: { startDate: true },
    }),
  ])

  const reviews   = Number(reviewAgg?._count?._all || 0)
  const avgRaw    = reviewAgg?._avg?.rating
  const avgRating = reviews > 0 && avgRaw != null ? Math.round(Number(avgRaw) * 10) / 10 : 0

  return {
    projects:  Number(projects || 0),
    clients:   Array.isArray(clientRows) ? clientRows.length : 0,
    reviews,
    avgRating,
    years:     yearsSince(firstExperience?.startDate),
  }
}

const getProof = () => cache.wrap("proof", undefined, PROOF_TTL_MS, getProofUncached)

exports.getProof = getProof
exports.getProofUncached = getProofUncached
exports.yearsSince = yearsSince
