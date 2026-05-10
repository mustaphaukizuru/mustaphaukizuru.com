const express = require("express")
const { protect } = require("../middleware/authMiddleware")

// B10 · login-verify is a login attempt → use loginRateLimiter (5/15min/IP+email).
// P9.4 · stacks the twoFactorVerifyRateLimiter (5/5min/IP+token-hash) on top so
// brute-force on a single 2FA token is bounded INDEPENDENTLY of the broader
// credential-stuffing limit. See rateLimiter.js for the keying rationale.
const {
  loginRateLimiter,
  twoFactorVerifyRateLimiter,
} = require("../middleware/rateLimiter")

const c = require("../controllers/twoFactorController")

const router = express.Router()

/**
 * Two-factor authentication routes (B09 · rate-limited per B10)
 *
 * Mounted at /api/auth/2fa via authRoutes.js → router.use("/2fa", twoFactorRoutes).
 *
 *   POST /login-verify                 → PUBLIC · loginRateLimiter (5/15min)
 *   POST /status                       → auth · current 2FA state
 *   POST /setup                        → auth · begin enrollment
 *   POST /verify                       → auth · confirm first code
 *   POST /disable                      → auth · requires { password }
 *   POST /backup-codes/regenerate      → auth · requires { password }
 *
 * The authenticated routes inherit the global API limiter (100/15min/IP) plus
 * the user is already past primary auth — no extra per-route limiter needed.
 */

// Public — uses two-factor token from /api/auth/login. Login-class limit
// (5/15min/IP+email) stops broad credential stuffing; the 2FA-verify limit
// (5/5min/IP+token-hash) stops 6-digit-code brute-force on a single token.
router.post("/login-verify", loginRateLimiter, twoFactorVerifyRateLimiter, c.loginVerify)

// Authenticated
router.use(protect)
router.post("/status",                   c.status)
router.post("/setup",                    c.setup)
router.post("/verify",                   c.verify)
router.post("/disable",                  c.disable)
router.post("/backup-codes/regenerate",  c.regenerateBackupCodes)

module.exports = router
