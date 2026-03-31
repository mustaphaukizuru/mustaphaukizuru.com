const express = require("express")
const router  = express.Router()
const c       = require("../controllers/productController")

// IMPORTANT: specific routes MUST come before param routes
router.get("/categories", c.listCategories)   // must be before /:slug
router.get("/",           c.listProducts)      // moved before /:slug to prevent param catch
router.get("/:slug",      c.getProduct)        // catch-all slug last

module.exports = router
