const express = require("express")
const c = require("../controllers/portfolioController")

const router = express.Router()

/**
 * Route order — fixed paths BEFORE the wildcard /:slug
 */
router.get("/featured", c.featured)
router.get("/",         c.list)
router.get("/:slug",    c.getOne)

module.exports = router
