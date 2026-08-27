const prisma = require("../lib/prisma")
const AppError = require("../utils/AppError")
const { computeOrderTax } = require("../lib/tax")
const logger = require("../utils/logger")

/**
 * Service orders go through the same Order pipeline as product orders — this
 * keeps payment, invoice, and audit flows unified. A service order is really:
 *
 *   Order
 *     └── OrderItem (itemType: "service")
 *           └── ServiceOrder (fulfillment record — status + schedule + notes)
 *
 * Schema constraints:
 *   - ServiceOrder.orderId      NOT NULL
 *   - ServiceOrder.orderItemId  NOT NULL + @unique
 *   - ServiceOrder.userId       NOT NULL
 * So we must create Order + OrderItem atomically before the ServiceOrder row.
 */

function safeNum(value, fallback = 0) {
  if (value == null) return fallback
  if (typeof value === "object" && typeof value.toNumber === "function") return value.toNumber()
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function generateOrderNumber() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const dd = String(now.getDate()).padStart(2, "0")
  const random = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `SRV-${yyyy}${mm}${dd}-${random}`
}

async function createUniqueOrderNumber() {
  for (let i = 0; i < 10; i += 1) {
    const orderNumber = generateOrderNumber()
    const existing = await prisma.order.findUnique({
      where:  { orderNumber },
      select: { id: true },
    })
    if (!existing) return orderNumber
  }
  throw new Error("Failed to generate a unique service order number")
}

/* ────────────────────────────────────────────────────────────────────────────
 * createServiceOrder — POST /api/services/:slug/order
 *
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} opts.slug
 * @param {string} opts.packageId
 * @param {string} [opts.requirements]        customer-supplied notes
 * @param {string} [opts.preferredStartDate]  ISO date string
 * @param {string} [opts.customerName]
 * @param {string} [opts.customerEmail]
 *
 * @returns {Promise<{ orderId, orderNumber, serviceOrderId, redirectUrl }>}
 * ──────────────────────────────────────────────────────────────────────────── */

async function createServiceOrder({ userId, slug, packageId, requirements, preferredStartDate, customerName, customerEmail }) {
  if (!userId) throw new AppError("Authentication required", { statusCode: 401, code: "AUTH_MISSING" })

  const service = await prisma.service.findFirst({
    where:   { slug, status: "published" },
    include: { packages: { where: { isActive: true } } },
  })
  if (!service) throw new AppError(`Service '${slug}' not found`, { statusCode: 404, code: "NOT_FOUND" })

  if (!packageId) throw new AppError("packageId is required", { statusCode: 400, code: "VALIDATION_ERROR" })

  const pkg = service.packages.find((p) => p.id === packageId)
  if (!pkg) throw new AppError(`Package not found or inactive for this service`, { statusCode: 404, code: "NOT_FOUND" })

  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { id: true, fullName: true, email: true },
  })
  if (!user) throw new AppError("User not found", { statusCode: 401, code: "AUTH_MISSING" })

  const resolvedName  = customerName  || user.fullName || "Customer"
  const resolvedEmail = customerEmail || user.email

  if (!resolvedEmail) {
    throw new AppError("A contact email is required", { statusCode: 400, code: "VALIDATION_ERROR" })
  }

  const unitPrice = safeNum(pkg.price)
  const lineTotal = unitPrice
  const orderNumber = await createUniqueOrderNumber()
  const tax = computeOrderTax({
    items: [{ lineTotal, taxExempt: Boolean(pkg.taxExempt ?? service.taxExempt) }],
    discount: 0,
  })

  // Transaction: Order → OrderItem → ServiceOrder
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orderNumber,
        userId,
        customerName:  resolvedName,
        customerEmail: resolvedEmail,
        subtotalAmount: unitPrice,
        taxRate:        tax.taxRate,
        taxAmount:      tax.taxAmount,
        taxIncluded:    true,
        totalAmount:    unitPrice,
        currency:       pkg.currency || service.currency || "MXN",
        status:         "pending",
        notes:          requirements || null,
      },
    })

    const orderItem = await tx.orderItem.create({
      data: {
        orderId:        order.id,
        itemType:       "service",
        serviceId:      service.id,
        title:          `${service.title} — ${pkg.name}`,
        titleSnapshot:  `${service.title} — ${pkg.name}`,
        descriptionSnapshot: pkg.description || null,
        price:          unitPrice,
        unitPrice,
        quantity:       1,
        lineTotal,
      },
    })

    const serviceOrder = await tx.serviceOrder.create({
      data: {
        orderId:          order.id,
        orderItemId:      orderItem.id,
        userId,
        serviceId:        service.id,
        servicePackageId: pkg.id,
        status:           "new",
        startDate:        preferredStartDate ? new Date(preferredStartDate) : null,
        notes:            requirements || null,
      },
    })

    return { order, orderItem, serviceOrder }
  })

  // ActivityLog + email hooks are fire-and-forget — failures don't undo the order
  prisma.activityLog.create({
    data: {
      userId,
      action:      "service_order.created",
      entityType:  "ServiceOrder",
      entityId:    result.serviceOrder.id,
      description: `Service order created: ${service.title} — ${pkg.name}`,
    },
  }).catch(() => null)

  return {
    orderId:        result.order.id,
    orderNumber:    result.order.orderNumber,
    serviceOrderId: result.serviceOrder.id,
    redirectUrl:    `/dashboard/service-orders/${result.serviceOrder.id}`,
    amount:         unitPrice,
    currency:       result.order.currency,
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Member queries
 * ──────────────────────────────────────────────────────────────────────────── */

async function listUserServiceOrders(userId) {
  const items = await prisma.serviceOrder.findMany({
    where:   { userId },
    orderBy: { createdAt: "desc" },
    include: {
      service:        { select: { id: true, title: true, slug: true, deliveryType: true } },
      servicePackage: { select: { id: true, name: true, price: true, currency: true } },
      order:          { select: { id: true, orderNumber: true, totalAmount: true, status: true, paidAt: true } },
    },
  })
  return items.map(serializeServiceOrder)
}

async function getUserServiceOrderById(userId, serviceOrderId) {
  const item = await prisma.serviceOrder.findFirst({
    where: { id: serviceOrderId, userId },
    include: {
      service: { include: { features: { orderBy: { sortOrder: "asc" } } } },
      servicePackage: true,
      order: { select: { id: true, orderNumber: true, totalAmount: true, status: true, paidAt: true, currency: true } },
      consultations: { orderBy: { scheduledAt: "asc" } },
      clientProject: {
        include: {
          milestones: { orderBy: { dueDate: "asc" } },
          files:      { orderBy: { createdAt: "desc" }, take: 20 },
        },
      },
    },
  })
  if (!item) return null
  return serializeServiceOrder(item, { detailed: true })
}

function serializeServiceOrder(row, { detailed = false } = {}) {
  if (!row) return null
  return {
    id:         row.id,
    status:     row.status,
    startDate:  row.startDate,
    endDate:    row.endDate,
    notes:      row.notes || null,
    createdAt:  row.createdAt,
    updatedAt:  row.updatedAt,
    service:    row.service
      ? {
          id:           row.service.id,
          slug:         row.service.slug,
          title:        row.service.title,
          deliveryType: row.service.deliveryType,
          ...(detailed && row.service.features
            ? { features: row.service.features.map((f) => ({ id: f.id, featureText: f.featureText })) }
            : {}),
        }
      : null,
    package:    row.servicePackage
      ? {
          id:       row.servicePackage.id,
          name:     row.servicePackage.name,
          price:    safeNum(row.servicePackage.price),
          currency: row.servicePackage.currency || "MXN",
        }
      : null,
    order:      row.order
      ? {
          id:          row.order.id,
          orderNumber: row.order.orderNumber,
          totalAmount: safeNum(row.order.totalAmount),
          currency:    row.order.currency || "MXN",
          status:      row.order.status,
          paidAt:      row.order.paidAt,
        }
      : null,
    ...(detailed
      ? {
          consultations: (row.consultations || []).map((c) => ({
            id:           c.id,
            scheduledAt:  c.scheduledAt,
            durationMin:  c.durationMin,
            meetingUrl:   c.meetingUrl,
            status:       c.status,
            notes:        c.notes || null,
          })),
          clientProject: row.clientProject
            ? {
                id:           row.clientProject.id,
                projectName:  row.clientProject.projectName,
                projectStatus: row.clientProject.projectStatus,
                milestones: (row.clientProject.milestones || []).map((m) => ({
                  id:          m.id,
                  title:       m.title,
                  dueDate:     m.dueDate,
                  status:      m.status,
                })),
                files: (row.clientProject.files || []).map((f) => ({
                  id:       f.id,
                  fileName: f.fileName,
                  fileSize: f.fileSize != null ? Number(f.fileSize) : null,
                  createdAt: f.createdAt,
                })),
              }
            : null,
        }
      : {}),
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Internal
 * ──────────────────────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────────────────
 *  orderByTier · public-facing "Choose Plan" entry point (guest-friendly)
 *
 *  T1 · the DB is the source of truth for prices. The package is resolved by
 *  `packageId` (preferred — what the SPA gets from GET /services/plans) or by
 *  (audience, tier) → Service "<audience>-plan" + ServicePackage.tierKey.
 *  Nothing is auto-provisioned any more: a missing row is a 404
 *  PLAN_NOT_FOUND until the operator runs `npm run seed:plans`.
 *
 *  `price` / `priceUsd` / `currency` / `planName` are still accepted so SPA
 *  builds from before T1 keep working, but they are NEVER trusted — the
 *  charged amount is pkg.price. A client price that drifts by more than one
 *  cent is logged at warn so a stale build or a tampered payload is visible.
 *  ──────────────────────────────────────────────────────────────────── */

const PLAN_NOT_FOUND_HINT = "Run `npm run seed:plans` to create the pricing plans."

async function resolvePlanPackage({ packageId, audience, tier }) {
  const activePublished = { isActive: true, service: { status: "published", deletedAt: null } }

  if (packageId) {
    const pkg = await prisma.servicePackage.findFirst({
      where:   { id: String(packageId), ...activePublished },
      include: { service: { select: { id: true, slug: true } } },
    })
    if (pkg) return pkg
    // Fall through to (audience, tier) only when the caller also sent it —
    // a bare stale packageId is a 404, not an excuse to guess.
    if (!audience || !tier) {
      throw new AppError(`Plan package '${packageId}' not found or inactive. ${PLAN_NOT_FOUND_HINT}`,
        { statusCode: 404, code: "PLAN_NOT_FOUND" })
    }
  }

  const serviceSlug = `${String(audience).toLowerCase()}-plan`
  const tierKey     = String(tier).toLowerCase()
  const pkg = await prisma.servicePackage.findFirst({
    where:   { tierKey, ...activePublished, service: { ...activePublished.service, slug: serviceSlug } },
    orderBy: { sortOrder: "asc" },
    include: { service: { select: { id: true, slug: true } } },
  })
  if (!pkg) {
    throw new AppError(`No pricing plan for audience '${audience}' tier '${tier}'. ${PLAN_NOT_FOUND_HINT}`,
      { statusCode: 404, code: "PLAN_NOT_FOUND" })
  }
  return pkg
}

async function orderByTier({
  packageId, audience, tier, planName, price, priceUsd, currency,
  customerName, customerEmail, requirements, userId,
}) {
  if (!packageId && (!audience || !tier)) {
    throw new AppError("packageId or (audience, tier) is required", { statusCode: 400, code: "VALIDATION_ERROR" })
  }
  if (!customerEmail) throw new AppError("customerEmail is required", { statusCode: 400, code: "VALIDATION_ERROR" })

  // Resolve the plan BEFORE touching the user table so a stale/missing plan
  // never leaves a freshly auto-created guest account behind.
  const pkg = await resolvePlanPackage({ packageId, audience, tier })

  // Drift check only — the client value is never used for the charge.
  const clientPrice = price != null ? price : priceUsd
  if (clientPrice != null && Number.isFinite(Number(clientPrice))) {
    const drift = Math.abs(Number(clientPrice) - safeNum(pkg.price))
    const currencyDiffers = currency && String(currency).toUpperCase() !== String(pkg.currency || "MXN").toUpperCase()
    if (drift > 0.01 || currencyDiffers) {
      logger.warn("[orderByTier] client price drift ignored; charging DB price", {
        packageId: pkg.id, tierKey: pkg.tierKey, planName: planName || null,
        clientPrice: Number(clientPrice), clientCurrency: currency || null,
        dbPrice: safeNum(pkg.price), dbCurrency: pkg.currency,
      })
    }
  }

  // Resolve user — auto-account flow for guests.
  let resolvedUserId = userId || null
  if (!resolvedUserId) {
    const { findOrCreateUserForCheckout } = require("./authService")
    const result = await findOrCreateUserForCheckout({ fullName: customerName, email: customerEmail })
    if (result.requiresLogin) {
      throw new AppError("An account already exists for this email. Please sign in to complete your purchase.", { statusCode: 401, code: "ACCOUNT_EXISTS" })
    }
    resolvedUserId = result.user.id
  }

  // Delegate to the existing createServiceOrder transaction (DB price).
  return createServiceOrder({
    userId:        resolvedUserId,
    slug:          pkg.service.slug,
    packageId:     pkg.id,
    requirements,
    customerName,
    customerEmail,
  })
}

/* ────────────────────────────────────────────────────────────────────────
 *  Admin · status / notes mutations with audit logging
 *
 *  Mirrors consultationService.adminUpdateConsultation:
 *    • Reads the existing row pre-update so beforeJson is accurate
 *    • Wraps the update + AdminAuditLog create in a single $transaction so
 *      we never have a state change without an audit trail (or vice versa)
 *    • Returns the updated row with the same shape the controller used to
 *      hand back from its inline Prisma.update call
 *
 *  ctx shape: { adminUserId, ipAddress } — when adminUserId is omitted
 *  (e.g. an internal/system caller) the audit row is skipped.
 *  ──────────────────────────────────────────────────────────────────── */

function pickServiceOrderAuditFields(row) {
  if (!row) return null
  return {
    id:        row.id,
    status:    row.status,
    startDate: row.startDate,
    endDate:   row.endDate,
    notes:     row.notes,
    projectId: row.projectId ?? null,
  }
}

async function adminUpdateServiceOrder(id, patch = {}, ctx = {}) {
  // Allowlist — admin-mutable fields only. Anything else in `patch` is
  // dropped silently rather than persisted (defence-in-depth even though
  // the controller already restricts what it forwards).
  const allowed = {}
  if (patch.status    !== undefined) allowed.status    = patch.status
  if (patch.notes     !== undefined) allowed.notes     = patch.notes
  if (patch.startDate !== undefined) allowed.startDate = patch.startDate ? new Date(patch.startDate) : null
  if (patch.endDate   !== undefined) allowed.endDate   = patch.endDate   ? new Date(patch.endDate)   : null

  // Pre-flight read for the audit snapshot.
  const before = await prisma.serviceOrder.findUnique({ where: { id } })
  if (!before) {
    throw Object.assign(new Error("Service order not found"), { code: "NOT_FOUND", statusCode: 404 })
  }

  // Atomic update + audit. If the audit insert throws we still roll back
  // the row update, so an external observer can never see the new state
  // without the corresponding audit entry.
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.serviceOrder.update({
      where: { id },
      data:  allowed,
    })

    if (ctx.adminUserId) {
      const action = patch.status ? `service-order.${patch.status}` : "service-order.updated"
      await tx.adminAuditLog.create({
        data: {
          adminUserId: ctx.adminUserId,
          action,
          targetType:  "ServiceOrder",
          targetId:    id,
          beforeJson:  pickServiceOrderAuditFields(before),
          afterJson:   pickServiceOrderAuditFields(row),
          ipAddress:   ctx.ipAddress || null,
        },
      })
    }

    return row
  })

  return updated
}

module.exports = {
  createUniqueOrderNumber,
  createServiceOrder,
  orderByTier,
  listUserServiceOrders,
  getUserServiceOrderById,
  serializeServiceOrder,
  adminUpdateServiceOrder,
}
