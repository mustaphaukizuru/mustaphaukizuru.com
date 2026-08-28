const express = require("express")
const c = require("../controllers/clientLogoController")

const router = express.Router()

// Public, read-only: the logo wall on /about.
router.get("/", c.listPublic)

module.exports = router
