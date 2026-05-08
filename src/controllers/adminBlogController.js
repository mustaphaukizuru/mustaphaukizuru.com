/**
 * adminBlogController.js · admin CRUD HTTP controllers for /api/v1/admin/blog.
 *
 * Authentication is enforced upstream by `requireAdmin` middleware
 * (mounted on the route file). These handlers focus on input shape +
 * delegating to adminBlogService.
 */

const adminBlog = require("../services/adminBlogService")

function badRequest(res, message) {
  return res.status(400).json({ error: message })
}

/* ── Posts ────────────────────────────────────────────────────────────── */

async function listPosts(req, res, next) {
  try {
    const { status, q, limit, offset } = req.query
    const data = await adminBlog.listAllPosts({
      status, q,
      limit:  Number.parseInt(limit  || "200", 10),
      offset: Number.parseInt(offset || "0",   10),
    })
    res.json(data)
  } catch (err) { next(err) }
}

async function getPost(req, res, next) {
  try {
    const post = await adminBlog.getPostById(req.params.id)
    if (!post) return res.status(404).json({ error: "Post not found" })
    res.json({ post })
  } catch (err) { next(err) }
}

async function createPost(req, res, next) {
  try {
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
  } catch (err) { next(err) }
}

async function updatePost(req, res, next) {
  try {
    const body = req.body || {}
    if (body.body && !Array.isArray(body.body))
      return badRequest(res, "body must be an array of content blocks")

    const post = await adminBlog.updatePost(req.params.id, body)
    if (!post) return res.status(404).json({ error: "Post not found" })
    res.json({ post })
  } catch (err) { next(err) }
}

async function deletePost(req, res, next) {
  try {
    await adminBlog.deletePost(req.params.id)
    res.status(204).end()
  } catch (err) { next(err) }
}

/* ── Categories ───────────────────────────────────────────────────────── */

async function listCategories(req, res, next) {
  try {
    const cats = await adminBlog.listCategoriesAdmin()
    res.json({ categories: cats })
  } catch (err) { next(err) }
}

async function createCategory(req, res, next) {
  try {
    const { slug, label, accent, description, displayOrder } = req.body || {}
    if (!label) return badRequest(res, "label is required")
    const cat = await adminBlog.createCategory({ slug, label, accent, description, displayOrder })
    res.status(201).json({ category: cat })
  } catch (err) { next(err) }
}

async function updateCategory(req, res, next) {
  try {
    const cat = await adminBlog.updateCategory(req.params.id, req.body || {})
    res.json({ category: cat })
  } catch (err) { next(err) }
}

async function deleteCategory(req, res, next) {
  try {
    await adminBlog.deleteCategory(req.params.id)
    res.status(204).end()
  } catch (err) { next(err) }
}

/* ── Tags ─────────────────────────────────────────────────────────────── */

async function listTags(req, res, next) {
  try {
    const tags = await adminBlog.listTagsAdmin()
    res.json({ tags })
  } catch (err) { next(err) }
}

module.exports = {
  listPosts, getPost, createPost, updatePost, deletePost,
  listCategories, createCategory, updateCategory, deleteCategory,
  listTags,
}
