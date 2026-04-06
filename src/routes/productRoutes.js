const express = require("express")
const router  = express.Router()
const c       = require("../controllers/productController")
const rc      = require("../controllers/reviewController")
const { protect } = require("../middleware/authMiddleware")

// IMPORTANT: specific routes MUST come before param routes
router.get("/categories", c.listCategories)   // must be before /:slug
router.get("/",           c.listProducts)      // moved before /:slug to prevent param catch

// Reviews (must come before /:slug catch-all)
router.get("/:slug/reviews",  rc.listProductReviews)
router.post("/:slug/reviews", protect, rc.addProductReview)
router.delete("/:slug/reviews/:reviewId", protect, rc.removeProductReview)

router.get("/:slug",      c.getProduct)        // catch-all slug last

module.exports = router
