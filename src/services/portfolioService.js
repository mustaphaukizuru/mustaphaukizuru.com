const prisma = require("../lib/prisma")
const { pickLocale, pickLocaleMany } = require("../utils/pickLocale")

/* ────────────────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────────────────── */

function safeJsonArray(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value === "string") {
    try { const p = JSON.parse(value); return Array.isArray(p) ? p : [] } catch { return [] }
  }
  return []
}


/* ────────────────────────────────────────────────────────────────────────────
 * Case study (roadmap step 27)
 *
 * No schema change: the `results` Json column now carries either the legacy
 * string[] OR an envelope `{ items: string[], caseStudy: {...} }`. The
 * helpers below split/compose that envelope so every consumer keeps seeing
 * `results` as a plain array and gets `caseStudy` as a normalized object.
 *
 * caseStudy shape (all fields optional, `*Es` siblings are Spanish copies):
 *   {
 *     serviceSlug: "it-strategy-consulting" | "ai-automation"
 *               | "cloud-architecture-migration" | "digital-product-engineering",
 *     context:  string,            // client / situation
 *     problem:  string,
 *     approach: [{ title, body }], // 3–5 steps
 *     outcomes: [{ value, label, placeholder?: boolean }], // 2–3 quantified
 *     stack:    string[],          // falls back to `tools` when empty
 *   }
 * ──────────────────────────────────────────────────────────────────────────── */

const SERVICE_SLUGS = [
  "it-strategy-consulting",
  "ai-automation",
  "cloud-architecture-migration",
  "digital-product-engineering",
]

function cleanString(v) {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s ? s : null
}

function parseJson(value) {
  if (typeof value !== "string") return value
  try { return JSON.parse(value) } catch { return null }
}

function normalizeCaseStudy(input) {
  const raw = parseJson(input)
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null

  const serviceSlug = SERVICE_SLUGS.includes(raw.serviceSlug) ? raw.serviceSlug : null

  const approach = (Array.isArray(raw.approach) ? raw.approach : [])
    .map((step) => {
      if (typeof step === "string") return { title: cleanString(step), body: null, titleEs: null, bodyEs: null }
      if (!step || typeof step !== "object") return null
      return {
        title:   cleanString(step.title),
        body:    cleanString(step.body),
        titleEs: cleanString(step.titleEs),
        bodyEs:  cleanString(step.bodyEs),
      }
    })
    .filter((s) => s && (s.title || s.body))
    .slice(0, 5)

  const outcomes = (Array.isArray(raw.outcomes) ? raw.outcomes : [])
    .map((o) => {
      if (!o || typeof o !== "object") return null
      return {
        value:       cleanString(o.value),
        label:       cleanString(o.label),
        labelEs:     cleanString(o.labelEs),
        placeholder: Boolean(o.placeholder),
      }
    })
    .filter((o) => o && (o.value || o.label))
    .slice(0, 3)

  const stack = (Array.isArray(raw.stack) ? raw.stack : [])
    .map(cleanString).filter(Boolean)

  const cs = {
    serviceSlug,
    context:   cleanString(raw.context),
    contextEs: cleanString(raw.contextEs),
    problem:   cleanString(raw.problem),
    problemEs: cleanString(raw.problemEs),
    approach,
    outcomes,
    stack,
  }
  const hasContent = cs.serviceSlug || cs.context || cs.problem || approach.length || outcomes.length || stack.length
  return hasContent ? cs : null
}

/** Split the `results` column into { items: string[], caseStudy } */
function splitResults(value) {
  const raw = parseJson(value)
  if (Array.isArray(raw)) return { items: raw.map((r) => String(r)), caseStudy: null }
  if (raw && typeof raw === "object") {
    return {
      items:     safeJsonArray(raw.items).map((r) => String(r)),
      caseStudy: normalizeCaseStudy(raw.caseStudy),
    }
  }
  return { items: [], caseStudy: null }
}

/** Compose the `results` column value from a plain array + case study */
function composeResults(items, caseStudy) {
  const list = Array.isArray(items) ? items.map((v) => String(v).trim()).filter(Boolean) : []
  const cs = normalizeCaseStudy(caseStudy)
  if (!cs) return list
  return { items: list, caseStudy: cs }
}

/** Resolve `*Es` siblings inside the case study for the requested locale */
function localizeCaseStudy(cs, locale = "en") {
  if (!cs) return null
  if (locale !== "es") return cs
  const base = pickLocale(cs, "es")
  return {
    ...base,
    approach: (cs.approach || []).map((s) => pickLocale(s, "es")),
    outcomes: (cs.outcomes || []).map((o) => pickLocale(o, "es")),
  }
}

/** One-line outcome for cards: "-40% deploy time · 3x faster onboarding" */
function outcomeLine(cs) {
  if (!cs || !Array.isArray(cs.outcomes) || cs.outcomes.length === 0) return null
  return cs.outcomes
    .slice(0, 2)
    .map((o) => [o.value, o.label].filter(Boolean).join(" "))
    .join(" · ")
}

function serializePortfolio(row, locale = "en") {
  if (!row) return null
  const { items: resultItems, caseStudy: rawCaseStudy } = splitResults(row.results)
  const caseStudy = localizeCaseStudy(rawCaseStudy, locale)
  if (!row) return null
  return {
    id:               row.id,
    title:            row.title,
    slug:             row.slug,
    role:             row.role,
    client:           row.client || null,
    category:         row.category,
    coverImage:       row.coverImage || null,
    gallery:          safeJsonArray(row.gallery),
    shortDescription: row.shortDescription,
    description:      row.description || null,
    challenge:        row.challenge   || null,
    solution:         row.solution    || null,
    results:          resultItems,
    caseStudy,
    outcomeLine:      outcomeLine(caseStudy),
    hasPlaceholderMetrics: Boolean(caseStudy && caseStudy.outcomes.some((o) => o.placeholder)),
    tools:            safeJsonArray(row.tools),
    tags:             safeJsonArray(row.tags),
    liveUrl:          row.liveUrl || null,
    repoUrl:          row.repoUrl || null,
    year:             row.year || null,
    duration:         row.duration || null,
    status:           row.status,
    isFeatured:       Boolean(row.isFeatured),
    displayOrder:     row.displayOrder,
    metaTitle:        row.metaTitle || null,
    metaDescription:  row.metaDescription || null,
    createdAt:        row.createdAt,
    updatedAt:        row.updatedAt,
    // I18N06 · Spanish bilingual columns. Surfaced verbatim so the admin
    // form can hydrate both locales on edit. Public reads run through
    // pickLocale (auto-suffix) which already swaps the canonical fields
    // when locale === "es", so these extras are harmless on the wire.
    titleEs:            row.titleEs            || null,
    shortDescriptionEs: row.shortDescriptionEs || null,
    descriptionEs:      row.descriptionEs      || null,
    metaTitleEs:        row.metaTitleEs        || null,
    metaDescriptionEs:  row.metaDescriptionEs  || null,
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Public reads
 * ──────────────────────────────────────────────────────────────────────────── */

async function listPortfolio({ category, service, isFeatured, page = 1, limit = 24, locale = "en" } = {}) {
  const safePage  = Math.max(1, Number(page) || 1)
  const safeLimit = Math.min(48, Math.max(1, Number(limit) || 24))

  const where = { status: "published" }
  if (category) where.category = category
  if (isFeatured === true || isFeatured === "true") where.isFeatured = true
  // Service-category filter reads inside the `results` Json envelope (MySQL JSON path)
  if (service && SERVICE_SLUGS.includes(service)) {
    where.results = { path: "$.caseStudy.serviceSlug", equals: service }
  }

  const [items, total, categoryAgg] = await Promise.all([
    prisma.portfolio.findMany({
      where,
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      skip:    (safePage - 1) * safeLimit,
      take:    safeLimit,
    }),
    prisma.portfolio.count({ where }),
    // Distinct categories (for filter chips on PortfolioPage)
    prisma.portfolio.groupBy({
      by:      ["category"],
      where:   { status: "published" },
      _count:  { _all: true },
      orderBy: { category: "asc" },
    }).catch(() => []),
  ])

  return {
    items:      pickLocaleMany(items, locale).map((r) => serializePortfolio(r, locale)),
    pagination: {
      page:       safePage,
      limit:      safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
    categories: categoryAgg.map((c) => ({ name: c.category, count: c._count._all })),
  }
}

async function getPortfolioBySlug(slug, locale = "en") {
  const row = await prisma.portfolio.findFirst({
    where: { slug, status: "published" },
  })
  if (!row) return null
  return serializePortfolio(pickLocale(row, locale), locale)
}

async function getFeaturedPortfolio(limit = 6) {
  const items = await prisma.portfolio.findMany({
    where:   { status: "published", isFeatured: true },
    orderBy: [{ displayOrder: "asc" }, { updatedAt: "desc" }],
    take:    Math.min(24, Math.max(1, Number(limit) || 6)),
  })
  return items.map(serializePortfolio)
}

async function getRelatedPortfolio(currentId, category, limit = 3, locale = "en") {
  const items = await prisma.portfolio.findMany({
    where: {
      status: "published",
      id:     { not: currentId },
      ...(category ? { category } : {}),
    },
    orderBy: [{ isFeatured: "desc" }, { displayOrder: "asc" }],
    take:    Math.min(12, Math.max(1, Number(limit) || 3)),
  })
  return pickLocaleMany(items, locale).map((r) => serializePortfolio(r, locale))
}

/**
 * Previous / next published project in display order (wraps around so a
 * reader can always keep browsing). Returns lightweight summaries.
 */
async function getAdjacentPortfolio(currentId, locale = "en") {
  const rows = await prisma.portfolio.findMany({
    where:   { status: "published" },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    select:  { id: true, slug: true, title: true, titleEs: true, coverImage: true, category: true },
  })
  const idx = rows.findIndex((r) => r.id === currentId)
  if (idx === -1 || rows.length < 2) return { prev: null, next: null }
  const pick = (r) => {
    const l = pickLocale(r, locale)
    return { id: l.id, slug: l.slug, title: l.title, coverImage: l.coverImage || null, category: l.category }
  }
  return {
    prev: pick(rows[(idx - 1 + rows.length) % rows.length]),
    next: pick(rows[(idx + 1) % rows.length]),
  }
}

module.exports = {
  listPortfolio,
  getPortfolioBySlug,
  getFeaturedPortfolio,
  getRelatedPortfolio,
  getAdjacentPortfolio,
  serializePortfolio,
  // case-study helpers (shared with adminPortfolioService, seed, tests)
  SERVICE_SLUGS,
  normalizeCaseStudy,
  splitResults,
  composeResults,
  localizeCaseStudy,
  outcomeLine,
}
