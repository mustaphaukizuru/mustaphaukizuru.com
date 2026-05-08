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

function serializePortfolio(row) {
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
    results:          safeJsonArray(row.results),
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

async function listPortfolio({ category, isFeatured, page = 1, limit = 24, locale = "en" } = {}) {
  const safePage  = Math.max(1, Number(page) || 1)
  const safeLimit = Math.min(48, Math.max(1, Number(limit) || 24))

  const where = { status: "published" }
  if (category) where.category = category
  if (isFeatured === true || isFeatured === "true") where.isFeatured = true

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
    items:      pickLocaleMany(items, locale).map(serializePortfolio),
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
  return serializePortfolio(pickLocale(row, locale))
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
  return pickLocaleMany(items, locale).map(serializePortfolio)
}

module.exports = {
  listPortfolio,
  getPortfolioBySlug,
  getFeaturedPortfolio,
  getRelatedPortfolio,
  serializePortfolio,
}
