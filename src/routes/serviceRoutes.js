const express = require("express")
const { protect, attachUserIfPresent } = require("../middleware/authMiddleware")
const c  = require("../controllers/serviceController")
const rc = require("../controllers/reviewController")

const router = express.Router()

/**
 * Route order matters — fixed paths first, wildcards last.
 *
 *   GET  /featured            → before /:slug
 *   GET  /audience-plans      → public Choose-Your-Plan matrix (DB-backed)
 *   GET  /                    → list
 *   POST /order-by-tier       → guest-friendly Choose-Plan checkout (before /:slug)
 *   POST /:slug/order         → auth-protected detail-page order creation
 *   GET  /:slug               → detail (wildcard, last)
 */

router.get("/featured",        c.getFeatured)
router.get("/audience-plans",  c.getAudiencePlans)
router.get("/",                c.listServices)
router.post("/order-by-tier",  attachUserIfPresent, c.orderByTier)

// Reviews — specific paths declared BEFORE /:slug to avoid wildcard capture.
router.get("/:slug/reviews",                       rc.listServiceReviews)
router.post("/:slug/reviews",             protect, rc.addServiceReview)
router.delete("/:slug/reviews/:reviewId", protect, rc.removeReview)

router.post("/:slug/order",    protect, c.orderService)
router.get("/:slug",           c.getService)

module.exports = router
