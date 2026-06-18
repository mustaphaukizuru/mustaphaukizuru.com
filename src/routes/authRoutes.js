const express = require("express");
const {
  signup,
  login,
  me,
  googleLogin,
  startGoogleOAuth,
  googleOAuthCallback,
  startMicrosoftOAuth,
  microsoftOAuthCallback,
  startFacebookOAuth,
  facebookOAuthCallback,
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
router.post("/google",                                            googleLogin);            // legacy One-Tap endpoint (kept for backwards compat)
router.get ("/google/start",                                      startGoogleOAuth);       // OAuth redirect flow — primary path
router.get ("/google/callback",                                   googleOAuthCallback);    // OAuth redirect flow — Google calls back here
router.get ("/microsoft/start",                                   startMicrosoftOAuth);    // Microsoft OAuth start
router.get ("/microsoft/callback",                                microsoftOAuthCallback); // Microsoft OAuth callback
router.get ("/facebook/start",                                    startFacebookOAuth);     // Facebook OAuth start
router.get ("/facebook/callback",                                 facebookOAuthCallback);  // Facebook OAuth callback
router.post("/forgot-password",       forgotPasswordRateLimiter, forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.get ("/me",                    protect, me);

// B09 · two-factor auth subroutes (status, setup, verify, disable,
// regenerate, login-verify). See twoFactorRoutes.js for full table.
router.use("/2fa", twoFactorRoutes);

module.exports = router;
