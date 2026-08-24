const prisma = require("../lib/prisma")
const { pickLocale, pickLocaleMany } = require("../utils/pickLocale")
const formatBytes = require("../utils/formatBytes")

/* ────────────────────────────────────────────────────────────────────────────
 * Constants
 * ──────────────────────────────────────────────────────────────────────────── */

const SORT_OPTIONS = Object.freeze(["newest", "popular", "price-asc", "price-desc"])

// Cap on search candidates pulled before JS-side relevance scoring — keeps
// query time bounded as the catalog grows.
const SEARCH_CANDIDATE_CAP = 200

/* ────────────────────────────────────────────────────────────────────────────
 * Internal helpers
 * ──────────────────────────────────────────────────────────────────────────── */

function safeNum(val, fallback = 0) {
  const n = Number(val)
  return Number.isFinite(n) ? n : fallback
}

function normalizeBoolean(value) {
  return value === true || value === "true"
}

function formatPrice(price, currency) {
  const ccy = (currency || "MXN").toUpperCase()
  const n = safeNum(price)
  let body
  try {
    body = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: ccy,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n)
  } catch {
    body = `$${n.toFixed(2)}`
  }
  return `${body} ${ccy}`
}

/* ────────────────────────────────────────────────────────────────────────────
 * serializeProduct — preserved from the original module.
 *
 * Returns the shape consumed by the existing frontend normalizeProduct().
 * Used by getAllProducts + getProductBySlug + search + related + featured.
 * ──────────────────────────────────────────────────────────────────────────── */

function serializeProduct(product) {
  if (!product) return null

  const images = Array.isArray(product.images)
    ? [...product.images]
        .sort((a, b) => safeNum(a.sortOrder) - safeNum(b.sortOrder))
        .map((img) => ({
          id:        img.id,
          url:       img.url || "",
          altText:   img.altText || "",
          imageRole: img.imageRole || "preview",
          isPrimary: Boolean(img.isPrimary),
          sortOrder: safeNum(img.sortOrder),
        }))
    : []

  const features = Array.isArray(product.features)
    ? product.features.map((f) => ({
        id:          f.id,
        featureText: f.featureText || f.label || f.title || "",
        sortOrder:   safeNum(f.sortOrder),
      }))
    : []

  const files = Array.isArray(product.files)
    ? product.files.map((f) => ({
        id:                f.id,
        fileName:          f.fileName || f.name || "",
        fileType:          f.fileType || "",
        fileSize:          f.fileSize != null ? safeNum(f.fileSize) : null,
        fileSizeFormatted: f.fileSize != null ? formatBytes(f.fileSize) : null,
        isPrimary:         Boolean(f.isPrimary),
        version:           f.version || null,
      }))
    : []

  const reviews = Array.isArray(product.reviews)
    ? product.reviews.map((r) => ({
        id:                 r.id,
        rating:             r.rating,
        reviewText:         r.reviewText || "",
        isVerifiedPurchase: Boolean(r.isVerifiedPurchase),
        createdAt:          r.createdAt,
        user: {
          id:       r.user?.id,
          fullName: r.user?.fullName || "Anonymous",
        },
      }))
    : []

  const primaryFile = files.find((f) => f.isPrimary) || files[0] || null

  // Full category object when categoryRef is included, fallback to legacy string.
  const categoryObject = product.categoryRef
    ? {
        id:   product.categoryRef.id,
        name: product.categoryRef.name,
        slug: product.categoryRef.slug,
      }
    : null

  const tags = Array.isArray(product.tags)
    ? product.tags
        .map((t) => t.tag)
        .filter(Boolean)
        .map((t) => ({ id: t.id, name: t.name, slug: t.slug }))
    : []

  return {
    ...product,
    price:          safeNum(product.price),
    priceFormatted: formatPrice(product.price, product.currency),
    fileSize:       product.fileSize != null ? safeNum(product.fileSize) : null,
    currency:       product.currency || "MXN",
    images,
    features,
    files,
    reviews,
    tags,
    categoryRef:    categoryObject,
    fileType:       primaryFile?.fileType || product.fileType || null,
    deliveryType:   product.deliveryType || (product.productType === "service" ? "Scheduled service" : "Instant access"),
    /* F04 · I — Etsy-style key/value highlights. Stored as MySQL JSON.
     * Returned as parsed array of { key, value } pairs (or empty array). */
    specifications: parseJsonField(product.specifications, []),
    /* F04 · K — Product FAQs. Stored as MySQL JSON.
     * Returned as parsed array of { question, answer } pairs (or empty array). */
    productFaqs:    parseJsonField(product.productFaqs, []),
  }
}

/* Parse a Prisma Json field safely. MySQL Json columns return either:
 *   - already-parsed JS values (object/array) on most drivers
 *   - a JSON string on some configurations
 *   - null when the row's column is NULL
 * This helper handles all three plus malformed JSON, returning the fallback. */
function parseJsonField(value, fallback = null) {
  if (value == null) return fallback
  if (typeof value === "object") return value
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return parsed ?? fallback
    } catch {
      return fallback
    }
  }
  return fallback
}

/* ────────────────────────────────────────────────────────────────────────────
 * getAllProducts — preserved contract.
 * Accepts either a category string OR a filters object:
 *   { category, featured, new, search, page, limit }
 * ──────────────────────────────────────────────────────────────────────────── */

async function getAllProducts(filters = {}) {
  const where = { isActive: true, deletedAt: null }

  const categoryFilter = typeof filters === "string" ? filters : (filters.category || "")
  if (categoryFilter) where.category = categoryFilter

  if (typeof filters === "object") {
    if (normalizeBoolean(filters.featured)) where.isFeatured = true
    if (normalizeBoolean(filters.new))      where.isNew      = true

    if (filters.search?.trim()) {
      const q = filters.search.trim()
      // MySQL: no `mode: "insensitive"` — use contains without mode
      where.OR = [
        { title:            { contains: q } },
        { description:      { contains: q } },
        { shortDescription: { contains: q } },
        { category:         { contains: q } },
      ]
    }
  }

  const take = typeof filters === "object" && Number.isFinite(Number(filters.limit))
    ? Math.min(200, Math.max(1, Number(filters.limit)))
    : 200

  const products = await prisma.product.findMany({
    where,
    include: {
      images:      { orderBy: { sortOrder: "asc" }, take: 3 },
      features:    { orderBy: { sortOrder: "asc" }, take: 5 },
      files:       { orderBy: { isPrimary: "desc" }, select: { id: true, fileName: true, fileType: true, fileSize: true, isPrimary: true, version: true } },
      categoryRef: { select: { id: true, name: true, slug: true } },
    },
    orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    take,
  })

  // I18N06 · per-field Spanish overlay when locale === "es"; falls back
  // to English transparently when titleEs etc. are null.
  const locale = (typeof filters === "object" && filters.locale) ? filters.locale : "en"
  const localized = pickLocaleMany(products, locale)
  return localized.map(serializeProduct)
}

/* ────────────────────────────────────────────────────────────────────────────
 * getProductBySlug — preserved contract + B02 enrichment.
 *
 * Returns the full detail shape needed by ProductDetail.jsx (F04):
 *   - every image / file / feature / tag relation
 *   - reviews list + count + aggregateRating + ratingDistribution
 *   - downloadCount (lifetime SUM across UserDownloads)
 *   - relatedCount (siblings in the same category)
 * ──────────────────────────────────────────────────────────────────────────── */

async function getProductBySlug(slug, locale = "en") {
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true, deletedAt: null },
    include: {
      images:      { orderBy: { sortOrder: "asc" } },
      features:    { orderBy: { sortOrder: "asc" } },
      files:       { orderBy: { isPrimary: "desc" } },
      categoryRef: { select: { id: true, name: true, slug: true } },
      tags:        { include: { tag: { select: { id: true, name: true, slug: true } } } },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          user: { select: { id: true, fullName: true } },
        },
      },
    },
  })

  if (!product) return null

  // I18N06 · overlay Spanish fields where present (per-field EN fallback).
  const localizedProduct = pickLocale(product, locale)

  // Parallel aggregates — independent queries.
  const [downloadAgg, reviewsAgg, reviewDist, relatedCount] = await Promise.all([
    prisma.userDownload.aggregate({
      where: { productId: product.id },
      _sum: { downloadCount: true },
    }),
    // Prisma model is `Review`, exposed on the client as `prisma.review`.
    // Earlier code called `prisma.productReview` which is undefined and
    // crashes the controller with "Cannot read properties of undefined
    // (reading 'aggregate')". Aligned with the schema name now.
    prisma.review.aggregate({
      where: { productId: product.id },
      _count: { _all: true },
      _avg: { rating: true },
    }),
    prisma.review.groupBy({
      by: ["rating"],
      where: { productId: product.id },
      _count: { rating: true },
    }),
    // Count siblings — use legacy `category` string (what existing data uses).
    product.category
      ? prisma.product.count({
          where: {
            category: product.category,
            isActive: true,
            deletedAt: null,
            id:       { not: product.id },
          },
        })
      : Promise.resolve(0),
  ])

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  reviewDist.forEach((row) => {
    if (row.rating >= 1 && row.rating <= 5) distribution[row.rating] = row._count.rating
  })

  const serialized = serializeProduct(localizedProduct)

  serialized.downloadCount = downloadAgg._sum.downloadCount || 0
  serialized.relatedCount  = relatedCount
  serialized.reviewStats   = {
    count:              reviewsAgg._count._all,
    aggregateRating:    reviewsAgg._avg.rating ? Number(reviewsAgg._avg.rating.toFixed(2)) : 0,
    ratingDistribution: distribution,
  }

  return serialized
}

/* ────────────────────────────────────────────────────────────────────────────
 * getCategories — preserved. Returns distinct category string labels.
 * ──────────────────────────────────────────────────────────────────────────── */

async function getCategories() {
  const rows = await prisma.product.findMany({
    where:    { isActive: true, deletedAt: null, category: { not: null } },
    select:   { category: true },
    distinct: ["category"],
    orderBy:  { category: "asc" },
  })
  return rows.map((r) => r.category).filter(Boolean)
}

/* ────────────────────────────────────────────────────────────────────────────
 * B02 · Related products
 *
 * Four products from the same category (legacy string field), excluding the
 * current product. Ordered by rating DESC, then reviewCount DESC.
 * Published + active only. Empty array if the product has no category.
 * ──────────────────────────────────────────────────────────────────────────── */

async function getRelatedProducts(slug) {
  const current = await prisma.product.findFirst({
    where:  { slug, deletedAt: null },
    select: { id: true, category: true },
  })
  if (!current || !current.category) return []

  const items = await prisma.product.findMany({
    where: {
      category: current.category,
      isActive: true,
      deletedAt: null,
      id:       { not: current.id },
    },
    include: {
      images:      { orderBy: { sortOrder: "asc" }, take: 1 },
      features:    { orderBy: { sortOrder: "asc" }, take: 3 },
      files:       { orderBy: { isPrimary: "desc" }, take: 1, select: { id: true, fileName: true, fileType: true, fileSize: true, isPrimary: true, version: true } },
      categoryRef: { select: { id: true, name: true, slug: true } },
    },
    orderBy: [{ rating: "desc" }, { reviewCount: "desc" }, { publishedAt: "desc" }],
    take: 4,
  })

  return items.map(serializeProduct)
}

/* ────────────────────────────────────────────────────────────────────────────
 * B02 · Featured row
 *
 * Up to 8 products where isFeatured=true. publishedAt DESC.
 * ──────────────────────────────────────────────────────────────────────────── */

async function getFeaturedProducts() {
  const items = await prisma.product.findMany({
    where:   { isFeatured: true, isActive: true, deletedAt: null },
    include: {
      images:      { orderBy: { sortOrder: "asc" }, take: 1 },
      features:    { orderBy: { sortOrder: "asc" }, take: 3 },
      files:       { orderBy: { isPrimary: "desc" }, take: 1, select: { id: true, fileName: true, fileType: true, fileSize: true, isPrimary: true, version: true } },
      categoryRef: { select: { id: true, name: true, slug: true } },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 8,
  })
  return items.map(serializeProduct)
}

/* ────────────────────────────────────────────────────────────────────────────
 * B02 · Search
 *
 * Relevance-scored LIKE search across title · shortDescription · tag names ·
 * category name. Scores in JS:  title 3 · description 2 · tag 1 · category 1.
 * Hard cap of SEARCH_CANDIDATE_CAP before scoring keeps the query bounded.
 * ──────────────────────────────────────────────────────────────────────────── */

async function searchProducts(q, { page = 1, limit = 24 } = {}) {
  const trimmed = (q || "").trim()
  if (!trimmed) {
    return { items: [], pagination: buildPagination(1, limit, 0), query: "" }
  }

  const safePage  = Math.max(1, Number(page) || 1)
  const safeLimit = Math.min(48, Math.max(1, Number(limit) || 24))

  const candidates = await prisma.product.findMany({
    where: {
      AND: [
        { isActive: true },
        { deletedAt: null },
        {
          OR: [
            { title:            { contains: trimmed } },
            { shortDescription: { contains: trimmed } },
            { category:         { contains: trimmed } },
            { tags:             { some: { tag: { name: { contains: trimmed } } } } },
            { categoryRef:      { name: { contains: trimmed } } },
          ],
        },
      ],
    },
    include: {
      images:      { orderBy: { sortOrder: "asc" }, take: 1 },
      features:    { orderBy: { sortOrder: "asc" }, take: 3 },
      files:       { orderBy: { isPrimary: "desc" }, take: 1, select: { id: true, fileName: true, fileType: true, fileSize: true, isPrimary: true, version: true } },
      categoryRef: { select: { id: true, name: true, slug: true } },
      tags:        { include: { tag: { select: { id: true, name: true, slug: true } } } },
    },
    take: SEARCH_CANDIDATE_CAP,
  })

  const needle = trimmed.toLowerCase()
  const scored = candidates.map((p) => {
    let score = 0
    if (p.title?.toLowerCase().includes(needle))            score += 3
    if (p.shortDescription?.toLowerCase().includes(needle)) score += 2
    if (p.tags?.some((tm) => tm.tag?.name?.toLowerCase().includes(needle))) score += 1
    if (p.category?.toLowerCase().includes(needle))         score += 1
    if (p.categoryRef?.name?.toLowerCase().includes(needle)) score += 1
    return { p, score }
  })

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if ((b.p.rating || 0) !== (a.p.rating || 0)) return (b.p.rating || 0) - (a.p.rating || 0)
    return (b.p.reviewCount || 0) - (a.p.reviewCount || 0)
  })

  const total = scored.length
  const sliceStart = (safePage - 1) * safeLimit
  const pageItems = scored
    .slice(sliceStart, sliceStart + safeLimit)
    .map((s) => serializeProduct(s.p))

  return {
    items:      pageItems,
    pagination: buildPagination(safePage, safeLimit, total),
    query:      trimmed,
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * B02 · Products by category (slug-based)
 *
 * Two-tier category lookup: first tries ProductCategory table via slug; if
 * nothing is found there (catalog still uses legacy string `category` column
 * only), falls back to matching the legacy column against a slug-derived name.
 * ──────────────────────────────────────────────────────────────────────────── */

async function getProductsByCategory(categorySlug, opts = {}) {
  const { page = 1, limit = 12, sort = "newest", tag } = opts

  const safePage  = Math.max(1, Number(page) || 1)
  const safeLimit = Math.min(48, Math.max(1, Number(limit) || 12))
  const safeSort  = SORT_OPTIONS.includes(sort) ? sort : "newest"

  // 1 · Try ProductCategory (new relational path).
  let category = await prisma.productCategory.findUnique({
    where:  { slug: categorySlug },
    select: { id: true, name: true, slug: true, description: true, isActive: true },
  })

  let where = { isActive: true, deletedAt: null }

  if (category && category.isActive) {
    where.categoryId = category.id
  } else {
    // 2 · Fallback to legacy string column. Slug → candidate names.
    //     e.g. "digital-toolkits" → "digital toolkits", "Digital Toolkits", "Digital & Toolkits"
    const candidates = buildCategoryCandidates(categorySlug)
    const match = await prisma.product.findFirst({
      where:  { isActive: true, deletedAt: null, OR: candidates.map((name) => ({ category: { contains: name } })) },
      select: { category: true },
    })
    if (!match || !match.category) return null
    where.category = match.category
    category = { id: null, name: match.category, slug: categorySlug, description: null, isActive: true }
  }

  if (tag) where.tags = { some: { tag: { slug: tag } } }

  const orderBy = resolveOrderBy(safeSort)

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
      include: {
        images:      { orderBy: { sortOrder: "asc" }, take: 1 },
        features:    { orderBy: { sortOrder: "asc" }, take: 3 },
        files:       { orderBy: { isPrimary: "desc" }, take: 1, select: { id: true, fileName: true, fileType: true, fileSize: true, isPrimary: true, version: true } },
        categoryRef: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.product.count({ where }),
  ])

  return {
    category,
    items:      items.map(serializeProduct),
    pagination: buildPagination(safePage, safeLimit, total),
    sort:       safeSort,
    tag:        tag || null,
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Internal helpers for pagination + sort + category fallback
 * ──────────────────────────────────────────────────────────────────────────── */

function buildPagination(page, limit, total) {
  const totalPages = Math.max(1, Math.ceil(total / limit))
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  }
}

function resolveOrderBy(sort) {
  switch (sort) {
    case "popular":
      return [{ rating: "desc" }, { reviewCount: "desc" }, { publishedAt: "desc" }]
    case "price-asc":
      return [{ price: "asc" }, { publishedAt: "desc" }]
    case "price-desc":
      return [{ price: "desc" }, { publishedAt: "desc" }]
    case "newest":
    default:
      return [{ publishedAt: "desc" }, { createdAt: "desc" }]
  }
}

function buildCategoryCandidates(slug) {
  const space    = slug.replace(/-/g, " ")
  const title    = space.replace(/\b\w/g, (c) => c.toUpperCase())
  const ampersand = title.replace(/\bAnd\b/gi, "&")
  // De-duplicate while preserving order
  return [...new Set([title, space, ampersand, slug])]
}

/* ────────────────────────────────────────────────────────────────────────────
 * Exports
 * ──────────────────────────────────────────────────────────────────────────── */

module.exports = {
  // Preserved contract
  getAllProducts,
  getProductBySlug,
  getCategories,
  // B02 additions
  getRelatedProducts,
  getFeaturedProducts,
  searchProducts,
  getProductsByCategory,
  // Constants (used by controller validation)
  SORT_OPTIONS,
}
