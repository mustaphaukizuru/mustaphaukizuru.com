/**
 * adminRevenueService.js — Tier 4 revenue reporting.
 *
 * One read model for the admin "Revenue" panel:
 *   - monthly series of paid orders bucketed by `paidAt` (gross, refunded, net, count)
 *   - per-service and per-package performance (service line items joined to
 *     ServiceOrder.servicePackage for the package name)
 *   - top-10 products by revenue
 *   - refund rate, AOV
 *   - `mrr: null` — there is NO recurrence engine in this codebase. A
 *     ServicePackage labelled "subscription" is a one-off order like any other;
 *     reporting it as MRR would be fiction. Never fake this number.
 *
 * Bounds
 * ------
 * Orders are loaded with `take: MAX_ORDERS` (newest paid first). The catalogue
 * is small (tens of orders a month, not thousands), so 5 000 paid orders cover
 * years of history; if the store ever outgrows that the series is still
 * correct for the newest orders and `truncated: true` tells the UI.
 *
 * Status filter: `paid` OR `refunded`. Refunds are full-only and flip the
 * order to `refunded` (refundService), so a strict `status = paid` filter
 * could never show a refunded month. Both carry a `paidAt`, which is the
 * bucketing key — an order counts in the month the money arrived.
 */

const prisma = require("../lib/prisma")

const MAX_ORDERS = 5000 // bound — see header
const DEFAULT_MONTHS = 12
const MAX_MONTHS = 36

const num = (v) => (v == null ? 0 : Number(v)) || 0
const round2 = (v) => Math.round(v * 100) / 100

/** "YYYY-MM" in UTC — the same key for bucketing and for zero-filling. */
function monthKey(d) {
  const dt = d instanceof Date ? d : new Date(d)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`
}

/** First instant (UTC) of the month `months - 1` months before `now`. */
function rangeStart(months, now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1))
}

/** Ordered list of month keys from `start` up to and including `now`'s month. */
function monthKeys(start, now = new Date()) {
  const keys = []
  let y = start.getUTCFullYear()
  let m = start.getUTCMonth()
  const endKey = monthKey(now)
  for (let i = 0; i < MAX_MONTHS + 1; i += 1) {
    const key = monthKey(new Date(Date.UTC(y, m, 1)))
    keys.push(key)
    if (key === endKey) break
    m += 1
    if (m > 11) { m = 0; y += 1 }
  }
  return keys
}

function lineRevenue(item) {
  if (item.lineTotal != null) return num(item.lineTotal)
  const unit = item.unitPrice != null ? num(item.unitPrice) : num(item.price)
  return unit * (num(item.quantity) || 1)
}

function clampMonths(months) {
  const n = Number(months)
  if (!Number.isFinite(n)) return DEFAULT_MONTHS
  return Math.min(MAX_MONTHS, Math.max(1, Math.floor(n)))
}

/**
 * @param {object} [opts]
 * @param {number} [opts.months=12]  1..36
 * @param {Date}   [opts.now]        injectable clock (tests)
 */
async function getRevenueReport({ months = DEFAULT_MONTHS, now = new Date() } = {}) {
  const span = clampMonths(months)
  const since = rangeStart(span, now)

  const orders = await prisma.order.findMany({
    where: { paidAt: { gte: since }, status: { in: ["paid", "refunded"] } },
    orderBy: { paidAt: "desc" },
    take: MAX_ORDERS, // bounded read — see header comment
    select: {
      id: true, totalAmount: true, currency: true, paidAt: true, status: true,
      items: {
        select: {
          id: true, itemType: true, productId: true, serviceId: true, title: true,
          price: true, unitPrice: true, quantity: true, lineTotal: true,
        },
      },
      refunds: { where: { refundStatus: "succeeded" }, select: { amount: true } },
      serviceOrders: {
        select: {
          orderItemId: true, servicePackageId: true,
          servicePackage: { select: { name: true } },
        },
      },
    },
  })

  // ── Monthly series (zero-filled) ─────────────────────────────────────
  const buckets = new Map(monthKeys(since, now).map((k) => [k, { month: k, gross: 0, refunded: 0, net: 0, count: 0 }]))
  const services = new Map()
  const packages = new Map()
  const products = new Map()

  let gross = 0
  let refunded = 0
  let refundedOrders = 0
  let currency = null

  for (const order of orders) {
    const total = num(order.totalAmount)
    const orderRefund = order.refunds.reduce((s, r) => s + num(r.amount), 0)
    currency = currency || order.currency || null

    const key = monthKey(order.paidAt)
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.gross += total
      bucket.refunded += orderRefund
      bucket.count += 1
    }
    gross += total
    refunded += orderRefund
    if (orderRefund > 0) refundedOrders += 1

    const packageByItem = new Map(order.serviceOrders.map((so) => [so.orderItemId, so]))

    for (const item of order.items) {
      const revenue = lineRevenue(item)
      if (item.itemType === "service") {
        const sKey = item.serviceId || `title:${item.title}`
        const s = services.get(sKey) || { serviceId: item.serviceId || null, name: item.title, revenue: 0, count: 0 }
        s.revenue += revenue; s.count += 1
        services.set(sKey, s)

        const so = packageByItem.get(item.id)
        if (so?.servicePackageId) {
          const p = packages.get(so.servicePackageId) || {
            servicePackageId: so.servicePackageId,
            name: so.servicePackage?.name || item.title,
            serviceName: item.title,
            revenue: 0, count: 0,
          }
          p.revenue += revenue; p.count += 1
          packages.set(so.servicePackageId, p)
        }
      } else {
        const pKey = item.productId || `title:${item.title}`
        const p = products.get(pKey) || { productId: item.productId || null, title: item.title, revenue: 0, count: 0 }
        p.revenue += revenue; p.count += num(item.quantity) || 1
        products.set(pKey, p)
      }
    }
  }

  const series = [...buckets.values()].map((b) => ({
    ...b, gross: round2(b.gross), refunded: round2(b.refunded), net: round2(b.gross - b.refunded),
  }))

  const byRevenue = (a, b) => b.revenue - a.revenue
  const finish = (row) => ({ ...row, revenue: round2(row.revenue) })
  const count = orders.length

  return {
    months: span,
    from: since.toISOString(),
    to: now.toISOString(),
    currency,
    truncated: count >= MAX_ORDERS,
    kpis: {
      orders: count,
      gross: round2(gross),
      refunded: round2(refunded),
      net: round2(gross - refunded),
      aov: count ? round2(gross / count) : 0,
      refundedOrders,
      refundRate: count ? round2((refundedOrders / count) * 100) : 0,       // % of paid orders refunded
      refundAmountRate: gross ? round2((refunded / gross) * 100) : 0,      // % of gross returned
      mrr: null,
      mrrNote: "No recurrence engine — every order is one-off, so MRR cannot be computed. The 'subscription' package label is not a billing schedule.",
    },
    series,
    services: [...services.values()].sort(byRevenue).map(finish),
    packages: [...packages.values()].sort(byRevenue).map(finish),
    topProducts: [...products.values()].sort(byRevenue).slice(0, 10).map(finish),
  }
}

module.exports = { getRevenueReport, monthKey, rangeStart, monthKeys, MAX_ORDERS, MAX_MONTHS }
