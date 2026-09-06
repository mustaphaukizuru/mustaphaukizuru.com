// =============================================================
// analyticsService.js · privacy-first analytics (M14)
// Server-side, cookieless. No PII collected.
// Session is identified by a SHA-256 hash of (IP + UA + day-bucket).
// =============================================================

const crypto   = require("crypto")
const prisma   = require("../lib/prisma")
const AppError = require("../utils/AppError")

// The salt is what makes the session hash irreversible: HMAC(ip|ua|day)
// under a public or guessable key is a lookup table away from the IP. There
// used to be a literal fallback here, so a deploy without the variable
// hashed every visitor with a string that sits in this repository. Boot now
// refuses without it (config/env.js REQUIRED_ENV); this read is the
// fail-closed guard for anything that bypasses env.js — a script, a job —
// so no row is ever written under a weak salt. It is read per call rather
// than at module load so that importing the module never throws.
const MIN_SALT_LENGTH = 32

function hashSecret() {
  const salt = process.env.ANALYTICS_HASH_SALT || ""
  if (salt.length < MIN_SALT_LENGTH) {
    throw new AppError(
      `ANALYTICS_HASH_SALT must be set to at least ${MIN_SALT_LENGTH} characters before analytics can hash visitor data`,
      { statusCode: 500, code: "ANALYTICS_SALT_MISSING" },
    )
  }
  return salt
}

// ---- Hash helpers ----------------------------------------------

function sha(input) {
  return crypto.createHmac("sha256", hashSecret()).update(String(input)).digest("hex").slice(0, 32)
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

// Exported for the salt guard tests; not part of the controller surface.
exports.buildSessionHash = buildSessionHash
exports.MIN_SALT_LENGTH  = MIN_SALT_LENGTH

// ---- Write paths ----------------------------------------------
//
// Both write paths swallow their own errors. Analytics is best-effort by
// design — the controller already promises a 204 regardless of write
// success ("Never block the page render on analytics"). The previous
// implementation broke that promise: a Prisma engine PANIC (e.g. the
// "timer has gone away" tokio bug seen on multi-worker startup on
// Hostinger Passenger) propagated up through asyncHandler and bubbled
// out as a 500, taking the page render down with it.
//
// We deliberately do NOT rethrow — a one-off analytics miss is a strictly
// better failure mode than a request crash. Errors are logged (with rate-
// limited noise via the tag) so they're still observable.

exports.trackPageView = async (req, { path, referrer, country }) => {
  if (!path || typeof path !== "string") return null
  try {
    return await prisma.pageView.create({
      data: {
        path:         String(path).slice(0, 512),
        referrer:     referrer ? String(referrer).slice(0, 512) : null,
        country:      country  ? String(country).slice(0, 8)    : null,
        device:       detectDevice(req.headers["user-agent"]),
        uaHash:       buildUaHash(req),
        sessionHash:  buildSessionHash(req),
      },
    })
  } catch (err) {
     
    console.error("[analytics] trackPageView failed:", err?.message || err)
    return null
  }
}

/**
 * T3-6 · the shape a `vital` event must have to be stored.
 *
 * Validated rather than trusted: this is a public, unauthenticated endpoint,
 * and the rollup reads meta.value as a number straight out of the JSON
 * column. A string, a negative, or an unknown metric name there would
 * surface later as a nonsense p75 on the admin page with no way to tell
 * where it came from.
 */
const VITAL_METRICS = ["LCP", "CLS", "INP"]
const VITAL_RATINGS = ["good", "needs-improvement", "poor"]
/** LCP and INP in ms; anything past an hour is a broken clock, not a slow page. */
const VITAL_MAX = 3_600_000

function normalizeVital(meta) {
  if (!meta || typeof meta !== "object") return null
  const metric = String(meta.metric || "")
  if (!VITAL_METRICS.includes(metric)) return null
  // typeof, not Number(): Number(null) is 0, Number("") is 0 and Number([])
  // is 0, so a missing value would have been stored as a PERFECT score and
  // dragged every p75 down with it. The client sends a JSON number or
  // nothing.
  if (typeof meta.value !== "number") return null
  const value = meta.value
  if (!Number.isFinite(value) || value < 0 || value > VITAL_MAX) return null
  const rating = VITAL_RATINGS.includes(meta.rating) ? meta.rating : null
  return { metric, value, rating }
}

exports.trackEvent = async (req, payload = {}) => {
  const { name } = payload
  if (!name || typeof name !== "string") return null

  // A `vital` with an unusable body is dropped rather than stored as a row
  // the rollup has to defend against every night.
  let meta = payload.meta && typeof payload.meta === "object" ? payload.meta : null
  if (name === "vital") {
    meta = normalizeVital(meta)
    if (!meta) return null
  }
  try {
    return await prisma.analyticsEvent.create({
      data: {
        name:         String(name).slice(0, 64),
        path:         payload.path      ? String(payload.path).slice(0, 512) : null,
        productId:    payload.productId || null,
        serviceId:    payload.serviceId || null,
        orderId:      payload.orderId   || null,
        amount:       payload.amount != null ? Number(payload.amount) : null,
        meta,
        sessionHash:  buildSessionHash(req),
      },
    })
  } catch (err) {
     
    console.error("[analytics] trackEvent failed:", err?.message || err)
    return null
  }
}

exports.normalizeVital = normalizeVital
exports.VITAL_METRICS = VITAL_METRICS

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

/**
 * T3-6 · field vitals, p75 per route per metric over a window.
 *
 * Reads the rolled-up DailyVital rows, then takes the p75 of the daily p75s
 * per route. That is an approximation and it is the honest one available:
 * the raw measurements are not kept per-day beyond the AnalyticsEvent table,
 * and a p75 of p75s is what every RUM tool shows for a multi-day window. The
 * sample count is carried through so the page can say how much to trust it.
 */
exports.getFieldVitals = async ({ daysBack = 30, limit = 20 } = {}) => {
  const since = new Date(Date.now() - daysBack * 86_400_000)
  since.setUTCHours(0, 0, 0, 0)

  const rows = await prisma.dailyVital.findMany({
    where:   { date: { gte: since } },
    orderBy: { date: "desc" },
  })
  if (!rows.length) return []

  const byRoute = new Map()
  for (const row of rows) {
    if (!byRoute.has(row.path)) byRoute.set(row.path, { path: row.path, samples: 0, metrics: {} })
    const entry = byRoute.get(row.path)
    entry.samples += row.samples
    if (!entry.metrics[row.metric]) entry.metrics[row.metric] = []
    entry.metrics[row.metric].push(Number(row.p75))
  }

  const pick = (values) => {
    if (!values?.length) return null
    const sorted = [...values].sort((a, b) => a - b)
    return sorted[Math.max(0, Math.ceil(0.75 * sorted.length) - 1)]
  }

  return [...byRoute.values()]
    .map((entry) => ({
      path: entry.path,
      samples: entry.samples,
      lcp: pick(entry.metrics.LCP),
      cls: pick(entry.metrics.CLS),
      inp: pick(entry.metrics.INP),
    }))
    // Busiest routes first: a p75 on the page nobody visits is not the one
    // to act on.
    .sort((a, b) => b.samples - a.samples)
    .slice(0, limit)
}

exports.getRecentEvents = async ({ daysBack = 7, limit = 100 } = {}) =>
  prisma.analyticsEvent.findMany({
    where:    rangeWhere(daysBack),
    orderBy:  { createdAt: "desc" },
    take:     Math.min(500, Math.max(1, Number(limit) || 100)),
  })

/**
 * G4 · Funnel: view → add to cart → begin checkout → paid, in unique
 * sessions, with step-to-step conversion and where people drop.
 *
 * Counted per session (sessionHash), not per event, so a visitor who adds
 * three items is one "add to cart" — a funnel is about people, not clicks.
 * "View" is a pageview on a product page (/store/:slug); the store index
 * and cart are deliberately excluded so the first step means intent.
 * Sessions without a hash (very old rows) are ignored rather than merged
 * into one giant pseudo-session.
 */
const FUNNEL_STEPS = [
  { key: "view",          label: "Product view" },
  { key: "addToCart",     label: "Add to cart" },
  { key: "beginCheckout", label: "Begin checkout" },
  { key: "purchase",      label: "Paid" },
]

exports.getFunnel = async ({ daysBack = 30 } = {}) => {
  const where = rangeWhere(daysBack)
  const distinctSessions = (rows) => new Set(rows.map((r) => r.sessionHash).filter(Boolean)).size

  const [viewRows, cartRows, checkoutRows, paidRows] = await Promise.all([
    prisma.pageView.findMany({
      where: { ...where, path: { startsWith: "/store/" } },
      select: { sessionHash: true }, distinct: ["sessionHash"],
    }),
    prisma.analyticsEvent.findMany({
      where: { ...where, name: "add_to_cart" },
      select: { sessionHash: true }, distinct: ["sessionHash"],
    }),
    prisma.analyticsEvent.findMany({
      where: { ...where, name: "begin_checkout" },
      select: { sessionHash: true }, distinct: ["sessionHash"],
    }),
    prisma.analyticsEvent.findMany({
      where: { ...where, name: "purchase" },
      select: { sessionHash: true }, distinct: ["sessionHash"],
    }),
  ])

  const counts = [viewRows, cartRows, checkoutRows, paidRows].map(distinctSessions)
  const pct = (num, den) => (den > 0 ? Math.round((num / den) * 10_000) / 100 : 0)

  const steps = FUNNEL_STEPS.map((step, i) => ({
    key:         step.key,
    label:       step.label,
    sessions:    counts[i],
    // Conversion from the previous step; 100 for the first step by definition.
    stepRate:    i === 0 ? 100 : pct(counts[i], counts[i - 1]),
    // Conversion from the top of the funnel.
    overallRate: pct(counts[i], counts[0]),
    // Sessions lost between the previous step and this one.
    dropOff:     i === 0 ? 0 : Math.max(0, counts[i - 1] - counts[i]),
  }))

  // The step with the largest absolute loss is where a fix pays most.
  const biggest = steps.slice(1).reduce((worst, s) => (s.dropOff > (worst?.dropOff || 0) ? s : worst), null)

  return { steps, biggestDropOff: biggest ? biggest.key : null }
}
