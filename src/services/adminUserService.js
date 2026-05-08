// @ts-check
const prisma = require("../lib/prisma")

/* ────────────────────────────────────────────────────────────────────────
   Admin User Service
   Single source of truth for user list metrics + admin mutations
   (status / role). Always selects a stable shape that matches the
   frontend table contract.
   ──────────────────────────────────────────────────────────────────── */

const VALID_STATUSES = ["active", "suspended", "pending"]
const VALID_ROLES    = ["admin", "member"]

const SAFE_USER_SELECT = {
  id:           true,
  fullName:     true,
  email:        true,
  role:         true,
  status:       true,
  authProvider: true,
  createdAt:    true,
  lastLoginAt:  true,
  _count:       { select: { orders: true } },
}

/* ────────────────────────────────────────────────────────────────────────
   List users + metrics in a single Promise.all (2 DB roundtrips).
   ──────────────────────────────────────────────────────────────────── */
async function getAdminUsers({ page = 1, limit = 50, role, status, search } = {}) {
  const where = {}
  if (role)   where.role   = role
  if (status) where.status = status
  if (search?.trim()) {
    const q = search.trim()
    where.OR = [
      { fullName: { contains: q } },
      { email:    { contains: q } },
    ]
  }

  const [users, total, admins, members, active] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip:    (Number(page) - 1) * Number(limit),
      take:    Number(limit),
      select:  SAFE_USER_SELECT,
    }),
    prisma.user.count({ where }),
    prisma.user.count({ where: { role: "admin" } }),
    prisma.user.count({ where: { role: "member" } }),
    prisma.user.count({ where: { status: "active" } }),
  ])

  return {
    users,
    meta:    { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
    metrics: { total, admins, members, active },
  }
}

/* ────────────────────────────────────────────────────────────────────────
   Update a user's status (active / suspended / pending).
   ──────────────────────────────────────────────────────────────────── */
async function updateUserStatus(userId, status) {
  if (!userId) throw new Error("User id is required")
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status. Expected one of: ${VALID_STATUSES.join(", ")}`)
  }
  return prisma.user.update({
    where:  { id: String(userId) },
    data:   { status },
    select: SAFE_USER_SELECT,
  })
}

/* ────────────────────────────────────────────────────────────────────────
   Update a user's role (admin / member). Self-demotion guard is enforced
   in the controller layer where we know `req.user.id`.
   ──────────────────────────────────────────────────────────────────── */
async function updateUserRole(userId, role) {
  if (!userId) throw new Error("User id is required")
  if (!VALID_ROLES.includes(role)) {
    throw new Error(`Invalid role. Expected one of: ${VALID_ROLES.join(", ")}`)
  }
  return prisma.user.update({
    where:  { id: String(userId) },
    data:   { role },
    select: SAFE_USER_SELECT,
  })
}

module.exports = {
  getAdminUsers,
  updateUserStatus,
  updateUserRole,
  VALID_STATUSES,
  VALID_ROLES,
}
