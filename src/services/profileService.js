/**
 * profileService · all Prisma access for the member profile endpoints.
 *
 * Extracted from profileController (roadmap step 39). The controller keeps
 * request validation + response shaping; everything that touches the DB,
 * bcrypt, or the avatar files on disk lives here.
 */

const path   = require("path")
const fs     = require("fs")
const bcrypt = require("bcryptjs")
const prisma = require("../lib/prisma")

const PUBLIC_DIR   = path.join(__dirname, "../../public")
const BCRYPT_ROUNDS = 12

const PROFILE_SELECT = {
  id: true, fullName: true, email: true, role: true,
  phone: true, company: true, avatarUrl: true, createdAt: true,
  passwordHash: true, authProvider: true,
}
const UPDATE_SELECT = { id: true, fullName: true, email: true, phone: true, company: true, avatarUrl: true }
const AVATAR_SELECT = { id: true, avatarUrl: true, fullName: true }

/* ────────────────────────────── profile ───────────────────────────────── */

/**
 * Returns `{ ...safeUser, hasPassword, profile }`.
 * `hasPassword` is derived from `passwordHash !== null` — the hash itself
 * never leaves this function.
 */
async function getProfile(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: PROFILE_SELECT })
  const profile = await prisma.userProfile.findUnique({ where: { userId } }).catch(() => null)

  const { passwordHash, ...safeUser } = user || {}
  return { ...safeUser, hasPassword: Boolean(passwordHash), profile }
}

async function updateProfile(userId, { fullName, phone, company } = {}) {
  const data = {}
  if (fullName !== undefined) data.fullName = fullName
  if (phone    !== undefined) data.phone    = phone
  if (company  !== undefined) data.company  = company

  return prisma.user.update({ where: { id: userId }, data, select: UPDATE_SELECT })
}

/* ────────────────────────────── avatar ────────────────────────────────── */

function removeAvatarFile(avatarUrl) {
  if (!avatarUrl) return
  const oldPath = path.join(PUBLIC_DIR, avatarUrl)
  if (fs.existsSync(oldPath)) {
    try { fs.unlinkSync(oldPath) } catch { /* best-effort */ }
  }
}

async function setAvatar(userId, avatarUrl) {
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } })
  removeAvatarFile(current?.avatarUrl)
  return prisma.user.update({ where: { id: userId }, data: { avatarUrl }, select: AVATAR_SELECT })
}

async function removeAvatar(userId) {
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } })
  removeAvatarFile(current?.avatarUrl)
  await prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } })
}

/* ───────────────────────────── passwords ──────────────────────────────── */

async function getPasswordHash(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } })
  return user ? user.passwordHash : undefined   // undefined → user not found
}

async function verifyCurrentPassword(userId, currentPassword) {
  const hash = await getPasswordHash(userId)
  return bcrypt.compare(currentPassword, hash || "")
}

/**
 * Writes a new hash and bumps `tokensValidFrom` (Phase 9.4 watermark) so any
 * JWT issued before this rotation stops being honoured.
 */
async function writePassword(userId, newPassword) {
  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
  await prisma.user.update({
    where: { id: userId },
    data:  { passwordHash: hash, tokensValidFrom: new Date() },
  })
}

module.exports = {
  getProfile,
  updateProfile,
  setAvatar,
  removeAvatar,
  getPasswordHash,
  verifyCurrentPassword,
  writePassword,
}
