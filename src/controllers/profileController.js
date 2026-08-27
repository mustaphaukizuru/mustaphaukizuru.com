const asyncHandler   = require("../utils/asyncHandler")
const profileService = require("../services/profileService")
const { clearSessionCookie } = require("../utils/sessionCookie")

// Phase 9.2c · asyncHandler so unhandled errors flow into the central
// errorHandler middleware. Step 39 · all Prisma / bcrypt / filesystem work
// moved to services/profileService.js — this file only validates input and
// shapes the HTTP response. Response shapes are unchanged.

// GET /api/member/profile
//
// `hasPassword` tells the frontend which password form to render: "Set
// password" (Google-only users with no local credential yet) vs. "Change
// password". `authProvider` is informational only.
const getProfile = asyncHandler(async (req, res) => {
  const data = await profileService.getProfile(req.user?.id)
  return res.status(200).json({ success: true, data })
})

// PATCH /api/member/profile
const updateProfile = asyncHandler(async (req, res) => {
  const { fullName, phone, company } = req.body
  const user = await profileService.updateProfile(req.user?.id, { fullName, phone, company })
  return res.status(200).json({ success: true, data: user })
})

// POST /api/member/profile/avatar
const uploadAvatar = asyncHandler(async (req, res) => {
  const file = req.file
  if (!file) return res.status(400).json({ success: false, message: "No image uploaded" })

  const avatarUrl = `/images/avatars/${file.filename}`
  const user = await profileService.setAvatar(req.user?.id, avatarUrl)
  return res.status(200).json({ success: true, data: user })
})

// DELETE /api/member/profile/avatar
const deleteAvatar = asyncHandler(async (req, res) => {
  await profileService.removeAvatar(req.user?.id)
  return res.status(200).json({ success: true, message: "Avatar removed" })
})

// PATCH /api/member/profile/password
const changePassword = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: "Both passwords required" })
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: "New password must be at least 6 characters" })
  }

  const isMatch = await profileService.verifyCurrentPassword(userId, currentPassword)
  if (!isMatch) return res.status(401).json({ success: false, message: "Current password is incorrect" })

  await profileService.writePassword(userId, newPassword)
  return res.status(200).json({ success: true, message: "Password changed successfully" })
})

// POST /api/member/profile/set-password
//
// Account-linking flow. For users who originally signed up via Google
// (passwordHash = null), this lets them ADD an email/password fallback.
//
// Security properties:
//   • Auth-protected — only the account owner (verified by JWT) can set it.
//   • Idempotency block — refuses if the user already has a passwordHash;
//     PATCH /password (which requires proof of the current one) is the path
//     for rotation.
//   • Same JWT-watermark rotation as changePassword (tokensValidFrom bump).
//
// authProvider is intentionally NOT changed — the password is purely an
// additional way in.
const setPassword = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  const { newPassword, confirmPassword } = req.body || {}

  if (!newPassword || !confirmPassword) {
    return res.status(400).json({ success: false, message: "Both new and confirm password are required" })
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ success: false, message: "Passwords do not match" })
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: "Password must be at least 6 characters" })
  }

  const passwordHash = await profileService.getPasswordHash(userId)
  if (passwordHash === undefined) {
    return res.status(404).json({ success: false, message: "User not found" })
  }
  if (passwordHash) {
    return res.status(409).json({
      success: false,
      message: "A password is already set on this account. Use Change Password to update it.",
    })
  }

  await profileService.writePassword(userId, newPassword)
  return res.status(200).json({
    success: true,
    message: "Password set. You can now sign in with email and password as a backup.",
    data: { hasPassword: true },
  })
})

// GET /api/member/profile/export · ARCO right of Access (LFPDPPP art. 23)
const exportMyData = asyncHandler(async (req, res) => {
  const data = await profileService.exportUserData(req.user?.id)
  if (!data) return res.status(404).json({ success: false, message: "User not found" })
  res.setHeader("Content-Type", "application/json; charset=utf-8")
  res.setHeader("Content-Disposition", 'attachment; filename="my-data.json"')
  res.setHeader("Cache-Control", "no-store")
  return res.status(200).send(JSON.stringify(data, null, 2))
})

// DELETE /api/member/profile · ARCO right of Cancellation (LFPDPPP art. 25)
//
// Password accounts must re-prove the password; OAuth-only accounts have no
// local credential to check (their JWT is the proof). Anything still owed
// to the user blocks deletion with 409 so an order in flight can't be
// orphaned. See profileService.deleteAccount for why this anonymises.
const deleteMyAccount = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  const { password } = req.body || {}

  const passwordHash = await profileService.getPasswordHash(userId)
  if (passwordHash === undefined) {
    return res.status(404).json({ success: false, message: "User not found" })
  }
  if (passwordHash) {
    if (!password) {
      return res.status(400).json({ success: false, error: { code: "PASSWORD_REQUIRED", message: "Password required" } })
    }
    const isMatch = await profileService.verifyCurrentPassword(userId, password)
    if (!isMatch) {
      return res.status(401).json({ success: false, error: { code: "PASSWORD_INCORRECT", message: "Password is incorrect" } })
    }
  }

  const open = await profileService.getOpenActivity(userId)
  if (open.length) {
    return res.status(409).json({
      success: false,
      error: {
        code:    "HAS_OPEN_ACTIVITY",
        message: "Your account still has orders, projects or bookings in progress. Complete or cancel them first.",
        details: { reasons: open },
      },
    })
  }

  await profileService.deleteAccount(userId, { ipAddress: req.ip })
  clearSessionCookie(res)
  return res.status(200).json({ success: true, message: "Account deleted" })
})

module.exports = { getProfile, updateProfile, uploadAvatar, deleteAvatar, changePassword, setPassword, exportMyData, deleteMyAccount }
