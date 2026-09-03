const express = require("express")
const { protect } = require("../middleware/authMiddleware")
const {
  getProfile,
  updateProfile,
  uploadAvatar,
  deleteAvatar,
  changePassword,
  setPassword,
  exportMyData,
  deleteMyAccount,
} = require("../controllers/profileController")
const { uploadAvatar: multerAvatar, verifyAvatarSignature } = require("../middleware/uploadAvatar")
const { profileDataRateLimiter, uploadRateLimiter } = require("../middleware/rateLimiter")
const router = express.Router()
router.get   ("/",                protect, getProfile)
router.patch ("/",                protect, updateProfile)
// Avatar uploads: 20 / hour / user (same limiter as admin media), allowlisted
// type + extension in the multer filter, then the bytes are checked against
// the format signature before the URL is stored.
router.post  ("/avatar",          protect, uploadRateLimiter, multerAvatar, verifyAvatarSignature, uploadAvatar)
router.delete("/avatar",          protect, deleteAvatar)
router.patch ("/password",        protect, changePassword)
// Account-linking endpoint — Google-only users (no passwordHash yet) call
// this to add a fallback email/password credential. See controller for
// idempotency rules and security rationale.
router.post  ("/set-password",    protect, setPassword)
// ARCO self-service (LFPDPPP) — Access = export, Cancellation = delete.
// Both are throttled per user: 3/hour is plenty for a human and starves a
// script that wants to scrape a stolen session's data or spam deletions.
router.get   ("/export",          protect, profileDataRateLimiter, exportMyData)
router.delete("/",                protect, profileDataRateLimiter, deleteMyAccount)
module.exports = router
