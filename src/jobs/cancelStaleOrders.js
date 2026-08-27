/**
 * src/jobs/cancelStaleOrders.js · pending-order janitor
 *
 * CheckoutPage creates the Order row before the buyer picks a gateway, so an
 * abandoned tab leaves a `pending` order forever. This job moves pending
 * orders older than `hours` to `cancelled` and RELEASES any coupon they
 * consumed (usedCount decrement + CouponUsage row removal), so a single-use
 * coupon is not burnt by a checkout that never paid.
 *
 * Safe to re-run and to overlap: every write re-checks status/paidAt inside
 * the WHERE, so a webhook that flips an order to paid mid-sweep wins.
 * Runs hourly from scheduler.js; also callable from scripts/cancel-stale-orders.js.
 */
const prisma = require("../lib/prisma")
const logger = require("../utils/logger")

const DEFAULT_HOURS = 24
const BATCH = 500

async function cancelStaleOrders({ hours = DEFAULT_HOURS, dryRun = false } = {}) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)

  // Manual invoices (Tier 4) are pending orders by design — they live until
  // their due date and the dunning job, never this janitor.
  const candidates = await prisma.order.findMany({
    where:   { status: "pending", paidAt: null, createdAt: { lt: cutoff }, invoices: { none: {} } },
    select:  { id: true, orderNumber: true, customerEmail: true, couponId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take:    BATCH,
  })
  if (candidates.length === 0) return { scanned: 0, cancelled: 0, couponsReleased: 0 }
  if (dryRun) return { scanned: candidates.length, cancelled: 0, couponsReleased: 0, candidates }

  let cancelled = 0
  let couponsReleased = 0

  for (const o of candidates) {
    // One small transaction per order keeps the lock footprint tiny and lets
    // a single bad row fail without aborting the sweep.
    try {
      await prisma.$transaction(async (tx) => {
        const res = await tx.order.updateMany({
          where: { id: o.id, status: "pending", paidAt: null },
          data:  { status: "cancelled" },
        })
        if (res.count !== 1) return // paid or already cancelled meanwhile

        cancelled += 1
        if (o.couponId) {
          await tx.couponUsage.deleteMany({ where: { orderId: o.id } })
          const rel = await tx.coupon.updateMany({
            where: { id: o.couponId, usedCount: { gt: 0 } },
            data:  { usedCount: { decrement: 1 } },
          })
          if (rel.count === 1) couponsReleased += 1
        }
      })
    } catch (err) {
      logger.error(`[janitor] failed to cancel order ${o.orderNumber}: ${err.message}`)
    }
  }

  logger.info(`[janitor] cancelled ${cancelled}/${candidates.length} stale pending orders · coupons released ${couponsReleased}`)
  return { scanned: candidates.length, cancelled, couponsReleased }
}

module.exports = { cancelStaleOrders }
