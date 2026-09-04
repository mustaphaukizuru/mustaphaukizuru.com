// @ts-check
/**
 * adminAuditService · T1-4
 *
 * The audit route used to query Prisma directly with `Number(req.query.limit)`
 * as `take` — the one route file with database access, and the one list
 * with no ceiling (`?limit=999999` returned the whole table). The query
 * lives here now, with the page and limit clamped the way every other admin
 * list clamps them.
 */
const prisma = require("../lib/prisma")

const DEFAULT_LIMIT = 50
const MAX_LIMIT     = 200

function clampPage(value)  { return Math.max(1, Number(value) || 1) }
function clampLimit(value) { return Math.min(MAX_LIMIT, Math.max(1, Number(value) || DEFAULT_LIMIT)) }

/**
 * @param {{ page?: any, limit?: any }} [q]
 * @returns {Promise<{ logs: object[], meta: { page: number, limit: number, total: number, pages: number } }>}
 */
async function listAuditLogs({ page, limit } = {}) {
  const safePage  = clampPage(page)
  const safeLimit = clampLimit(limit)
  const [logs, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip:    (safePage - 1) * safeLimit,
      take:    safeLimit,
      include: { adminUser: { select: { id: true, fullName: true, email: true } } },
    }),
    prisma.adminAuditLog.count(),
  ])
  return {
    logs,
    meta: { page: safePage, limit: safeLimit, total, pages: Math.max(1, Math.ceil(total / safeLimit)) },
  }
}

module.exports = { listAuditLogs, clampPage, clampLimit, DEFAULT_LIMIT, MAX_LIMIT }
