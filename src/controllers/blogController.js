/**
 * blogController.js · public read-only HTTP controllers for /api/v1/blog.
 */

const blogService = require("../services/blogService")

async function listPosts(req, res, next) {
  try {
    const { category, tag, q, limit, offset } = req.query
    const data = await blogService.listPublicPosts({
      category, tag, q,
      limit:  Number.parseInt(limit  || "50", 10),
      offset: Number.parseInt(offset || "0",  10),
    })
    res.json(data)
  } catch (err) { next(err) }
}

async function getPostBySlug(req, res, next) {
  try {
    const post = await blogService.getPublicPostBySlug(req.params.slug)
    if (!post) return res.status(404).json({ error: "Post not found" })
    res.json({ post })
  } catch (err) { next(err) }
}

async function getMeta(req, res, next) {
  try {
    const [categories, tags, archive] = await Promise.all([
      blogService.listCategoriesWithCounts(),
      blogService.listTopTags(14),
      blogService.listArchive(),
    ])
    res.json({ categories, tags, archive })
  } catch (err) { next(err) }
}

module.exports = { listPosts, getPostBySlug, getMeta }
