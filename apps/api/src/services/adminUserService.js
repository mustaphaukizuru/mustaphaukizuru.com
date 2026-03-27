const prisma = require("../lib/prisma")

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

  // Run user list + all metrics in a single Promise.all — 2 DB roundtrips total
  const [users, total, admins, members, active] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip:  (Number(page) - 1) * Number(limit),
      take:  Number(limit),
      select: {
        id: true, fullName: true, email: true, role: true,
        status: true, authProvider: true, createdAt: true, lastLoginAt: true,
        _count: { select: { orders: true } },
      },
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

// Suspend/activate a user
async function updateUserStatus(userId, status) {
  return prisma.user.update({
    where: { id: userId },
    data:  { status },
    select: { id: true, fullName: true, email: true, role: true, status: true },
  })
}

module.exports = { getAdminUsers, updateUserStatus }
