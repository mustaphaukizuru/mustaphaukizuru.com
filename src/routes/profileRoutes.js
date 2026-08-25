const express = require("express")
const { protect } = require("../middleware/authMiddleware")
const {
  getProfile,
  updateProfile,
  uploadAvatar,
  deleteAvatar,
  changePassword,
  setPassword,
} = require("../controllers/profileController")
const { uploadAvatar: multerAvatar } = require("../middleware/uploadAvatar")
const router = express.Router()
router.get   ("/",                protect, getProfile)
router.patch ("/",                protect, updateProfile)
router.post  ("/avatar",          protect, multerAvatar, uploadAvatar)
router.delete("/avatar",          protect, deleteAvatar)
router.patch ("/password",        protect, changePassword)
// Account-linking endpoint — Google-only users (no passwordHash yet) call
// this to add a fallback email/password credential. See controller for
// idempotency rules and security rationale.
router.post  ("/set-password",    protect, setPassword)
module.exports = router
