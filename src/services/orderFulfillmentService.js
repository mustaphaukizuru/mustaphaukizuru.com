const prisma = require("../lib/prisma")
const { ensureInvoice } = require("./invoiceService")
const { notifyProjectCreated } = require("./notificationService")

/**
 * Default milestone scaffold seeded on every newly auto-created ClientProject.
 * Five generic phases covering the full engagement lifecycle — admins can
 * add, rename, delete, or reorder milestones from the admin project page;
 * this is just the day-zero starting point so the customer sees a populated
 * timeline immediately after payment rather than an empty page.
 */
const MILESTONE_SCAFFOLD = [
  { title: "Discovery & Planning", description: "Requirements gathering, scope confirmation, and kickoff alignment." },
  { title: "Design",                description: "Wireframes, visual design, and stakeholder review." },
  { title: "Development",           description: "Implementation, integrations, and iterative reviews." },
  { title: "QA & Testing",          description: "Cross-device QA, accessibility checks, and final corrections." },
  { title: "Launch",                description: "Deployment, handoff documentation, and post-launch support." },
]

/**
 * Seed the default 5-stage milestone scaffold on a freshly created project.
 * Caller guarantees the project has zero milestones — only invoke from the
 * branch of autoCreateClientProjectsForOrder where `clientProject.create`
 * just succeeded (not P2002'd). Idempotency is enforced by that branch,
 * not by a unique constraint on (projectId, title).
 */
async function seedMilestoneScaffold(projectId) {
  if (!projectId) return 0
  try {
    const result = await prisma.projectMilestone.createMany({
      data: MILESTONE_SCAFFOLD.map((m, i) => ({
        projectId,
        title:       m.title,
        description: m.description,
        status:      "pending",
        sortOrder:   i,
      })),
    })
    return result.count
  } catch (e) {
    console.error(`[fulfillOrder] milestone scaffold failed for project ${projectId}:`, e.message)
    return 0
  }
}

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
    // Tier 4 · an order born from an accepted change request belongs to an
    // EXISTING project (the quote's milestone already lives there) — never
    // open a second workspace for it.
    const fromChangeRequest = await prisma.changeRequest
      .findFirst({ where: { orderId }, select: { id: true } })
      .catch(() => null)
    if (fromChangeRequest) return 0

    const serviceOrders = await prisma.serviceOrder.findMany({
      where:   { orderId },
      include: { service: { select: { id: true, title: true } } },
    })
    for (const so of serviceOrders) {
      try {
        const project = await prisma.clientProject.create({
          data: {
            serviceOrderId: so.id,
            userId,
            projectName:    so.service?.title || "New project",
            projectStatus:  "planning",
            description:    null,
          },
        })
        created++

        // Freshly created project — seed the milestone scaffold and notify
        // the client. Both are best-effort: failures here don't bounce the
        // webhook because the project itself is already persisted. The
        // P2002 branch below skips both side-effects on re-runs, which is
        // the correct behaviour (we don't want duplicate scaffolds or
        // repeat notifications on webhook retries).
        await seedMilestoneScaffold(project.id).catch(() => 0)
        await notifyProjectCreated(userId, project).catch(() => null)
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
