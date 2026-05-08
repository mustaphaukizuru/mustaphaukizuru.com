// @ts-check
/**
 * adminSessionService.js · admin operations on the Session table.
 *
 * Surfaces every active sign-in across the platform so admins can detect
 * anomalies (geo, device, age) and revoke compromised tokens. Session.id
 * and Session.tokenHash never leave the database.
 *
 * Schema reference (prisma/schema.prisma) — Session columns:
 *   id, userId, ipAddress, userAgent, deviceName, lastActivityAt,
 *   expiresAt, createdAt, user (relation).
 *
 * Revocation model: there is no `isRevoked` flag. Revoking a session
 * means deleting the row. Expired sessions are filtered out by query.
 */

const prisma = require("../lib/prisma")

function serializeSession(s) {
  return {
    id:        s.id,
    userId:    s.userId,
    user: s.user ? {
      id:        s.user.id,
      fullName:  s.user.fullName,
      email:     s.user.email,
      avatarUrl: s.user.avatarUrl || null,
      role:      s.user.role || null,
    } : null,
    ipAddress:      s.ipAddress || null,
    userAgent:      s.userAgent || null,
    deviceName:     s.deviceName || null,
    createdAt:      s.createdAt?.toISOString?.() || null,
    expiresAt:      s.expiresAt?.toISOString?.() || null,
    lastActivityAt: s.lastActivityAt?.toISOString?.() || null,
    expired:        s.expiresAt ? s.expiresAt.getTime() < Date.now() : false,
  }
}

async function listSessions({ userId, includeExpired = false, limit = 200 } = {}) {
  const where = {}
  if (userId) where.userId = userId
  if (!includeExpired) where.expiresAt = { gt: new Date() }

  const rows = await prisma.session.findMany({
    where,
    orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
    take:    Math.min(Math.max(Number(limit) || 200, 1), 500),
    include: {
      user: { select: { id: true, fullName: true, email: true, avatarUrl: true, role: true } },
    },
  })
  return rows.map(serializeSession)
}

async function revokeSession(id) {
  // Hard-delete the session row — matches the schema's lack of isRevoked.
  // authMiddleware checks tokenHash existence on each request, so deleting
  // the row immediately invalidates the JWT.
  try {
    await prisma.session.delete({ where: { id } })
  } catch (err) {
    if (err && err.code === "P2025") return { id, alreadyRevoked: true }
    throw err
  }
  return { id, revoked: true }
}

async function revokeAllForUser(userId, exceptId = null) {
  const where = { userId, ...(exceptId ? { NOT: { id: exceptId } } : {}) }
  const result = await prisma.session.deleteMany({ where })
  return { count: result.count }
}

module.exports = { listSessions, revokeSession, revokeAllForUser }
