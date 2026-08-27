const prisma = require("../lib/prisma")
const logger = require("../utils/logger")

/* ────────────────────────────────────────────────────────────────────────────
 * Preserved — legacy helper used by older dashboard code paths
 *
 * T3 · Prefers ProductFile rows (the primary file first) and resolves to the
 * gated `/api/downloads/:fileId` URL. Falls back to the legacy
 * `product.downloadUrl` column only when the product has no files, and warns
 * once per product so the operator can migrate the stragglers.
 * ──────────────────────────────────────────────────────────────────────────── */

const legacyDownloadWarned = new Set()

async function getDownloadForUser(userId, productId) {
  const orderItem = await prisma.orderItem.findFirst({
    where: {
      productId,
      order: { userId, status: "paid" },
    },
    include: {
      product: {
        include: {
          files: { orderBy: { isPrimary: "desc" }, take: 1 },
        },
      },
    },
  })

  if (!orderItem) throw new Error("You have not purchased this product")

  const product = orderItem.product
  const file = product?.files?.[0] || null
  if (file) {
    return {
      url:      `/api/downloads/${file.id}`,
      fileName: file.fileName || product.fileName || product.title,
      fileId:   file.id,
    }
  }

  if (!product?.downloadUrl) throw new Error("Download not available")

  if (!legacyDownloadWarned.has(product.id)) {
    legacyDownloadWarned.add(product.id)
    logger.warn(`[download] product ${product.id} has no ProductFile rows — serving legacy downloadUrl. Upload a file to migrate.`)
  }

  return {
    url:      product.downloadUrl,
    fileName: product.fileName || product.title,
    fileId:   null,
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * B04 · checkFileEntitlement
 *
 * Given a logged-in user and a ProductFile id, returns a structured result
 * describing whether the user may download this file right now.
 *
 * Uses BOTH the UserDownload entitlement (created when order → paid)
 * AND the optional per-file cap (ProductFile.maxDownloadsPerUser).
 *
 * Never throws for business-rule failures. Returns:
 *   { allowed: true,  file, entitlement, downloadsRemaining }
 *   { allowed: false, code, message }
 *
 * @param {string} userId
 * @param {string} productFileId
 * ──────────────────────────────────────────────────────────────────────────── */

async function checkFileEntitlement(userId, productFileId) {
  if (!userId || !productFileId) {
    return { allowed: false, code: "VALIDATION_ERROR", message: "Missing user or file id" }
  }

  const file = await prisma.productFile.findUnique({
    where: { id: productFileId },
    include: {
      product: {
        select: { id: true, isActive: true, title: true },
      },
    },
  })

  if (!file || !file.product) {
    return { allowed: false, code: "NOT_FOUND", message: "File not found" }
  }

  if (!file.product.isActive) {
    return { allowed: false, code: "FORBIDDEN", message: "This product is no longer available" }
  }

  // Entitlement lookup: any paid order by this user that contains this product.
  const entitlement = await prisma.userDownload.findFirst({
    where: {
      userId,
      productId: file.product.id,
      order: { status: "paid" },
    },
    include: {
      order: { select: { id: true, orderNumber: true, status: true } },
    },
  })

  if (!entitlement) {
    return { allowed: false, code: "FORBIDDEN", message: "You have not purchased this product" }
  }

  if (entitlement.downloadAccessStatus !== "active") {
    return {
      allowed: false, code: "FORBIDDEN",
      message: "Your download access has been revoked. Contact support.",
    }
  }

  // Check per-entitlement cap (UserDownload.downloadLimit)
  if (entitlement.downloadLimit != null && entitlement.downloadCount >= entitlement.downloadLimit) {
    return {
      allowed: false, code: "LIMIT_EXCEEDED",
      message: "Download limit reached for this purchase",
    }
  }

  // Check per-file per-user cap (ProductFile.maxDownloadsPerUser).
  // Counts DownloadLog rows for this user + THIS file. Legacy rows written
  // before productFileId existed have productFileId = null — for those we
  // fall back to matching on productId so old downloads still count.
  let downloadsRemaining = null
  if (file.maxDownloadsPerUser != null) {
    const consumed = await prisma.downloadLog.count({
      where: {
        userId,
        OR: [
          { productFileId: file.id },
          { productFileId: null, productId: file.product.id },
        ],
      },
    })
    if (consumed >= file.maxDownloadsPerUser) {
      return {
        allowed: false, code: "LIMIT_EXCEEDED",
        message: `This file has a ${file.maxDownloadsPerUser}-download limit per user, which you've reached`,
      }
    }
    downloadsRemaining = file.maxDownloadsPerUser - consumed
  } else if (entitlement.downloadLimit != null) {
    downloadsRemaining = entitlement.downloadLimit - entitlement.downloadCount
  }

  return {
    allowed: true,
    file,
    entitlement,
    downloadsRemaining,
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * recordDownload — log + increment after a successful stream.
 *
 * Two writes, both non-throwing (we've already served the bytes; failure
 * here shouldn't bubble up to the user).
 * ──────────────────────────────────────────────────────────────────────────── */

async function recordDownload({ userId, productId, productFileId, orderId, userDownloadId, ipAddress, userAgent }) {
  await prisma.$transaction([
    prisma.downloadLog.create({
      data: {
        userId,
        productId,
        productFileId:  productFileId || null,
        orderId,
        userDownloadId: userDownloadId || null,
        ipAddress:      ipAddress || null,
        userAgent:      userAgent || null,
      },
    }),
    ...(userDownloadId
      ? [prisma.userDownload.update({
          where: { id: userDownloadId },
          data:  {
            downloadCount:    { increment: 1 },
            lastDownloadedAt: new Date(),
          },
        })]
      : []),
  ]).catch((err) => {
    console.error("[recordDownload] ignored:", err.message)
  })
}

/* ────────────────────────────────────────────────────────────────────────────
 * countConsumedByFile — per-file download tally for one user.
 *
 * Mirrors the counting rule in checkFileEntitlement (DownloadLog rows keyed by
 * productFileId, with legacy null-productFileId rows falling back to the
 * product) so "downloads remaining" shown in the UI equals what the gate will
 * enforce on the next request.
 *
 * @param {string} userId
 * @param {Array<{id: string, productId: string}>} files
 * @returns {Promise<Map<string, number>>} productFileId → consumed count
 * ──────────────────────────────────────────────────────────────────────────── */

async function countConsumedByFile(userId, files = []) {
  const map = new Map()
  if (!userId || !Array.isArray(files) || files.length === 0) return map

  for (const f of files) map.set(f.id, 0)
  const fileIds = files.map((f) => f.id)
  const productIds = [...new Set(files.map((f) => f.productId).filter(Boolean))]

  const logs = await prisma.downloadLog.findMany({
    where: {
      userId,
      OR: [
        { productFileId: { in: fileIds } },
        { productFileId: null, productId: { in: productIds } },
      ],
    },
    select: { productFileId: true, productId: true },
  })

  for (const log of logs) {
    if (log.productFileId) {
      if (map.has(log.productFileId)) map.set(log.productFileId, map.get(log.productFileId) + 1)
      continue
    }
    for (const f of files) {
      if (f.productId === log.productId) map.set(f.id, map.get(f.id) + 1)
    }
  }
  return map
}

/**
 * computeDownloadsRemaining — same precedence as checkFileEntitlement:
 * per-file cap wins, then per-entitlement cap, else null (= unlimited).
 */
function computeDownloadsRemaining(file, entitlement, consumed = 0) {
  if (file?.maxDownloadsPerUser != null) {
    return Math.max(0, file.maxDownloadsPerUser - consumed)
  }
  if (entitlement?.downloadLimit != null) {
    return Math.max(0, entitlement.downloadLimit - (entitlement.downloadCount || 0))
  }
  return null
}

/* ────────────────────────────────────────────────────────────────────────────
 * getDownloadLibraryForUser — "downloads for order" view for the dashboard.
 *
 * One query over UserDownload (the entitlement table) for every PAID order of
 * the user, expanded into orders → products → files with the same
 * downloadsRemaining semantics the download gate enforces. Revoked
 * entitlements are still listed (entitlementStatus !== "active") so the UI
 * can explain why a button is disabled instead of silently hiding files.
 *
 * @param {string} userId
 * @returns {Promise<{ orders: Array }>}
 * ──────────────────────────────────────────────────────────────────────────── */

async function getDownloadLibraryForUser(userId) {
  if (!userId) return { orders: [] }

  const entitlements = await prisma.userDownload.findMany({
    where: { userId, order: { status: "paid" } },
    include: {
      order: {
        select: {
          id: true, orderNumber: true, status: true, currency: true,
          createdAt: true, paidAt: true,
          invoices: { select: { id: true }, take: 1 },
        },
      },
      orderItem: { select: { licenseTier: true, licenseKey: true } },
      product: {
        select: {
          id: true, title: true, slug: true, isActive: true, updatedAt: true, version: true,
          images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, altText: true } },
          files: {
            orderBy: { isPrimary: "desc" },
            select: {
              id: true, productId: true, fileName: true, fileType: true, fileSize: true,
              version: true, isPrimary: true, maxDownloadsPerUser: true, uploadedAt: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const allFiles = []
  for (const e of entitlements) for (const f of e.product?.files || []) allFiles.push(f)
  const consumedByFile = await countConsumedByFile(userId, allFiles)

  const ordersById = new Map()
  for (const e of entitlements) {
    if (!e.order || !e.product) continue
    if (!ordersById.has(e.order.id)) {
      ordersById.set(e.order.id, {
        orderId:       e.order.id,
        orderNumber:   e.order.orderNumber,
        status:        e.order.status,
        currency:      e.order.currency,
        purchasedAt:   e.order.paidAt || e.order.createdAt,
        invoicePdfUrl: e.order.invoices?.length ? `/api/orders/${e.order.id}/invoice.pdf` : null,
        products:      [],
      })
    }
    const orderEntry = ordersById.get(e.order.id)
    if (orderEntry.products.some((pr) => pr.productId === e.product.id)) continue

    const files = Array.isArray(e.product.files) ? e.product.files : []
    const latestVersion = e.product.version
      || files.find((f) => f.isPrimary)?.version
      || files[0]?.version
      || null

    orderEntry.products.push({
      productId:         e.product.id,
      title:             e.product.title,
      slug:              e.product.slug,
      isActive:          e.product.isActive,
      updatedAt:         e.product.updatedAt,
      latestVersion,
      imageUrl:          e.product.images?.[0]?.url || null,
      imageAlt:          e.product.images?.[0]?.altText || null,
      entitlementStatus: e.downloadAccessStatus,
      lastDownloadedAt:  e.lastDownloadedAt,
      licenseTier:       e.orderItem?.licenseTier || null,
      licenseKey:        e.orderItem?.licenseKey || null,
      files: files.map((f) => {
        const consumed = consumedByFile.get(f.id) || 0
        return {
          fileId:              f.id,
          fileName:            f.fileName,
          fileType:            f.fileType,
          fileSize:            f.fileSize != null ? Number(f.fileSize) : null,
          version:             f.version,
          isPrimary:           f.isPrimary,
          uploadedAt:          f.uploadedAt,
          maxDownloadsPerUser: f.maxDownloadsPerUser,
          downloadsUsed:       consumed,
          downloadsRemaining:  computeDownloadsRemaining(f, e, consumed),
          downloadUrl:         `/api/downloads/${f.id}`,
        }
      }),
    })
  }

  const orders = Array.from(ordersById.values())
    .sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt))

  return { orders }
}

module.exports = {
  getDownloadForUser,
  checkFileEntitlement,
  recordDownload,
  countConsumedByFile,
  computeDownloadsRemaining,
  getDownloadLibraryForUser,
}
