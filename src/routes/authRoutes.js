const express = require("express");
const {
  signup,
  login,
  me,
  googleLogin,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { authRateLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

router.post("/signup", authRateLimiter, signup);
router.post("/login", authRateLimiter, login);
router.post("/google", googleLogin);
router.post("/forgot-password", authRateLimiter, forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.get("/me", protect, me);

module.exports = router;