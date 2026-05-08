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

// B10 · per-endpoint rate limits
const {
  loginRateLimiter,
  signupRateLimiter,
  forgotPasswordRateLimiter,
} = require("../middleware/rateLimiter");

const twoFactorRoutes = require("./twoFactorRoutes");      // B09

const router = express.Router();

// B10 · stricter, per-endpoint limits replace the previous generic authRateLimiter:
//   signup           → 3 / 1 hour / IP
//   login            → 5 / 15 min / (IP + email)
//   forgot-password  → 3 / 1 hour / email
router.post("/signup",                signupRateLimiter,         signup);
router.post("/login",                 loginRateLimiter,          login);
router.post("/google",                                            googleLogin);
router.post("/forgot-password",       forgotPasswordRateLimiter, forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.get ("/me",                    protect, me);

// B09 · two-factor auth subroutes (status, setup, verify, disable,
// regenerate, login-verify). See twoFactorRoutes.js for full table.
router.use("/2fa", twoFactorRoutes);

module.exports = router;
