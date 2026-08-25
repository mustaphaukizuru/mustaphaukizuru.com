const express = require("express")
const { protect, adminOnly } = require("../middleware/authMiddleware")
const { uploadMedia } = require("../controllers/adminMediaController")
const { uploadMedia: multerMedia } = require("../middleware/uploadAvatar")

// B10 · per-user upload throttle (20 / 1 hour / user)
const { uploadRateLimiter } = require("../middleware/rateLimiter")

const router = express.Router()

// Generic admin upload endpoint — used by the blog editor (cover images) and
// the bio editor (avatars/logos). The media-library browsing UI was removed;
// only the upload pipeline remains.
router.post("/", protect, adminOnly, uploadRateLimiter, multerMedia, uploadMedia)

module.exports = router
