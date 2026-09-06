/**
 * src/jobs/aggregateDailyMetrics.js · M14
 *
 * Rolls a single day's PageView + AnalyticsEvent rows into one DailyMetric
 * row. Idempotent — safe to re-run for the same date; existing rows are
 * upserted, not duplicated.
 *
 * Why pre-aggregate? The admin dashboard currently runs aggregations
 * directly against PageView / AnalyticsEvent at request time, which is
 * fine up to ~1M rows but degrades after that. With this job running
 * nightly, the dashboard can switch to reading DailyMetric for any range
 * older than today (today still queries the live tables).
 *
 * Scheduling: see `src/jobs/scheduler.js` — runs at 00:15 server-time
 * every day, rolling up the previous calendar day.
 */

const prisma = require("../lib/prisma")
const { isAlive, recycle } = require("../lib/prisma")
const logger = require("../utils/logger")

/* ── T3-6 · real-user Web Vitals ────────────────────────────────────────── */

/**
 * The 75th percentile, by the nearest-rank method.
 *
 * p75 rather than a mean, because Core Web Vitals is DEFINED at p75 and
 * because a mean is actively misleading here: the question is whether the
 * slow quarter of visits is bad, and an average hides exactly those behind
 * the fast ones. One 12-second load among twenty fast ones barely moves a
 * mean and is the whole story.
 *
 * Nearest-rank rather than interpolation: with the sample counts a site this
 * size produces, interpolating invents precision that is not there.
 */
function p75(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.ceil(0.75 * sorted.length)
  return sorted[Math.max(0, rank - 1)]
}

/**
 * A p75 taken over a handful of measurements is noise wearing a statistic's
 * clothes. Rows below this are still written — the admin table shows the
 * sample count and greys them — but nothing is inferred from them.
 */
const MIN_MEANINGFUL_SAMPLES = 5

/**
 * Roll one day's `vital` events into DailyVital, one row per
 * (day, route, metric).
 *
 * Idempotent by upsert on that triple, like the metric rollup above: a
 * re-run for the same day overwrites rather than duplicating.
 */
async function aggregateDailyVitals({ dayStart, dayEnd, isoDay }) {
  const rows = await prisma.analyticsEvent.findMany({
    where:  { name: "vital", createdAt: { gte: dayStart, lt: dayEnd } },
    select: { path: true, meta: true },
  })
  if (!rows.length) return 0

  // path → metric → values
  const buckets = new Map()
  for (const row of rows) {
    const path = row.path || "/"
    // The event validator already refused anything malformed, but this reads
    // a JSON column written by a public endpoint — so it checks again rather
    // than trusting that the row on disk was written by today's code.
    const metric = row.meta?.metric
    const value = Number(row.meta?.value)
    if (!metric || !Number.isFinite(value)) continue
    if (!buckets.has(path)) buckets.set(path, new Map())
    const byMetric = buckets.get(path)
    if (!byMetric.has(metric)) byMetric.set(metric, [])
    byMetric.get(metric).push(value)
  }

  let written = 0
  for (const [path, byMetric] of buckets) {
    for (const [metric, values] of byMetric) {
      const value = p75(values)
      if (value == null) continue
      await prisma.dailyVital.upsert({
        where:  { date_path_metric: { date: dayStart, path: path.slice(0, 255), metric } },
        create: { date: dayStart, path: path.slice(0, 255), metric, p75: value, samples: values.length },
        update: { p75: value, samples: values.length },
      })
      written += 1
    }
  }

  logger.info(`[analytics-cron] vitals ${isoDay} · ${written} route/metric rows from ${rows.length} measurements`)
  return written
}

/**
 * Aggregate a specific day (YYYY-MM-DD) into DailyMetric.
 * Defaults to "yesterday" in server time.
 *
 * Connection health gate (added after the May 2026 stale-socket incident):
 * This job fires once a day at 00:15. After 23h+ of idle pool, the
 * Hostinger MySQL socket is guaranteed dead. We probe before the heavy
 * Promise.all() block and recycle the engine if needed; otherwise the
 * first sub-query would panic and abort the whole rollup.
 */
async function aggregateDailyMetrics({ date } = {}) {
  if (!(await isAlive())) {
    await recycle()
    if (!(await isAlive())) {
      logger.warn("[aggregateDailyMetrics] DB unreachable after recycle — skipping")
      return null
    }
  }
  // Default to yesterday in server-local time
  const target = date ? new Date(date) : new Date(Date.now() - 86_400_000)
  // Normalize to UTC midnight bounds for the target day
  const dayStart = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate(), 0, 0, 0, 0))
  const dayEnd   = new Date(dayStart.getTime() + 86_400_000)
  const isoDay   = dayStart.toISOString().slice(0, 10)

  const [pageviews, sessionsAgg, addToCart, beginCheckout, purchases, revenueAgg, topPathRows] = await Promise.all([
    prisma.pageView.count({ where: { createdAt: { gte: dayStart, lt: dayEnd } } }),

    prisma.pageView.findMany({
      where:    { createdAt: { gte: dayStart, lt: dayEnd } },
      select:   { sessionHash: true },
      distinct: ["sessionHash"],
    }),

    prisma.analyticsEvent.count({ where: { createdAt: { gte: dayStart, lt: dayEnd }, name: "add_to_cart" } }),
    prisma.analyticsEvent.count({ where: { createdAt: { gte: dayStart, lt: dayEnd }, name: "begin_checkout" } }),
    prisma.analyticsEvent.count({ where: { createdAt: { gte: dayStart, lt: dayEnd }, name: "purchase" } }),

    prisma.analyticsEvent.aggregate({
      where: { createdAt: { gte: dayStart, lt: dayEnd }, name: "purchase" },
      _sum:  { amount: true },
    }),

    prisma.pageView.groupBy({
      by:       ["path"],
      where:    { createdAt: { gte: dayStart, lt: dayEnd } },
      _count:   { _all: true },
      orderBy:  { _count: { path: "desc" } },
      take:     1,
    }),
  ])

  const sessions = sessionsAgg.length
  const revenue  = Number(revenueAgg._sum.amount || 0)
  const topPath  = topPathRows[0]?.path || null

  // Upsert by date — re-running for the same day overwrites cleanly.
  const row = await prisma.dailyMetric.upsert({
    where: { date: dayStart },
    create: {
      date:           dayStart,
      pageviews,
      sessions,
      addToCart,
      beginCheckout,
      purchases,
      revenue,
      topPath,
    },
    update: {
      pageviews,
      sessions,
      addToCart,
      beginCheckout,
      purchases,
      revenue,
      topPath,
    },
  })

  // T3-6 · after the metric row, and never allowed to fail it: the vitals
  // rollup is a nicety, the day's pageview and revenue counts are not.
  await aggregateDailyVitals({ dayStart, dayEnd, isoDay })
    .catch((err) => logger.error(`[analytics-cron] vitals rollup failed for ${isoDay}: ${err.message}`))

  logger.info(
    `[analytics-cron] aggregated ${isoDay} · pv=${pageviews} sessions=${sessions} ` +
    `purchases=${purchases} revenue=${revenue.toFixed(2)} topPath=${topPath || "—"}`
  )

  return row
}

/**
 * Backfill a range of days (inclusive). Useful one-shot via:
 *   node -e "require('./src/jobs/aggregateDailyMetrics').backfill(30)"
 */
async function backfill(daysBack = 30) {
  const results = []
  for (let i = 1; i <= daysBack; i++) {
    const target = new Date(Date.now() - i * 86_400_000)
    try {
      const row = await aggregateDailyMetrics({ date: target })
      results.push(row)
    } catch (err) {
      logger.error(`[analytics-cron] backfill failed for ${target.toISOString().slice(0, 10)}`, err)
    }
  }
  return results
}

module.exports = { aggregateDailyMetrics, aggregateDailyVitals, backfill, p75, MIN_MEANINGFUL_SAMPLES }
