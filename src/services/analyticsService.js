// =============================================================
// analyticsService.js · privacy-first analytics (M14)
// Server-side, cookieless. No PII collected.
// Session is identified by a SHA-256 hash of (IP + UA + day-bucket).
// =============================================================

const crypto = require("crypto")
const prisma = require("../lib/prisma")

const HASH_SECRET = process.env.ANALYTICS_HASH_SALT || "muz-analytics-default-salt"

// ---- Hash helpers ----------------------------------------------

function sha(input) {
  return crypto.createHmac("sha256", HASH_SECRET).update(String(input)).digest("hex").slice(0, 32)
}

function dayBucket() {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

function detectDevice(ua = "") {
  const u = String(ua).toLowerCase()
  if (/(ipad|tablet)/.test(u))                     return "tablet"
  if (/(android|iphone|ipod|mobile)/.test(u))      return "mobile"
  if (/(bot|crawl|slurp|spider|fetch)/i.test(u))   return "bot"
  return "desktop"
}

function buildSessionHash(req) {
  // No PII stored — only the irreversible HMAC.
  const ip      = req.ip || req.connection?.remoteAddress || "0.0.0.0"
  const ua      = req.headers["user-agent"] || ""
  const day     = dayBucket()
  return sha(`${ip}|${ua}|${day}`)
}

function buildUaHash(req) {
  return sha(req.headers["user-agent"] || "")
}

// ---- Write paths ----------------------------------------------

exports.trackPageView = async (req, { path, referrer, country }) => {
  if (!path || typeof path !== "string") return null
  return prisma.pageView.create({
    data: {
      path:         String(path).slice(0, 512),
      referrer:     referrer ? String(referrer).slice(0, 512) : null,
      country:      country  ? String(country).slice(0, 8)    : null,
      device:       detectDevice(req.headers["user-agent"]),
      uaHash:       buildUaHash(req),
      sessionHash:  buildSessionHash(req),
    },
  })
}

exports.trackEvent = async (req, payload = {}) => {
  const { name } = payload
  if (!name || typeof name !== "string") return null
  return prisma.analyticsEvent.create({
    data: {
      name:         String(name).slice(0, 64),
      path:         payload.path      ? String(payload.path).slice(0, 512) : null,
      productId:    payload.productId || null,
      serviceId:    payload.serviceId || null,
      orderId:      payload.orderId   || null,
      amount:       payload.amount != null ? Number(payload.amount) : null,
      meta:         payload.meta && typeof payload.meta === "object" ? payload.meta : null,
      sessionHash:  buildSessionHash(req),
    },
  })
}

// ---- Admin read paths ----------------------------------------

function rangeWhere(daysBack = 30) {
  const since = new Date(Date.now() - daysBack * 86_400_000)
  return { createdAt: { gte: since } }
}

exports.getDashboardKpis = async ({ daysBack = 30 } = {}) => {
  const where = rangeWhere(daysBack)

  const [pageviewCount, sessionAgg, addToCart, beginCheckout, purchases, revenueAgg] = await Promise.all([
    prisma.pageView.count({ where }),
    prisma.pageView.findMany({ where, select: { sessionHash: true }, distinct: ["sessionHash"] }),
    prisma.analyticsEvent.count({ where: { ...where, name: "add_to_cart" } }),
    prisma.analyticsEvent.count({ where: { ...where, name: "begin_checkout" } }),
    prisma.analyticsEvent.count({ where: { ...where, name: "purchase" } }),
    prisma.analyticsEvent.aggregate({
      where: { ...where, name: "purchase" },
      _sum:  { amount: true },
    }),
  ])

  return {
    pageviews:      pageviewCount,
    sessions:       sessionAgg.length,
    addToCart,
    beginCheckout,
    purchases,
    revenue:        Number(revenueAgg._sum.amount || 0),
    conversionRate: sessionAgg.length > 0
                      ? Math.round((purchases / sessionAgg.length) * 10_000) / 100
                      : 0,
  }
}

exports.getTopPaths = async ({ daysBack = 30, limit = 10 } = {}) => {
  // Group by path, count rows. Prisma groupBy supports this directly on MySQL.
  const rows = await prisma.pageView.groupBy({
    by:        ["path"],
    where:     rangeWhere(daysBack),
    _count:    { _all: true },
    orderBy:   { _count: { path: "desc" } },
    take:      Math.min(50, Math.max(1, Number(limit) || 10)),
  })
  return rows.map((r) => ({ path: r.path, views: r._count._all }))
}

exports.getDailyTimeSeries = async ({ daysBack = 30 } = {}) => {
  // MySQL DATE() grouping via raw query — Prisma has no first-class DATE bucket.
  const since = new Date(Date.now() - daysBack * 86_400_000)
  const rows = await prisma.$queryRaw`
    SELECT DATE(createdAt) AS day, COUNT(*) AS pageviews
    FROM PageView
    WHERE createdAt >= ${since}
    GROUP BY DATE(createdAt)
    ORDER BY day ASC
  `
  return rows.map((r) => ({
    day:       r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day),
    pageviews: Number(r.pageviews) || 0,
  }))
}

exports.getDeviceBreakdown = async ({ daysBack = 30 } = {}) => {
  const rows = await prisma.pageView.groupBy({
    by:     ["device"],
    where:  rangeWhere(daysBack),
    _count: { _all: true },
  })
  return rows.map((r) => ({ device: r.device || "unknown", views: r._count._all }))
}

exports.getRecentEvents = async ({ daysBack = 7, limit = 100 } = {}) =>
  prisma.analyticsEvent.findMany({
    where:    rangeWhere(daysBack),
    orderBy:  { createdAt: "desc" },
    take:     Math.min(500, Math.max(1, Number(limit) || 100)),
  })
