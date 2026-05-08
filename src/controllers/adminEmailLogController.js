const asyncHandler = require("../utils/asyncHandler")
const prisma = require("../lib/prisma")

/**
 * GET /api/admin/email-logs  — ?status=&templateKey=&q=&page=&limit=&from=&to=
 * Returns recent EmailLog entries with user info when available.
 */
const list = asyncHandler(async (req, res) => {
  const { status, templateKey, q, page = 1, limit = 50, from, to } = req.query

  const safePage  = Math.max(1, Number(page) || 1)
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50))

  const where = {}
  if (status)      where.status      = status
  if (templateKey) where.templateKey = templateKey
  if (q)           where.emailTo     = { contains: String(q).trim() }
  if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = new Date(from)
    if (to)   where.createdAt.lte = new Date(to)
  }

  const [items, total] = await Promise.all([
    prisma.emailLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip:    (safePage - 1) * safeLimit,
      take:    safeLimit,
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
    }),
    prisma.emailLog.count({ where }),
  ])

  res.json({
    success: true,
    data: items.map((row) => ({
      id:                row.id,
      emailTo:           row.emailTo,
      templateKey:       row.templateKey,
      subject:           row.subject,
      status:            row.status,
      providerMessageId: row.providerMessageId,
      sentAt:            row.sentAt,
      errorMessage:      row.errorMessage,
      createdAt:         row.createdAt,
      user:              row.user || null,
    })),
    pagination: {
      page: safePage, limit: safeLimit, total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  })
})

/**
 * GET /api/admin/email-logs/stats  — rollups for the admin dashboard widget
 */
const stats = asyncHandler(async (req, res) => {
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30) // last 30 days

  const [sent, failed, byTemplate] = await Promise.all([
    prisma.emailLog.count({ where: { status: "sent",   createdAt: { gte: since } } }),
    prisma.emailLog.count({ where: { status: "failed", createdAt: { gte: since } } }),
    prisma.emailLog.groupBy({
      by:      ["templateKey", "status"],
      where:   { createdAt: { gte: since } },
      _count:  { _all: true },
    }).catch(() => []),
  ])

  res.json({
    success: true,
    data: {
      last30Days: { sent, failed, total: sent + failed },
      byTemplate: byTemplate.map((r) => ({
        templateKey: r.templateKey || "(raw)",
        status:      r.status,
        count:       r._count._all,
      })),
    },
  })
})

module.exports = { list, stats }
