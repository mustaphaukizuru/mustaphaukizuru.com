const productService        = require("../services/productService")
const asyncHandler          = require("../utils/asyncHandler")
const { resolveUserLocale } = require("../utils/resolveUserLocale")

// Phase 9.2d · refactored to asyncHandler. The pre-refactor code wrapped
// every handler in a try { ... } catch (error) { next(error) } boilerplate
// — correct but verbose. asyncHandler does the same thing implicitly via
// Promise.resolve(fn).catch(next), so the catch blocks all came off.

/* ────────────────────────────────────────────────────────────────────────────
 * Query-parsing helpers — return { value, error }
 * ──────────────────────────────────────────────────────────────────────────── */

function parseInteger(raw, { min, max, defaultValue, name }) {
  if (raw === undefined || raw === "") return { value: defaultValue }
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n)) return { error: `'${name}' must be an integer` }
  if (min !== undefined && n < min) return { error: `'${name}' must be >= ${min}` }
  if (max !== undefined && n > max) return { error: `'${name}' must be <= ${max}` }
  return { value: n }
}

function parseEnum(raw, { allowed, defaultValue, name }) {
  if (raw === undefined || raw === "") return { value: defaultValue }
  if (!allowed.includes(raw)) {
    return { error: `'${name}' must be one of: ${allowed.join(", ")}` }
  }
  return { value: raw }
}

function parseQueryString(raw, { min = 1, max = 100, name }) {
  if (typeof raw !== "string") return { error: `'${name}' is required` }
  const trimmed = raw.trim()
  if (trimmed.length < min) return { error: `'${name}' must be at least ${min} character(s)` }
  if (trimmed.length > max) return { error: `'${name}' must be at most ${max} characters` }
  return { value: trimmed }
}

function badRequest(res, message) {
  return res.status(400).json({ message })
}

function notFound(res, message = "Not found") {
  return res.status(404).json({ message })
}

/* ────────────────────────────────────────────────────────────────────────────
 * Handlers
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * GET /api/products — public catalog list.
 * Accepts legacy query params: category · featured · new · search · limit
 */
const listProducts = asyncHandler(async (req, res) => {
  const products = await productService.getAllProducts({
    locale:   resolveUserLocale({ req }),
    category: req.query.category || "",
    featured: req.query.featured || "",
    new:      req.query.new || "",
    search:   req.query.search || "",
    limit:    req.query.limit,
  })

  // Cache public listings for 30s + stale-while-revalidate on non-search.
  if (!req.query.search) {
    res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60")
  }
  res.json({ data: products })
})

/**
 * GET /api/products/:slug — enriched single product (F04).
 */
const getProduct = asyncHandler(async (req, res) => {
  const product = await productService.getProductBySlug(req.params.slug, resolveUserLocale({ req }))
  if (!product) return notFound(res, "Product not found")
  res.json({ data: product })
})

/**
 * GET /api/products/categories — distinct category string labels.
 */
const listCategories = asyncHandler(async (_req, res) => {
  const categories = await productService.getCategories()
  res.json({ data: categories })
})

/* ────────────────────────────────────────────────────────────────────────────
 * Handlers — B02 additions
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * GET /api/products/featured — up to 8 featured products for the Home row.
 */
const getFeatured = asyncHandler(async (_req, res) => {
  const items = await productService.getFeaturedProducts()
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=120")
  res.json({ data: items })
})

/**
 * GET /api/products/search?q=…&page=&limit= — relevance-scored search.
 */
const searchProducts = asyncHandler(async (req, res) => {
  const qParsed = parseQueryString(req.query.q, { min: 1, max: 100, name: "q" })
  if (qParsed.error) return badRequest(res, qParsed.error)

  const pageParsed = parseInteger(req.query.page, { min: 1, defaultValue: 1, name: "page" })
  if (pageParsed.error) return badRequest(res, pageParsed.error)

  const limitParsed = parseInteger(req.query.limit, { min: 1, max: 48, defaultValue: 24, name: "limit" })
  if (limitParsed.error) return badRequest(res, limitParsed.error)

  const result = await productService.searchProducts(qParsed.value, {
    page:  pageParsed.value,
    limit: limitParsed.value,
  })

  res.json({
    data:       result.items,
    pagination: result.pagination,
    query:      result.query,
  })
})

/**
 * GET /api/products/categories/:categorySlug?sort=&page=&limit=&tag=
 * Category-filtered catalog with sort + pagination.
 */
const getByCategory = asyncHandler(async (req, res) => {
  const pageParsed = parseInteger(req.query.page, { min: 1, defaultValue: 1, name: "page" })
  if (pageParsed.error) return badRequest(res, pageParsed.error)

  const limitParsed = parseInteger(req.query.limit, { min: 1, max: 48, defaultValue: 12, name: "limit" })
  if (limitParsed.error) return badRequest(res, limitParsed.error)

  const sortParsed = parseEnum(req.query.sort, {
    allowed:      productService.SORT_OPTIONS,
    defaultValue: "newest",
    name:         "sort",
  })
  if (sortParsed.error) return badRequest(res, sortParsed.error)

  const result = await productService.getProductsByCategory(req.params.categorySlug, {
    page:  pageParsed.value,
    limit: limitParsed.value,
    sort:  sortParsed.value,
    tag:   req.query.tag || undefined,
  })

  if (!result) return notFound(res, "Category not found")

  res.json({
    data:       result.items,
    category:   result.category,
    pagination: result.pagination,
    sort:       result.sort,
    tag:        result.tag,
  })
})

/**
 * GET /api/products/:slug/related — 4 products from same category.
 */
const getRelated = asyncHandler(async (req, res) => {
  const items = await productService.getRelatedProducts(req.params.slug)
  res.json({ data: items })
})

/* ────────────────────────────────────────────────────────────────────────────
 * Exports
 * ──────────────────────────────────────────────────────────────────────────── */

module.exports = {
  listProducts,
  getProduct,
  listCategories,
  // B02 additions
  getFeatured,
  searchProducts,
  getByCategory,
  getRelated,
}
