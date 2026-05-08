const prisma = require("../lib/prisma")

/* ────────────────────────────────────────────────────────────────────────────
 * Preserved — legacy helper used by older dashboard code paths
 * ──────────────────────────────────────────────────────────────────────────── */

async function getDownloadForUser(userId, productId) {
  const orderItem = await prisma.orderItem.findFirst({
    where: {
      productId,
      order: { userId, status: "paid" },
    },
    include: { product: true },
  })

  if (!orderItem) throw new Error("You have not purchased this product")
  if (!orderItem.product.downloadUrl) throw new Error("Download not available")

  return {
    url:      orderItem.product.downloadUrl,
    fileName: orderItem.product.fileName || orderItem.product.title,
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
  // Counts against DownloadLog rows for this user+product. Close enough
  // for our use case — logs record every completed stream.
  let downloadsRemaining = null
  if (file.maxDownloadsPerUser != null) {
    const consumed = await prisma.downloadLog.count({
      where: { userId, productId: file.product.id },
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

async function recordDownload({ userId, productId, orderId, userDownloadId, ipAddress, userAgent }) {
  await prisma.$transaction([
    prisma.downloadLog.create({
      data: {
        userId,
        productId,
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

module.exports = {
  getDownloadForUser,
  checkFileEntitlement,
  recordDownload,
}
