/**
 * Public product routes · mounted at /api/products in src/routes/index.js.
 *
 * ⚠️  Route order is critical.
 * Fixed-path routes (/featured, /search, /categories, /categories/:x) MUST be
 * declared BEFORE the /:slug wildcard. Express matches in order, so a /:slug
 * declared first would swallow every GET request as a slug lookup.
 *
 * Reviews (POST/DELETE/GET) stay on reviewController — preserved from the
 * original file. This keeps the protected POST/DELETE handlers intact.
 *
 * B10 · /search gets its own per-IP limiter (60/min). All other product
 * routes inherit the global API limiter (100/15min/IP) only.
 */

const express = require("express")
const router  = express.Router()
const c       = require("../controllers/productController")
const rc      = require("../controllers/reviewController")
const { protect } = require("../middleware/authMiddleware")
const { searchRateLimiter } = require("../middleware/rateLimiter")    // B10

/* ── B02 fixed-path endpoints (before /:slug) ───────────────────────────── */
router.get("/featured", c.getFeatured)
router.get("/search",   searchRateLimiter, c.searchProducts)            // B10 · 60/min/IP

/* ── Categories — list then detail (order between these two is irrelevant, */
/*    but keep /categories before /categories/:slug for clarity). ────────── */
router.get("/categories",                c.listCategories)
router.get("/categories/:categorySlug",  c.getByCategory)

/* ── List ──────────────────────────────────────────────────────────────── */
router.get("/", c.listProducts)

/* ── Reviews (specific paths, safe before /:slug) ───────────────────────── */
router.get("/:slug/reviews",              rc.listProductReviews)
router.post("/:slug/reviews",             protect, rc.addProductReview)
router.delete("/:slug/reviews/:reviewId", protect, rc.removeReview)

/* ── B02 related (specific path) ───────────────────────────────────────── */
router.get("/:slug/related", c.getRelated)

/* ── Single (wildcard — MUST be last) ──────────────────────────────────── */
router.get("/:slug", c.getProduct)

module.exports = router
