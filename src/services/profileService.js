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
const { STORAGE_PATHS } = require("../config/storagePaths")
const logger = require("../utils/logger")

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

/**
 * Delete the file behind an avatarUrl.
 *
 * This used to be `path.join(PUBLIC_DIR, avatarUrl)`, which could not match on
 * two counts. Uploads land in storage/uploads/avatars (uploadAvatar.js), not
 * public/ — that move was deliberate, because a deploy wipes public/. And the
 * stored value is `/images/avatars/<file>?v=<ts>` (profileController), so the
 * join produced a path with a query string on the end.
 *
 * The delete therefore always silently no-opped: removeAvatar() cleared the
 * database row while leaving the image on disk, still served at a filename
 * that is stable per user — so a "removed" profile photo stayed fetchable.
 */
function removeAvatarFile(avatarUrl) {
  if (!avatarUrl) return

  // Strip the ?v= cache-buster, then take the basename: the value comes from
  // the database, and basename() means a doctored row cannot walk out of the
  // avatars directory.
  const withoutQuery = String(avatarUrl).split("?")[0]
  const fileName     = path.basename(withoutQuery)
  if (!fileName || fileName === "." || fileName === "..") return

  // public/ is still checked second so avatars written before the storage/
  // move are cleaned up too.
  const candidates = [
    path.join(STORAGE_PATHS.avatars, fileName),
    path.join(PUBLIC_DIR, withoutQuery),
  ]

  for (const target of candidates) {
    try {
      if (fs.existsSync(target)) {
        fs.unlinkSync(target)
        return
      }
    } catch (err) {
      logger.warn(`[profile] could not remove avatar file ${target}: ${err.message}`)
    }
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

/* ────────────────────────── ARCO · data export ────────────────────────── */

/**
 * Tier 1 (LFPDPPP arts. 22-28) · right of Access. Bundles every row that
 * belongs to the caller into one JSON object. Secrets never leave: no
 * passwordHash / reset tokens / 2FA secrets on the user row, no gateway
 * session ids on payments, only metadata for client projects. Every list is
 * bounded (`take`) and newest-first so a very old account can't produce an
 * unbounded response.
 */
const EXPORT_TAKE = 500

const EXPORT_USER_SELECT = {
  id: true, fullName: true, email: true, role: true, phone: true, company: true,
  avatarUrl: true, authProvider: true, status: true, emailVerifiedAt: true,
  lastLoginAt: true, createdAt: true, updatedAt: true,
}

const EXPORT_PAYMENT_SELECT = {
  id: true, orderId: true, paymentGateway: true, amount: true, currency: true,
  paymentStatus: true, paidAt: true, createdAt: true,
}

async function exportUserData(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: EXPORT_USER_SELECT })
  if (!user) return null

  const newest = { createdAt: "desc" }
  const byUser = { where: { userId }, orderBy: newest, take: EXPORT_TAKE }

  const [
    profile, addresses, orders, serviceOrders, consultations, clientProjects,
    supportTickets, reviews, newsletter, notifications, downloads,
  ] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.address.findMany(byUser),
    prisma.order.findMany({
      ...byUser,
      include: { items: true, payments: { select: EXPORT_PAYMENT_SELECT } },
    }),
    prisma.serviceOrder.findMany(byUser),
    prisma.consultation.findMany({
      ...byUser,
      select: {
        id: true, serviceId: true, scheduledAt: true, endsAt: true, durationMin: true,
        timezone: true, meetingProvider: true, status: true, clientNotes: true,
        cancellationReason: true, cancelledAt: true, confirmedAt: true,
        completedAt: true, createdAt: true,
      },
    }),
    prisma.clientProject.findMany({
      ...byUser,
      select: {
        id: true, projectName: true, projectStatus: true, startDate: true,
        dueDate: true, createdAt: true, updatedAt: true,
      },
    }),
    prisma.supportTicket.findMany({
      ...byUser,
      include: { messages: { orderBy: { createdAt: "asc" }, take: EXPORT_TAKE } },
    }),
    prisma.review.findMany(byUser),
    prisma.newsletterSubscriber.findUnique({ where: { email: user.email } }),
    prisma.notification.findMany(byUser),
    prisma.userDownload.findMany(byUser),
  ])

  return {
    exportedAt: new Date().toISOString(),
    user, profile, addresses, orders, serviceOrders, consultations, clientProjects,
    supportTickets, reviews, newsletter, notifications, downloads,
  }
}

/* ───────────────────── ARCO · cancellation (delete) ───────────────────── */

const OPEN_SERVICE_ORDER = ["new", "active", "on_hold"]
const OPEN_PROJECT       = ["planning", "in_progress", "review"]
const OPEN_CONSULTATION  = ["pending", "confirmed", "scheduled", "rescheduled"]

/**
 * Anything that still needs to be delivered or attended blocks deletion:
 * an unpaid order, a paid order whose service work is still open, an active
 * client project, or an upcoming consultation. Returns a short reason list
 * (empty array = nothing open).
 */
async function getOpenActivity(userId) {
  const [pendingOrders, openServiceOrders, openProjects, upcoming] = await Promise.all([
    prisma.order.count({ where: { userId, status: "pending" } }),
    prisma.serviceOrder.count({ where: { userId, status: { in: OPEN_SERVICE_ORDER }, order: { status: "paid" } } }),
    prisma.clientProject.count({ where: { userId, projectStatus: { in: OPEN_PROJECT } } }),
    prisma.consultation.count({ where: { userId, status: { in: OPEN_CONSULTATION }, scheduledAt: { gte: new Date() } } }),
  ])
  const reasons = []
  if (pendingOrders)     reasons.push("pending_order")
  if (openServiceOrders) reasons.push("open_service_order")
  if (openProjects)      reasons.push("active_project")
  if (upcoming)          reasons.push("upcoming_consultation")
  return reasons
}

/**
 * Right of Cancellation. Orders, payments and invoices must survive for
 * fiscal reasons (CFF art. 30 · five years), so the account is anonymised
 * rather than hard-deleted: PII on the user row is scrubbed, addresses are
 * removed, the newsletter row is dropped and every session is revoked.
 *
 * `UserStatus` has no `deleted` member (active | suspended | pending) and
 * this tier makes no schema changes, so the row is parked as `suspended`
 * — the `@anonymized.invalid` email is the durable marker that it was a
 * self-service deletion.
 */
async function deleteAccount(userId, { ipAddress } = {}) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, fullName: true, avatarUrl: true },
  })
  if (!user) return null

  const anonEmail = `deleted+${userId}@anonymized.invalid`
  removeAvatarFile(user.avatarUrl)

  await prisma.$transaction(async (tx) => {
    await tx.address.deleteMany({ where: { userId } })
    await tx.userProfile.deleteMany({ where: { userId } })
    await tx.newsletterSubscriber.deleteMany({ where: { email: user.email } })
    await tx.user.update({
      where: { id: userId },
      data: {
        email:        anonEmail,
        fullName:     "Deleted user",
        phone:        null,
        company:      null,
        avatarUrl:    null,
        googleId:     null,
        microsoftId:  null,
        facebookId:   null,
        passwordHash: null,
        resetPasswordToken:   null,
        resetPasswordExpires: null,
        status:       "suspended",
        tokensValidFrom: new Date(),
      },
    })
    await tx.activityLog.create({
      data: {
        userId,
        action:      "account.deleted",
        entityType:  "User",
        entityId:    userId,
        description: "Self-service account deletion (ARCO · cancelación)",
        ipAddress:   ipAddress || null,
      },
    })
  })

  // Belt and braces: the transaction already bumped the watermark, but
  // revokeUserSessions is the one canonical sign-out-everywhere primitive.
  await require("./authService").revokeUserSessions(userId)

  // Confirmation email only when an operator has seeded a template for it;
  // there is none in prisma/seed-email-templates.js today, so this is a
  // silent no-op until `account.deleted` exists.
  try {
    const template = await prisma.emailTemplate.findFirst({ where: { key: "account.deleted", isActive: true } })
    if (template) {
      await require("./emailService").sendTemplateEmail({
        to: user.email, templateKey: "account.deleted",
        variables: { name: user.fullName },
      })
    }
  } catch (err) {
    logger.warn(`[profile] account.deleted email skipped: ${err.message}`)
  }

  return { id: userId, email: anonEmail }
}

module.exports = {
  getProfile,
  updateProfile,
  setAvatar,
  removeAvatar,
  getPasswordHash,
  verifyCurrentPassword,
  writePassword,
  exportUserData,
  getOpenActivity,
  deleteAccount,
}
