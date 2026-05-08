const prisma = require("../lib/prisma")
const { ensureInvoice } = require("./invoiceService")

/**
 * fulfillOrder — central hook that runs every time an order transitions to
 * PAID (from MercadoPago webhook, PayPal webhook, or admin manual mark-paid).
 *
 * Does the three post-payment jobs:
 *   1. Creates UserDownload entitlement rows for every product in the order
 *   2. Generates the invoice PDF (idempotent — no-op if it already exists)
 *   3. Writes an ActivityLog entry so the order timeline reflects the change
 *
 * Idempotent. Safe to call multiple times for the same order — duplicate
 * UserDownload rows are prevented by the @@unique([userId, productId, orderItemId])
 * constraint on the model; we catch and swallow those collisions.
 *
 * Never throws — fulfillment failures must not bounce a paid-status webhook
 * back to the gateway. All errors are logged and returned as a structured
 * result so the caller can observe them.
 *
 * @param {string} orderId
 * @returns {Promise<{ ok: boolean, entitlements: number, invoice: object|null, error?: string }>}
 */
async function fulfillOrder(orderId) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: { select: { id: true, isActive: true } },
          },
        },
      },
    })

    if (!order) return { ok: false, entitlements: 0, invoice: null, error: "Order not found" }
    if (!order.userId) {
      // Guest orders can't receive entitlements (no User row to link to).
      // Still generate the invoice so the guest has a record.
      const invoice = await ensureInvoice(order.id).catch(() => null)
      return { ok: true, entitlements: 0, invoice, error: "Guest order — no entitlements created" }
    }

    // 1 · Create UserDownload rows — one per product-type OrderItem.
    let entitlementCount = 0
    for (const item of order.items || []) {
      if (item.itemType !== "product" || !item.productId) continue

      try {
        await prisma.userDownload.create({
          data: {
            userId:      order.userId,
            productId:   item.productId,
            orderId:     order.id,
            orderItemId: item.id,
            // Leave downloadLimit null → unlimited per entitlement by default.
            // Per-download-per-user cap is enforced via ProductFile.maxDownloadsPerUser.
          },
        })
        entitlementCount++
      } catch (err) {
        // P2002 = unique-constraint violation — already fulfilled, skip silently.
        if (err?.code !== "P2002") {
          console.error(`[fulfillOrder] entitlement failed for item ${item.id}:`, err.message)
        }
      }
    }

    // 2 · Generate invoice (idempotent)
    const invoice = await ensureInvoice(order.id).catch((err) => {
      console.error(`[fulfillOrder] invoice generation failed for order ${order.id}:`, err.message)
      return null
    })

    // 3 · Activity log entry for the order timeline
    await prisma.activityLog.create({
      data: {
        userId:      order.userId,
        action:      "order.fulfilled",
        entityType:  "Order",
        entityId:    order.id,
        description: `Order ${order.orderNumber} fulfilled — ${entitlementCount} entitlement(s) created`,
      },
    }).catch(() => null)

    // 4 · Auto-create ClientProject for every ServiceOrder on this order so
    //     the customer immediately sees a project workspace under
    //     /dashboard/projects after payment. Idempotent: ClientProject has
    //     a @unique constraint on serviceOrderId so duplicates are P2002s
    //     we silently swallow.
    const projectsCreated = await autoCreateClientProjectsForOrder(order.id, order.userId)

    return { ok: true, entitlements: entitlementCount, invoice, projectsCreated }
  } catch (err) {
    console.error(`[fulfillOrder] unexpected error for order ${orderId}:`, err.message)
    return { ok: false, entitlements: 0, invoice: null, error: err.message }
  }
}

/**
 * recordOrderEvent — append an ActivityLog entry describing a state change.
 * Use from webhooks / admin actions so the timeline stays accurate without
 * every call-site needing to know the ActivityLog schema.
 *
 * @param {{ orderId: string, userId?: string|null, action: string, description?: string, ipAddress?: string }} input
 */
async function recordOrderEvent({ orderId, userId = null, action, description, ipAddress }) {
  if (!orderId || !action) return null
  return prisma.activityLog.create({
    data: {
      userId:      userId || null,
      action,
      entityType:  "Order",
      entityId:    orderId,
      description: description || null,
      ipAddress:   ipAddress || null,
    },
  }).catch(() => null)
}

/**
 * autoCreateClientProjectsForOrder · runs as part of fulfillOrder.
 * Idempotent — ClientProject @unique on serviceOrderId catches re-runs.
 */
async function autoCreateClientProjectsForOrder(orderId, userId) {
  if (!orderId || !userId) return 0
  let created = 0
  try {
    const serviceOrders = await prisma.serviceOrder.findMany({
      where:   { orderId },
      include: { service: { select: { id: true, title: true } } },
    })
    for (const so of serviceOrders) {
      try {
        await prisma.clientProject.create({
          data: {
            serviceOrderId: so.id,
            userId,
            projectName:    so.service?.title || "New project",
            projectStatus:  "planning",
            description:    null,
          },
        })
        created++
      } catch (e) {
        if (e?.code !== "P2002") {
          console.error(`[fulfillOrder] auto-project failed for serviceOrder ${so.id}:`, e.message)
        }
      }
    }
  } catch (e) {
    console.error(`[fulfillOrder] auto-project sweep failed for order ${orderId}:`, e.message)
  }
  return created
}

module.exports = {
  fulfillOrder,
  recordOrderEvent,
  autoCreateClientProjectsForOrder,
}
