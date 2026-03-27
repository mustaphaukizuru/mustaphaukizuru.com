const express = require("express")
const { listAdminDownloads } = require("../controllers/adminDownloadController")
const { protect, adminOnly } = require("../middleware/authMiddleware")

const router = express.Router()

router.get("/", protect, adminOnly, listAdminDownloads)

module.exports = router