const asyncHandler = require("../utils/asyncHandler")
const portfolioService = require("../services/portfolioService")

const { resolveUserLocale } = require("../utils/resolveUserLocale")
/**
 * GET /api/portfolio  — ?category=&isFeatured=&page=&limit=
 */
const list = asyncHandler(async (req, res) => {
  const { category, isFeatured, page, limit } = req.query
  const result = await portfolioService.listPortfolio({
      locale: resolveUserLocale({ req }),
    category,
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
  const items = await portfolioService.getFeaturedPortfolio(limit ? Number(limit) : 6)
  res.set("Cache-Control", "public, max-age=120, stale-while-revalidate=240")
  res.json({ success: true, data: items })
})

/**
 * GET /api/portfolio/:slug  — includes related[] (up to 3)
 */
const getOne = asyncHandler(async (req, res) => {
  const item = await portfolioService.getPortfolioBySlug(req.params.slug, resolveUserLocale({ req }))
  if (!item) {
    return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Portfolio item not found" })
  }
  const related = await portfolioService.getRelatedPortfolio(item.id, item.category, 3)
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=120")
  res.json({
    success: true,
    data:    { ...item, related },
  })
})

module.exports = { list, featured, getOne }
