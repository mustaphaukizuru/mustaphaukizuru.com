const express = require("express")
const { protect, adminOnly } = require("../middleware/authMiddleware")
const c = require("../controllers/adminEmailLogController")

const router = express.Router()
router.use(protect, adminOnly)

router.get("/stats", c.stats)
router.get("/",      c.list)

module.exports = router
