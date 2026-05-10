/**
 * adminBlogController.js · admin CRUD HTTP controllers for /api/v1/admin/blog.
 *
 * Authentication is enforced upstream by `requireAdmin` middleware
 * (mounted on the route file). These handlers focus on input shape +
 * delegating to adminBlogService.
 *
 * Phase 9.2d · refactored to asyncHandler so the verbose
 *   try { ... } catch (err) { next(err) }
 * boilerplate is removed. Errors propagate to the central errorHandler
 * middleware exactly the same way.
 */

const adminBlog    = require("../services/adminBlogService")
const asyncHandler = require("../utils/asyncHandler")

function badRequest(res, message) {
  return res.status(400).json({ error: message })
}

/* ── Posts ────────────────────────────────────────────────────────────── */

const listPosts = asyncHandler(async (req, res) => {
  const { status, q, limit, offset } = req.query
  const data = await adminBlog.listAllPosts({
    status, q,
    limit:  Number.parseInt(limit  || "200", 10),
    offset: Number.parseInt(offset || "0",   10),
  })
  res.json(data)
})

const getPost = asyncHandler(async (req, res) => {
  const post = await adminBlog.getPostById(req.params.id)
  if (!post) return res.status(404).json({ error: "Post not found" })
  res.json({ post })
})

const createPost = asyncHandler(async (req, res) => {
  const body = req.body || {}
  if (!body.title) return badRequest(res, "title is required")
  if (!body.categoryId) return badRequest(res, "categoryId is required")
  if (body.body && !Array.isArray(body.body))
    return badRequest(res, "body must be an array of content blocks")

  const post = await adminBlog.createPost({
    ...body,
    authorUserId: body.authorUserId || req.user?.id || null,
  })
  res.status(201).json({ post })
})

const updatePost = asyncHandler(async (req, res) => {
  const body = req.body || {}
  if (body.body && !Array.isArray(body.body))
    return badRequest(res, "body must be an array of content blocks")

  const post = await adminBlog.updatePost(req.params.id, body)
  if (!post) return res.status(404).json({ error: "Post not found" })
  res.json({ post })
})

const deletePost = asyncHandler(async (req, res) => {
  await adminBlog.deletePost(req.params.id)
  res.status(204).end()
})

/* ── Categories ───────────────────────────────────────────────────────── */

const listCategories = asyncHandler(async (_req, res) => {
  const cats = await adminBlog.listCategoriesAdmin()
  res.json({ categories: cats })
})

const createCategory = asyncHandler(async (req, res) => {
  const { slug, label, accent, description, displayOrder } = req.body || {}
  if (!label) return badRequest(res, "label is required")
  const cat = await adminBlog.createCategory({ slug, label, accent, description, displayOrder })
  res.status(201).json({ category: cat })
})

const updateCategory = asyncHandler(async (req, res) => {
  const cat = await adminBlog.updateCategory(req.params.id, req.body || {})
  res.json({ category: cat })
})

const deleteCategory = asyncHandler(async (req, res) => {
  await adminBlog.deleteCategory(req.params.id)
  res.status(204).end()
})

/* ── Tags ─────────────────────────────────────────────────────────────── */

const listTags = asyncHandler(async (_req, res) => {
  const tags = await adminBlog.listTagsAdmin()
  res.json({ tags })
})

module.exports = {
  listPosts, getPost, createPost, updatePost, deletePost,
  listCategories, createCategory, updateCategory, deleteCategory,
  listTags,
}
