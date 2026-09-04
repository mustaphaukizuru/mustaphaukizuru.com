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
const { parsePendingPaymentDetails } = require("../services/mercadoPagoService")

const DEFAULT_HOURS = Number(process.env.STALE_ORDER_HOURS || 24) // kept in sync with the Mercado Pago preference TTL
const BATCH = 500
// Grace after an OXXO / SPEI voucher expires before the order is swept, so
// a payment made at the last minute has time to reach us via webhook.
const OFFLINE_GRACE_HOURS = 6

/**
 * An order whose latest payment is an unexpired OXXO / SPEI voucher is NOT
 * stale even if it is older than `hours`: the buyer may still pay it at the
 * store. The voucher's own `date_of_expiration` (persisted on the Payment
 * row by paymentTransitionService) is the source of truth; when MP did not
 * send one we fall back to MP_CASH_EXPIRY_HOURS from the payment's creation.
 */
function offlineHoldUntil(order, now) {
  const latest = order.payments?.[0]
  const details = parsePendingPaymentDetails(latest)
  if (!details) return null
  const cashHours = Number(process.env.MP_CASH_EXPIRY_HOURS) > 0 ? Number(process.env.MP_CASH_EXPIRY_HOURS) : 72
  const expires = details.expiresAt ? new Date(details.expiresAt) : null
  const base = expires && !Number.isNaN(expires.getTime())
    ? expires
    : new Date(new Date(latest.createdAt || now).getTime() + cashHours * 60 * 60 * 1000)
  return new Date(base.getTime() + OFFLINE_GRACE_HOURS * 60 * 60 * 1000)
}

async function cancelStaleOrders({ hours = DEFAULT_HOURS, dryRun = false } = {}) {
  const now    = Date.now()
  const cutoff = new Date(now - hours * 60 * 60 * 1000)

  // Manual invoices (Tier 4) are pending orders by design — they live until
  // their due date and the dunning job, never this janitor.
  //
  // The name stays `scanned` (this branch's): the offline-hold filter below
  // derives `candidates` from it, and the returned counts distinguish the two.
  const scanned = await prisma.order.findMany({
    where:   { status: "pending", paidAt: null, createdAt: { lt: cutoff }, invoices: { none: {} } },
    select:  {
      id: true, orderNumber: true, customerEmail: true, couponId: true, createdAt: true,
      // Needed by offlineHoldUntil(): an OXXO voucher or SPEI transfer is
      // legitimately pending until it expires, so the janitor must read the
      // latest payment before deciding anything is stale.
      payments: {
        orderBy: { createdAt: "desc" },
        take:    1,
        select:  { paymentStatus: true, failureReason: true, createdAt: true },
      },
    },
    orderBy: { createdAt: "asc" },
    take:    BATCH,
  })

  let held = 0
  const candidates = scanned.filter((o) => {
    const holdUntil = offlineHoldUntil(o, now)
    if (holdUntil && holdUntil.getTime() > now) { held += 1; return false }
    return true
  })

  if (candidates.length === 0) return { scanned: scanned.length, cancelled: 0, couponsReleased: 0, held }
  if (dryRun) return { scanned: scanned.length, cancelled: 0, couponsReleased: 0, held, candidates }

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

  logger.info(`[janitor] cancelled ${cancelled}/${candidates.length} stale pending orders · coupons released ${couponsReleased} · held for offline vouchers ${held}`)
  return { scanned: scanned.length, cancelled, couponsReleased, held }
}

module.exports = { cancelStaleOrders, offlineHoldUntil }
