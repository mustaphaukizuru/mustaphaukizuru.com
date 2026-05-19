const prisma       = require("../lib/prisma")
const path         = require("path")
const fs           = require("fs")
const asyncHandler = require("../utils/asyncHandler")

// Phase 9.2c · refactored to asyncHandler so unhandled errors flow into the
// central errorHandler middleware. The pre-Phase-9.2 code did
//   catch (err) { return res.status(500).json({ message: err.message }) }
// at five different sites — every Prisma engine error, validation failure,
// or schema typo was being mirrored back to the client. errorHandler
// sanitises before returning.

// GET /api/member/profile
//
// `hasPassword` is derived from `passwordHash !== null`. It tells the
// frontend which password form to render: "Set password" (Google-only
// users with no local credential yet) vs. "Change password" (anyone who
// has set a local credential — original signup OR Google user who opted
// into a fallback password from this very page).
//
// `authProvider` is included for UX context. It's purely informational
// for the client; the auth gate uses `hasPassword` exclusively when
// deciding which form to show.
const getProfile = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  const user   = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, fullName: true, email: true, role: true,
      phone: true, company: true, avatarUrl: true, createdAt: true,
      passwordHash: true, authProvider: true,
    },
  })
  const profile = await prisma.userProfile.findUnique({ where: { userId } }).catch(() => null)

  // Strip the hash before sending — it must never leave the server.
  // We only needed it to compute `hasPassword`.
  const { passwordHash, ...safeUser } = user || {}
  return res.status(200).json({
    success: true,
    data: {
      ...safeUser,
      hasPassword: Boolean(passwordHash),
      profile,
    },
  })
})

// PATCH /api/member/profile
const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  const { fullName, phone, company } = req.body
  const data = {}
  if (fullName !== undefined) data.fullName = fullName
  if (phone    !== undefined) data.phone    = phone
  if (company  !== undefined) data.company  = company

  const user = await prisma.user.update({
    where:  { id: userId },
    data,
    select: { id: true, fullName: true, email: true, phone: true, company: true, avatarUrl: true },
  })
  return res.status(200).json({ success: true, data: user })
})

// POST /api/member/profile/avatar
const uploadAvatar = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  const file   = req.file
  if (!file) return res.status(400).json({ success: false, message: "No image uploaded" })

  const avatarUrl = `/images/avatars/${file.filename}`

  // Delete old avatar if exists
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } })
  if (current?.avatarUrl) {
    const oldPath = path.join(__dirname, "../../public", current.avatarUrl)
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
  }

  const user = await prisma.user.update({
    where:  { id: userId },
    data:   { avatarUrl },
    select: { id: true, avatarUrl: true, fullName: true },
  })
  return res.status(200).json({ success: true, data: user })
})

// DELETE /api/member/profile/avatar
const deleteAvatar = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } })
  if (current?.avatarUrl) {
    const oldPath = path.join(__dirname, "../../public", current.avatarUrl)
    if (fs.existsSync(oldPath)) try { fs.unlinkSync(oldPath) } catch { /* best-effort */ }
  }
  await prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } })
  return res.status(200).json({ success: true, message: "Avatar removed" })
})

// PATCH /api/member/profile/password
const changePassword = asyncHandler(async (req, res) => {
  const bcrypt = require("bcryptjs")
  const userId = req.user?.id
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: "Both passwords required" })
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: "New password must be at least 6 characters" })
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } })
  const isMatch = await bcrypt.compare(currentPassword, user?.passwordHash || "")
  if (!isMatch) return res.status(401).json({ success: false, message: "Current password is incorrect" })

  const hash = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: hash,
      // Phase 9.4 watermark — revoke any JWT issued before this rotation
      // so stolen rememberMe tokens stop being honoured.
      tokensValidFrom: new Date(),
    },
  })
  return res.status(200).json({ success: true, message: "Password changed successfully" })
})

// POST /api/member/profile/set-password
//
// Account-linking flow. For users who originally signed up via Google
// (passwordHash = null), this lets them ADD an email/password fallback
// to their existing account so a Google outage doesn't lock them out.
//
// Security properties:
//   • Auth-protected — only the account owner (verified by JWT) can set
//     the initial password. No email link / no token in URL needed since
//     the user is already authenticated via their primary auth method.
//   • Idempotency block — refuses if the user already has a passwordHash.
//     The existing "change password" endpoint (PATCH /password) is the
//     path for users who already have one; routing the wrong call here
//     would be a security regression (bypasses currentPassword check).
//   • Same JWT-watermark rotation as changePassword — tokensValidFrom is
//     bumped, so any stolen rememberMe cookie from before the password
//     was set stops being honoured.
//
// authProvider is intentionally NOT changed. The account stays "google"
// as its primary identity; the password is purely an additional way in.
// Login routing in authService.loginUser already accepts either credential
// once passwordHash is populated, because the "uses Google sign-in"
// rejection only fires when passwordHash is null.
const setPassword = asyncHandler(async (req, res) => {
  const bcrypt = require("bcryptjs")
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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  })
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" })
  }
  if (user.passwordHash) {
    // Already has a password — must use changePassword to rotate it,
    // which requires proof of the current one.
    return res.status(409).json({
      success: false,
      message: "A password is already set on this account. Use Change Password to update it.",
    })
  }

  const hash = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: hash,
      tokensValidFrom: new Date(),
    },
  })

  return res.status(200).json({
    success: true,
    message: "Password set. You can now sign in with email and password as a backup.",
    data: { hasPassword: true },
  })
})

module.exports = { getProfile, updateProfile, uploadAvatar, deleteAvatar, changePassword, setPassword }
