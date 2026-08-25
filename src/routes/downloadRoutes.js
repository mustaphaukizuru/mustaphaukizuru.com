const express = require("express")
const { protect } = require("../middleware/authMiddleware")

// B10 · use unified rateLimiter (was previously importing from
// non-existent middleware/downloadRateLimiter.js — latent crash bug fixed).
const { downloadRateLimiter } = require("../middleware/rateLimiter")

const {
  downloadProduct,
  downloadByFileId,
} = require("../controllers/downloadController")
const asyncHandler = require("../utils/asyncHandler")
const { getDownloadLibraryForUser } = require("../services/downloadService")

const router = express.Router()

/**
 *  Route order matters — specific paths BEFORE wildcards.
 *
 *  1 · /:productId/file/:fileId   legacy two-segment stream (preserved)
 *  2 · /:id                       smart dispatch:
 *        ├─ treats :id as ProductFile → B04 stream (rate-limited + audited)
 *        └─ falls back to Product → returns legacy meta JSON
 *
 *  Both routes require auth and pass through the per-user rate limiter
 *  (B10 · 10 / 1 hour / user).
 */

/**
 *  0 · /my/library — dashboard "downloads by order" view. Read-only JSON
 *      (no file bytes), so it bypasses the download rate limiter. Declared
 *      first so the "/:id" wildcard never captures it.
 */
router.get("/my/library", protect, asyncHandler(async (req, res) => {
  const data = await getDownloadLibraryForUser(req.user.id)
  return res.status(200).json({ success: true, data })
}))

router.get("/:productId/file/:fileId", protect, downloadRateLimiter, downloadProduct)
router.get("/:id",                     protect, downloadRateLimiter, downloadByFileId)

module.exports = router
