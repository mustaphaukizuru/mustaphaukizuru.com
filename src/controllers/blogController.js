/**
 * blogController.js · public read-only HTTP controllers for /api/v1/blog.
 *
 * Phase 9.2d · refactored to asyncHandler. Verbose try/catch+next removed;
 * errors flow to the central errorHandler middleware unchanged.
 */

const blogService  = require("../services/blogService")
const asyncHandler = require("../utils/asyncHandler")

const PUBLIC_CACHE = "public, max-age=60, stale-while-revalidate=300"

const listPosts = asyncHandler(async (req, res) => {
  const { category, tag, q, limit, offset } = req.query
  const data = await blogService.listPublicPosts({
    category, tag, q,
    limit:  Number.parseInt(limit  || "50", 10),
    offset: Number.parseInt(offset || "0",  10),
  })
  res.set("Cache-Control", PUBLIC_CACHE)
  res.json(data)
})

const getPostBySlug = asyncHandler(async (req, res) => {
  const post = await blogService.getPublicPostBySlug(req.params.slug)
  if (!post) return res.status(404).json({ error: "Post not found" })
  res.set("Cache-Control", PUBLIC_CACHE)
  res.json({ post })
})

const getMeta = asyncHandler(async (_req, res) => {
  const [categories, tags, archive] = await Promise.all([
    blogService.listCategoriesWithCounts(),
    blogService.listTopTags(14),
    blogService.listArchive(),
  ])
  res.set("Cache-Control", PUBLIC_CACHE)
  res.json({ categories, tags, archive })
})

module.exports = { listPosts, getPostBySlug, getMeta }
