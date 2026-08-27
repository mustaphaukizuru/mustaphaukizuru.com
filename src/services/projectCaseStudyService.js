/**
 * projectCaseStudyService · Tier 4 · turn a finished client project into a
 * draft Portfolio entry the admin can polish before publishing.
 *
 * Mapping (nothing here is public until the admin flips status):
 *   title / slug        ← projectName (unique slug via adminPortfolioService)
 *   client              ← client's company, else full name
 *   category            ← the ordered service's title, else "Consulting"
 *   shortDescription    ← description (trimmed to 280) or a stub
 *   caseStudy.context   ← description
 *   caseStudy.problem   ← first client comment, else description
 *   caseStudy.approach  ← milestones as ordered steps (≤5, normaliser cap)
 *   caseStudy.outcomes  ← []   (admin fills in real numbers)
 *   caseStudy.stack     ← []
 *   caseStudy.serviceSlug ← service slug when it is one of SERVICE_SLUGS
 *   year / duration     ← startDate..closedAt
 *
 * The `results` envelope is built by adminPortfolioService.create, which
 * calls composeResults(items, caseStudy) — so the stored shape is exactly
 * what the public portfolio page already reads.
 */

const prisma = require("../lib/prisma")
const adminPortfolioService = require("./adminPortfolioService")
const { SERVICE_SLUGS } = require("./portfolioService")

function err(message, code, statusCode = 400) {
  const e = new Error(message)
  e.code = code
  e.statusCode = statusCode
  return e
}

function frontendBase() {
  return String(process.env.FRONTEND_URL || process.env.CLIENT_URL || "").replace(/\/$/, "")
}

function monthsBetween(a, b) {
  if (!a || !b) return null
  const ms = new Date(b).getTime() - new Date(a).getTime()
  if (!Number.isFinite(ms) || ms <= 0) return null
  const weeks = Math.max(1, Math.round(ms / (7 * 24 * 60 * 60 * 1000)))
  if (weeks < 8) return `${weeks} week${weeks === 1 ? "" : "s"}`
  const months = Math.max(1, Math.round(ms / (30.44 * 24 * 60 * 60 * 1000)))
  return `${months} month${months === 1 ? "" : "s"}`
}

/** Pure: project row (with relations) → payload for adminPortfolioService.create */
function buildCaseStudyDraft(project) {
  const description = String(project.description || "").trim()
  const firstClientComment = (project.comments || []).find((c) => c.authorRole === "client" && String(c.body || "").trim())
  const service = project.serviceOrder?.service || null
  const user = project.user || {}

  const approach = (project.milestones || [])
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((m) => ({ title: String(m.title || "").trim(), body: m.description ? String(m.description).trim() : null }))
    .filter((s) => s.title)

  const closedAt = project.closedAt || project.updatedAt || null
  const year = closedAt ? new Date(closedAt).getFullYear() : (project.startDate ? new Date(project.startDate).getFullYear() : null)

  return {
    title:            project.projectName,
    role:             "Consultant",
    client:           user.company || user.fullName || null,
    category:         service?.title || "Consulting",
    shortDescription: description ? description.slice(0, 280) : `Case study draft for ${project.projectName}. Replace this summary before publishing.`,
    description:      description || null,
    status:           "draft",
    isFeatured:       false,
    year,
    duration:         monthsBetween(project.startDate, closedAt),
    caseStudy: {
      serviceSlug: service?.slug && SERVICE_SLUGS.includes(service.slug) ? service.slug : null,
      context:     description || null,
      problem:     firstClientComment ? String(firstClientComment.body).trim().slice(0, 2000) : (description || null),
      approach,
      outcomes:    [],
      stack:       [],
    },
  }
}

async function createCaseStudyDraft(projectId, adminId) {
  const project = await prisma.clientProject.findUnique({
    where:   { id: String(projectId) },
    include: {
      milestones: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      comments:   { orderBy: { createdAt: "asc" }, take: 200, select: { authorRole: true, body: true } },
      user:       { select: { fullName: true, company: true } },
      serviceOrder: { select: { service: { select: { slug: true, title: true } } } },
    },
  })
  if (!project) throw err("Project not found", "NOT_FOUND", 404)

  const payload = buildCaseStudyDraft(project)
  const row = await adminPortfolioService.create(payload, adminId || null)
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    editUrl: `${frontendBase()}/admin/portfolio/${row.id}/edit`,
  }
}

module.exports = { buildCaseStudyDraft, createCaseStudyDraft, monthsBetween }
