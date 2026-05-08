const express = require("express")
const { protect, adminOnly } = require("../middleware/authMiddleware")
const { listMedia, deleteMedia, updateMedia, uploadMedia } = require("../controllers/adminMediaController")
const { uploadMedia: multerMedia } = require("../middleware/uploadAvatar")

// B10 · per-user upload throttle (20 / 1 hour / user)
const { uploadRateLimiter } = require("../middleware/rateLimiter")

const router = express.Router()

router.get   ("/",      protect, adminOnly,                            listMedia)
router.post  ("/",      protect, adminOnly, uploadRateLimiter, multerMedia, uploadMedia)   // B10
router.patch ("/:id",   protect, adminOnly,                            updateMedia)
router.delete("/:id",   protect, adminOnly,                            deleteMedia)

module.exports = router
