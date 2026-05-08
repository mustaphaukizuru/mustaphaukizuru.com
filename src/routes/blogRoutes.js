/* ════════════════════════════════════════════════════════════════════════
   blogRoutes.js · /api/v1/blog · public read-only
   ════════════════════════════════════════════════════════════════════════ */

const express = require("express")
const c = require("../controllers/blogController")

const router = express.Router()

router.get("/",         c.listPosts)
router.get("/meta",     c.getMeta)         // categories · top tags · archive
router.get("/:slug",    c.getPostBySlug)

module.exports = router
