const express = require("express")
const { protect } = require("../middleware/authMiddleware")

// B10 · use unified rateLimiter (was previously importing from
// non-existent middleware/downloadRateLimiter.js — latent crash bug fixed).
const { downloadRateLimiter } = require("../middleware/rateLimiter")

const {
  downloadProduct,
  downloadByFileId,
} = require("../controllers/downloadController")

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

router.get("/:productId/file/:fileId", protect, downloadRateLimiter, downloadProduct)
router.get("/:id",                     protect, downloadRateLimiter, downloadByFileId)

module.exports = router
