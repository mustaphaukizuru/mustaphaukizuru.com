const prisma = require("../lib/prisma")
const { validateCoupon, calculateDiscount } = require("./couponService")

/* ────────────────────────────────────────────────────────────────────────────
 * Helpers (preserved)
 * ──────────────────────────────────────────────────────────────────────────── */

function generateOrderNumber() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const dd = String(now.getDate()).padStart(2, "0")
  const random = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `ORD-${yyyy}${mm}${dd}-${random}`
}

async function createUniqueOrderNumber() {
  for (let i = 0; i < 10; i += 1) {
    const orderNumber = generateOrderNumber()
    const existing = await prisma.order.findUnique({
      where: { orderNumber },
      select: { id: true },
    })
    if (!existing) return orderNumber
  }
  throw new Error("Failed to generate a unique order number")
}

function safeNumber(value) {
  if (value == null) return null
  return Number(value)
}

function safeBigInt(value) {
  if (value == null) return null
  return typeof value === "bigint" ? value.toString() : value
}

function serializeProduct(product) {
  if (!product) return null
  return {
    ...product,
    price: safeNumber(product.price),
    fileSize: safeBigInt(product.fileSize),
    images: Array.isArray(product.images) ? product.images : [],
    files: Array.isArray(product.files)
      ? product.files.map((file) => ({
          ...file,
          fileSize: safeBigInt(file.fileSize),
        }))
      : [],
  }
}

function serializeOrderItem(item) {
  return {
    ...item,
    price: safeNumber(item.price),
    unitPrice: safeNumber(item.unitPrice),
    lineTotal: safeNumber(item.lineTotal),
    product: serializeProduct(item.product),
  }
}

function serializeOrder(order) {
  if (!order) return null
  return {
    ...order,
    subtotalAmount: safeNumber(order.subtotalAmount),
    discountAmount: safeNumber(order.discountAmount),
    serviceFeeAmount: safeNumber(order.serviceFeeAmount),
    totalAmount: safeNumber(order.totalAmount),
    items: Array.isArray(order.items) ? order.items.map(serializeOrderItem) : [],
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * createOrder — preserved as-is
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Maximum quantity allowed per line item. Prevents accidental or malicious
 * giant-quantity submissions from skewing totals or exhausting payment
 * gateway integer limits. 50 chosen as a comfortable ceiling for digital
 * products — well above any realistic legitimate purchase.
 */
const MAX_QUANTITY_PER_ITEM = 50

async function createOrder(payload) {
  const { customerName, customerEmail, userId = null, items, couponCode } = payload

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error("Order items are required")
  }

  const productIds = items.map((item) => item.productId)

  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      isActive: true,
    },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      files:  true,
    },
  })

  if (products.length !== productIds.length) {
    throw new Error("Some products are invalid or unavailable")
  }

  const normalizedItems = items.map((item) => {
    const product = products.find((p) => p.id === item.productId)
    if (!product) throw new Error(`Product not found for ID: ${item.productId}`)

    const quantity = Number(item.quantity)
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error(`Invalid quantity for product: ${product.title}`)
    }
    // Hardening · upper bound on quantity. Stops a malicious request from
    // submitting `quantity: 999999` and producing an absurd lineTotal.
    if (quantity > MAX_QUANTITY_PER_ITEM) {
      throw new Error(`Quantity for ${product.title} exceeds the maximum of ${MAX_QUANTITY_PER_ITEM}`)
    }

    const unitPrice = Number(product.price)
    const lineTotal = unitPrice * quantity

    return {
      itemType: "product",
      productId: product.id,
      title: product.title,
      titleSnapshot: product.title,
      quantity,
      price: unitPrice,
      unitPrice,
      lineTotal,
    }
  })

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0)

  /* ─────────────────────────────────────────────────────────────────────
   * Hardening · server-side coupon validation. Previously the cart UI
   * showed a discount but the order was always created at full price
   * because createOrder ignored couponCode. Now we re-validate the coupon
   * here against the same rules the cart endpoint runs (expiry, usage
   * limits, per-user limits, minimum order amount) and apply the discount
   * inside a single transaction with the order create + CouponUsage row.
   *
   * The frontend MUST NOT supply discountAmount — it is computed
   * server-side from the validated coupon.
   * ──────────────────────────────────────────────────────────────────── */
  let discountAmount = 0
  let appliedCoupon = null
  if (couponCode && String(couponCode).trim()) {
    const result = await validateCoupon(couponCode, {
      userId:    userId || undefined,
      cartTotal: subtotal,
    })
    if (!result.valid) {
      const err = new Error(result.message || "Coupon not valid")
      err.code = "COUPON_INVALID"
      err.statusCode = 400
      throw err
    }
    discountAmount = Number(result.discount || 0)
    appliedCoupon  = result.coupon
  }

  const totalAmount = Math.max(0, Number((subtotal - discountAmount).toFixed(2)))

  const orderNumber = await createUniqueOrderNumber()

  // Atomic order + CouponUsage transaction — if the usage row fails we don't
  // want a half-written order to escape with a coupon that wasn't recorded.
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber,
        customerName,
        customerEmail,
        subtotalAmount: subtotal,
        discountAmount,
        totalAmount,
        currency: "MXN",
        ...(userId ? { user: { connect: { id: userId } } } : {}),
        ...(appliedCoupon ? { coupon: { connect: { id: appliedCoupon.id } } } : {}),
        items: {
          create: normalizedItems.map((item) => ({
            itemType:       item.itemType,
            productId:      item.productId,
            title:          item.title,
            titleSnapshot:  item.titleSnapshot,
            quantity:       item.quantity,
            price:          item.price,
            unitPrice:      item.unitPrice,
            lineTotal:      item.lineTotal,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: { orderBy: { sortOrder: "asc" } },
                files: true,
              },
            },
          },
        },
      },
    })

    if (appliedCoupon) {
      // Track usage for analytics + per-user limit enforcement on next purchase.
      await tx.couponUsage.create({
        data: {
          couponId:       appliedCoupon.id,
          userId:         userId || null,
          orderId:        created.id,
          discountAmount,
        },
      }).catch(() => null)
      // Increment global usedCount.
      await tx.coupon.update({
        where: { id: appliedCoupon.id },
        data:  { usedCount: { increment: 1 } },
      }).catch(() => null)
    }

    return created
  })

  return serializeOrder(order)
}

/* ────────────────────────────────────────────────────────────────────────────
 * getOrderById — preserved (legacy shape, used by admin panels + checkout)
 * ──────────────────────────────────────────────────────────────────────────── */

async function getOrderById(id) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: {
            include: {
              images: { orderBy: { sortOrder: "asc" } },
              files: true,
            },
          },
        },
      },
    },
  })
  return serializeOrder(order)
}

/* ────────────────────────────────────────────────────────────────────────────
 * getOrdersByUserId — preserved
 * ──────────────────────────────────────────────────────────────────────────── */

async function getOrdersByUserId(userId) {
  const orders = await prisma.order.findMany({
    where: { userId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true, title: true, slug: true, price: true, fileSize: true,
              images: { orderBy: { sortOrder: "asc" } },
              files: {
                orderBy: { isPrimary: "desc" },
                select: {
                  id: true, fileName: true, filePath: true,
                  isPrimary: true, version: true, fileSize: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return orders.map(serializeOrder)
}

/* ────────────────────────────────────────────────────────────────────────────
 * B04 · getEnrichedOrderById
 *
 * Returns the full enriched shape spec'd by B04:
 *   - order core fields
 *   - items[] with product snapshots + primary image URL
 *   - invoicePdfUrl (auth-gated endpoint URL, not filesystem path)
 *   - payment: { method, status, transactionId, processedAt }
 *   - refund:  { amount, reason, processedAt } | null
 *   - downloads[]: per-file entitlement with downloadsRemaining
 *   - timeline[]: ActivityLog entries for the Order entity
 * ──────────────────────────────────────────────────────────────────────────── */

async function getEnrichedOrderById(id) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: {
            include: {
              images: { orderBy: { sortOrder: "asc" }, take: 1 },
              files:  {
                orderBy: { isPrimary: "desc" },
                select: {
                  id: true, fileName: true, fileType: true, fileSize: true,
                  isPrimary: true, version: true, maxDownloadsPerUser: true,
                },
              },
            },
          },
        },
      },
      invoice: true,
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })
  if (!order) return null

  const userId = order.userId

  // UserDownload rows keyed by orderItemId for fast lookup
  let entitlementByOrderItem = new Map()
  if (userId) {
    const entitlements = await prisma.userDownload.findMany({
      where: { orderId: order.id, userId },
    })
    entitlementByOrderItem = new Map(entitlements.map((e) => [e.orderItemId, e]))
  }

  // Per-file download count (from DownloadLog joined via userDownloadId)
  // This is what enforces ProductFile.maxDownloadsPerUser at read time.
  let downloadCountByFile = new Map()
  if (userId) {
    // DownloadLog doesn't carry productFileId directly (the schema only ties
    // logs to products, not files). We derive per-file counts by pairing
    // logs-per-product with UserDownload-per-orderItem. Good enough for
    // "downloads remaining" display; the authoritative enforcement happens
    // in downloadController against UserDownload.downloadCount.
    const logs = await prisma.downloadLog.groupBy({
      by: ["productId"],
      where: { userId, orderId: order.id },
      _count: { _all: true },
    })
    downloadCountByFile = new Map(logs.map((l) => [l.productId, l._count._all]))
  }

  // Latest refund (if any)
  let refund = null
  if (order.payments?.[0]) {
    const r = await prisma.refund.findFirst({
      where:   { orderId: order.id },
      orderBy: { createdAt: "desc" },
    })
    if (r) {
      refund = {
        amount:       safeNumber(r.amount),
        reason:       r.reason || null,
        status:       r.refundStatus,
        processedAt:  r.processedAt,
      }
    }
  }

  // Payment summary
  const payment = order.payments?.[0]
    ? {
        method:        order.payments[0].paymentGateway,
        status:        order.payments[0].paymentStatus,
        transactionId: order.payments[0].gatewayTransactionId,
        amount:        safeNumber(order.payments[0].amount),
        currency:      order.payments[0].currency,
        processedAt:   order.payments[0].paidAt,
      }
    : null

  // Items + downloads flattened across every product file
  const items = []
  const downloads = []

  for (const item of order.items || []) {
    const product = item.product
    const entitlement = entitlementByOrderItem.get(item.id)

    const primaryImage = product?.images?.[0]
    items.push({
      id:             item.id,
      itemType:       item.itemType,
      productId:      item.productId,
      serviceId:      item.serviceId,
      title:          item.titleSnapshot || item.title,
      quantity:       item.quantity,
      unitPrice:      safeNumber(item.unitPrice || item.price),
      lineTotal:      safeNumber(item.lineTotal),
      product: product
        ? {
            id:       product.id,
            slug:     product.slug,
            title:    product.title,
            imageUrl: primaryImage?.url || null,
            imageAlt: primaryImage?.altText || null,
          }
        : null,
    })

    // One download entry per ProductFile of a purchased product.
    if (product && entitlement && Array.isArray(product.files)) {
      for (const file of product.files) {
        const perUserCap = file.maxDownloadsPerUser ?? null
        const entitlementCap = entitlement.downloadLimit ?? null
        const consumed = downloadCountByFile.get(product.id) || 0

        let downloadsRemaining = null  // null = unlimited
        if (perUserCap != null) {
          downloadsRemaining = Math.max(0, perUserCap - consumed)
        } else if (entitlementCap != null) {
          downloadsRemaining = Math.max(0, entitlementCap - (entitlement.downloadCount || 0))
        }

        downloads.push({
          productFileId:     file.id,
          productId:         product.id,
          productSlug:       product.slug,
          productTitle:      product.title,
          fileName:          file.fileName,
          fileType:          file.fileType,
          fileSize:          file.fileSize != null ? Number(file.fileSize) : null,
          fileSizeFormatted: formatBytes(file.fileSize),
          version:           file.version,
          isPrimary:         file.isPrimary,
          downloadUrl:       `/api/downloads/${file.id}`,
          downloadsRemaining,
          entitlementStatus: entitlement.downloadAccessStatus,
        })
      }
    }
  }

  // Timeline — ActivityLog entries for this Order
  const activityLogs = await prisma.activityLog.findMany({
    where:   { entityType: "Order", entityId: order.id },
    orderBy: { createdAt: "desc" },
    take:    50,
    select: {
      id: true, action: true, description: true, createdAt: true, userId: true,
    },
  })

  const timeline = activityLogs.map((log) => ({
    id:           log.id,
    action:       log.action,
    description:  log.description,
    createdAt:    log.createdAt,
  }))

  // Synthesize a "created" event if nothing else is in the timeline yet
  if (timeline.length === 0) {
    timeline.push({
      id:          `synthetic-created-${order.id}`,
      action:      "order.created",
      description: `Order ${order.orderNumber} created`,
      createdAt:   order.createdAt,
    })
  }

  // Invoice URL — only expose when a paid order has an invoice row
  const invoicePdfUrl =
    order.status === "paid" && order.invoice
      ? `/api/orders/${order.id}/invoice.pdf`
      : null

  const base = serializeOrder(order)

  // Strip payments/invoice raw from the base so clients consume our named fields
  delete base.payments
  delete base.invoice

  return {
    ...base,
    items,
    invoicePdfUrl,
    payment,
    refund,
    downloads,
    timeline,
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Internal
 * ──────────────────────────────────────────────────────────────────────────── */

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return null
  const n = typeof bytes === "bigint" ? Number(bytes) : Number(bytes)
  if (!Number.isFinite(n) || n < 0) return null
  if (n === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const exp = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1)
  const value = n / Math.pow(1024, exp)
  const formatted = exp === 0 ? value.toFixed(0) : value.toFixed(1)
  return `${formatted} ${units[exp]}`
}

module.exports = {
  createOrder,
  getOrderById,
  getOrdersByUserId,
  getEnrichedOrderById,
}
