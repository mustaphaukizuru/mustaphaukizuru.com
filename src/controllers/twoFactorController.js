const bcrypt = require("bcryptjs")
const asyncHandler = require("../utils/asyncHandler")
const generateToken = require("../utils/generateToken")
const prisma = require("../lib/prisma")
const twoFactorService = require("../services/twoFactorService")
const { completeLoginAfter2FA } = require("../services/authService")

/**
 * 2FA controller (B09)
 *
 * Routes:
 *   POST /api/auth/2fa/status                      → auth required
 *   POST /api/auth/2fa/setup                       → auth required
 *   POST /api/auth/2fa/verify                      → auth required
 *   POST /api/auth/2fa/disable                     → auth required + password
 *   POST /api/auth/2fa/backup-codes/regenerate     → auth required + password
 *   POST /api/auth/2fa/login-verify                → PUBLIC (uses two-factor token)
 */

/* ── Member-area handlers (require valid session JWT) ──────────────────── */

const status = asyncHandler(async (req, res) => {
  const data = await twoFactorService.getStatus(req.user.id)
  res.json({ success: true, data })
})

const setup = asyncHandler(async (req, res) => {
  // Pull email from DB, not from req.user (req.user may have been issued
  // before email change in some flows).
  const user = await prisma.user.findUnique({
    where:  { id: req.user.id },
    select: { email: true },
  })
  if (!user) return res.status(404).json({ success: false, message: "User not found" })

  try {
    const data = await twoFactorService.setupTwoFactor({
      userId:    req.user.id,
      userEmail: user.email,
    })
    res.json({ success: true, data })
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to set up 2FA",
    })
  }
})

const verify = asyncHandler(async (req, res) => {
  const { code } = req.body || {}
  try {
    const data = await twoFactorService.verifyAndEnable({ userId: req.user.id, code })
    res.json({
      success: true,
      message: "2FA enabled. Save your backup codes — you won't see them again.",
      data,
    })
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Verification failed",
    })
  }
})

const disable = asyncHandler(async (req, res) => {
  const { password } = req.body || {}
  if (!password) {
    return res.status(400).json({ success: false, message: "Password is required to disable 2FA" })
  }

  const ok = await verifyPassword(req.user.id, password)
  if (!ok) {
    return res.status(401).json({ success: false, message: "Incorrect password" })
  }

  const result = await twoFactorService.disableTwoFactor({ userId: req.user.id })
  res.json({ success: true, message: result.disabled ? "2FA disabled" : "2FA was not enabled", data: result })
})

const regenerateBackupCodes = asyncHandler(async (req, res) => {
  const { password } = req.body || {}
  if (!password) {
    return res.status(400).json({ success: false, message: "Password is required" })
  }

  const ok = await verifyPassword(req.user.id, password)
  if (!ok) {
    return res.status(401).json({ success: false, message: "Incorrect password" })
  }

  try {
    const data = await twoFactorService.regenerateBackupCodes({ userId: req.user.id })
    res.json({
      success: true,
      message: "New backup codes generated. Previous codes are now invalid.",
      data,
    })
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Could not regenerate backup codes",
    })
  }
})

/* ── Public handler — exchange 2FA token + code for session JWT ────────── */

const loginVerify = asyncHandler(async (req, res) => {
  const { twoFactorToken, code } = req.body || {}

  if (!twoFactorToken || !code) {
    return res.status(400).json({ success: false, message: "twoFactorToken and code are required" })
  }

  let payload
  try {
    payload = twoFactorService.verifyTwoFactorToken(twoFactorToken)
  } catch (err) {
    return res.status(err.statusCode || 401).json({
      success: false,
      message: err.message || "Invalid or expired 2FA session",
    })
  }

  try {
    await twoFactorService.verifyLoginCode({ userId: payload.userId, code })
  } catch (err) {
    return res.status(err.statusCode || 400).json({
      success: false,
      message: err.message || "Invalid 2FA code",
    })
  }

  // Verified — finalize login
  const user  = await completeLoginAfter2FA(payload.userId)
  const token = generateToken(user, Boolean(payload.rememberMe))

  return res.status(200).json({
    success: true,
    message: "Login successful",
    data: { user, token },
  })
})

/* ── Helpers ───────────────────────────────────────────────────────────── */

async function verifyPassword(userId, plainPassword) {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { passwordHash: true, authProvider: true },
  })
  if (!user || !user.passwordHash) return false
  try {
    return await bcrypt.compare(String(plainPassword), user.passwordHash)
  } catch {
    return false
  }
}

module.exports = {
  status,
  setup,
  verify,
  disable,
  regenerateBackupCodes,
  loginVerify,
}
