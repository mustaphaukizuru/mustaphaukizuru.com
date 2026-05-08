/* ════════════════════════════════════════════════════════════════════════
   adminBlogRoutes.js · /api/v1/admin/blog · protect + adminOnly
   ────────────────────────────────────────────────────────────────────────
   Posts CRUD + categories CRUD + tags read.
   ════════════════════════════════════════════════════════════════════════ */

const express = require("express")
const c = require("../controllers/adminBlogController")
const { protect, adminOnly } = require("../middleware/authMiddleware")

const router = express.Router()
router.use(protect, adminOnly)

/* Posts */
router.get("/posts",          c.listPosts)
router.post("/posts",         c.createPost)
router.get("/posts/:id",      c.getPost)
router.patch("/posts/:id",    c.updatePost)
router.delete("/posts/:id",   c.deletePost)

/* Categories */
router.get("/categories",         c.listCategories)
router.post("/categories",        c.createCategory)
router.patch("/categories/:id",   c.updateCategory)
router.delete("/categories/:id",  c.deleteCategory)

/* Tags */
router.get("/tags",  c.listTags)

module.exports = router
