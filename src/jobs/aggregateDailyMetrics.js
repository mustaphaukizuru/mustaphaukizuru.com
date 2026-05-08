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
const logger = require("../utils/logger")

/**
 * Aggregate a specific day (YYYY-MM-DD) into DailyMetric.
 * Defaults to "yesterday" in server time.
 */
async function aggregateDailyMetrics({ date } = {}) {
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

module.exports = { aggregateDailyMetrics, backfill }
