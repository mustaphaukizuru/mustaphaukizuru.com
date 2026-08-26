const asyncHandler = require("../utils/asyncHandler")
const portfolioService = require("../services/portfolioService")

const { resolveUserLocale } = require("../utils/resolveUserLocale")
/**
 * GET /api/portfolio  — ?category=&service=&isFeatured=&page=&limit=
 *   `service` = one of the four service-category slugs (case-study filter)
 */
const list = asyncHandler(async (req, res) => {
  const { category, service, isFeatured, page, limit } = req.query
  const result = await portfolioService.listPortfolio({
      locale: resolveUserLocale({ req }),
    category,
    service,
    isFeatured,
    page:  page  ? Number(page)  : 1,
    limit: limit ? Number(limit) : 24,
  })
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=120")
  res.json({
    success:    true,
    data:       result.items,
    pagination: result.pagination,
    categories: result.categories,
  })
})

/**
 * GET /api/portfolio/featured
 */
const featured = asyncHandler(async (req, res) => {
  const { limit } = req.query
  const items = await portfolioService.getFeaturedPortfolio(limit ? Number(limit) : 6, resolveUserLocale({ req }))
  res.set("Cache-Control", "public, max-age=120, stale-while-revalidate=240")
  res.json({ success: true, data: items })
})

/**
 * GET /api/portfolio/:slug  — includes related[] (up to 3)
 */
const getOne = asyncHandler(async (req, res) => {
  const locale = resolveUserLocale({ req })
  const item = await portfolioService.getPortfolioBySlug(req.params.slug, locale)
  if (!item) {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Portfolio item not found" })
  }
  const [related, adjacent] = await Promise.all([
    portfolioService.getRelatedPortfolio(item.id, item.category, 3, locale),
    portfolioService.getAdjacentPortfolio(item.id, locale),
  ])
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=120")
  res.json({
    success: true,
    data:    { ...item, related, prev: adjacent.prev, next: adjacent.next },
  })
})

module.exports = { list, featured, getOne }
