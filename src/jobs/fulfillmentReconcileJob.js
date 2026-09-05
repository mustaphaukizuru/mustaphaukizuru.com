/**
 * src/jobs/fulfillmentReconcileJob.js
 *
 * Catches paid orders whose fulfilment never ran.
 *
 * WHY
 * ---
 * Both gateway controllers call `fulfillOrder()` fire-and-forget after the
 * webhook is already marked processed. If the process dies (Passenger
 * restart, deploy, OOM) between "order → paid" and "entitlements written",
 * the customer has paid and has nothing, and the gateway will never retry
 * because we answered 200. Nothing else in the system would ever notice.
 *
 * WHAT
 * ----
 * Every 15 minutes: paid orders older than QUIET_MINUTES (so an in-flight
 * fulfilment is not raced) and newer than LOOKBACK_DAYS that carry no
 * `order.fulfilled` ActivityLog row are handed back to `fulfillOrder()`,
 * which is idempotent by construction (P2002-swallowed entitlements,
 * ensureInvoice, unique ClientProject per ServiceOrder).
 *
 * The ActivityLog marker is what fulfilment writes on success, so "no row"
 * is the exact signal of "never completed". Bounded batch; never throws.
 */

const prisma = require("../lib/prisma")
const logger = require("../utils/logger")
const { fulfillOrder } = require("../services/orderFulfillmentService")

const QUIET_MINUTES = 5
const LOOKBACK_DAYS = 7
const BATCH_SIZE    = 100

async function runFulfillmentReconcilePass({ now = new Date(), batchSize = BATCH_SIZE } = {}) {
  const summary = { scanned: 0, missing: 0, fulfilled: 0, failed: 0 }

  let orders = []
  try {
    orders = await prisma.order.findMany({
      where: {
        status: "paid",
        paidAt: {
          lte: new Date(now.getTime() - QUIET_MINUTES * 60 * 1000),
          gte: new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000),
        },
      },
      select:  { id: true, orderNumber: true },
      orderBy: { paidAt: "asc" },
      take:    batchSize,
    })
  } catch (err) {
    logger.error("[fulfillmentReconcile] order scan failed", err)
    return summary
  }
  summary.scanned = orders.length
  if (!orders.length) return summary

  let markers = []
  try {
    markers = await prisma.activityLog.findMany({
      where:  { action: "order.fulfilled", entityType: "Order", entityId: { in: orders.map((o) => o.id) } },
      select: { entityId: true },
    })
  } catch (err) {
    logger.error("[fulfillmentReconcile] marker scan failed", err)
    return summary
  }
  const done = new Set(markers.map((m) => m.entityId))
  const missing = orders.filter((o) => !done.has(o.id))
  summary.missing = missing.length
  if (!missing.length) return summary

  for (const order of missing) {
     
    const result = await fulfillOrder(order.id)
    if (result?.ok) {
      summary.fulfilled += 1
      logger.warn(`[fulfillmentReconcile] recovered order ${order.orderNumber || order.id}: ${result.entitlements} entitlement(s)`)
    } else {
      summary.failed += 1
      logger.error(`[fulfillmentReconcile] order ${order.orderNumber || order.id} still unfulfilled: ${result?.error || "unknown"}`)
    }
  }

  logger.info(`[fulfillmentReconcile] scanned=${summary.scanned} missing=${summary.missing} fulfilled=${summary.fulfilled} failed=${summary.failed}`)
  return summary
}

module.exports = { runFulfillmentReconcilePass, QUIET_MINUTES, LOOKBACK_DAYS, BATCH_SIZE }
