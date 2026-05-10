const path = require("path")
const logger = require("../utils/logger")
const fs = require("fs")
const asyncHandler = require("../utils/asyncHandler")
const prisma = require("../lib/prisma")
const { checkFileEntitlement, recordDownload } = require("../services/downloadService")

const DOWNLOAD_DIR = path.resolve(__dirname, "../../storage/productfile")

/* ────────────────────────────────────────────────────────────────────────────
 * Preserved — legacy entitlement lookup used by /api/downloads/:productId
 * ──────────────────────────────────────────────────────────────────────────── */

async function getEntitledOrderItem(userId, productId) {
  return prisma.orderItem.findFirst({
    where: {
      productId,
      order: { userId, status: "paid" },
    },
    include: {
      order: true,
      product: {
        include: {
          files: { orderBy: { isPrimary: "desc" } },
        },
      },
    },
  })
}

/**
 * Preserved — GET /api/downloads/:productId
 * Returns a list of downloadable files for a purchased product.
 * Still here so existing dashboard code doesn't break.
 */
const getDownloadMeta = asyncHandler(async (req, res) => {
  const { productId } = req.params
  const userId = req.user.id

  const entitledItem = await getEntitledOrderItem(userId, productId)

  if (!entitledItem) {
    return res.status(403).json({
      success: false, code: "FORBIDDEN",
      message: "You do not have access to this download.",
    })
  }

  const files = entitledItem.product?.files || []

  return res.status(200).json({
    success: true,
    data: {
      productId,
      files: files.map((file) => ({
        id:           file.id,
        fileName:     file.fileName,
        downloadPath: `/api/downloads/${file.id}`,         // B04 flat endpoint
        downloadPathLegacy: `/api/downloads/${productId}/file/${file.id}`,
      })),
    },
  })
})

/**
 * Preserved — GET /api/downloads/:productId/file/:fileId
 * Kept identical to pre-B04 so nothing in the running app breaks.
 */
const downloadProductLegacy = asyncHandler(async (req, res) => {
  const { productId, fileId } = req.params
  const userId = req.user.id

  const entitledItem = await getEntitledOrderItem(userId, productId)

  if (!entitledItem) {
    return res.status(403).json({
      success: false, code: "FORBIDDEN",
      message: "You do not have access to this download.",
    })
  }

  const fileRecord = await prisma.productFile.findFirst({
    where: { id: fileId, productId },
  })

  if (!fileRecord) {
    return res.status(404).json({
      success: false, code: "NOT_FOUND",
      message: "Download file is not configured for this product.",
    })
  }

  // Normalise to collapse `..`, strip leading separators, and force forward
  // slashes — `startsWith(DOWNLOAD_DIR)` alone is bypassable via sibling-dir
  // attacks (`productfile-evil/...`) or absolute paths on a different drive.
  const cleanPath = path.normalize(
    String(fileRecord.filePath || "").replace(/^[/\\]+/, "").replace(/\\/g, "/"),
  )
  const resolvedPath = path.resolve(DOWNLOAD_DIR, cleanPath)
  const rel = path.relative(DOWNLOAD_DIR, resolvedPath)

  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
    logger.warn("[download] path traversal blocked", { filePath: fileRecord.filePath, rel })
    return res.status(400).json({ success: false, code: "INVALID_PATH", message: "Access denied." })
  }

  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({
      success: false, code: "FILE_MISSING",
      message: "Download file is temporarily unavailable. Please contact support.",
    })
  }

  await prisma.downloadLog.create({
    data: {
      user:    { connect: { id: userId } },
      product: { connect: { id: productId } },
      order:   { connect: { id: entitledItem.orderId } },
      ipAddress: req.ip || null,
      userAgent: req.get("user-agent") || null,
    },
  }).catch(() => null)

  return res.download(resolvedPath, fileRecord.fileName)
})

/* ────────────────────────────────────────────────────────────────────────────
 * B04 · downloadByFileId — GET /api/downloads/:productFileId
 *
 * Authoritative download path for B04 frontend. Applies:
 *   1 · Entitlement check (UserDownload row exists + active status)
 *   2 · Per-entitlement cap (UserDownload.downloadLimit)
 *   3 · Per-file-per-user cap (ProductFile.maxDownloadsPerUser)
 *   4 · Rate limit via downloadRateLimiter middleware (applied in routes)
 *   5 · Audit log with IP + userAgent
 *   6 · Increment UserDownload.downloadCount on success
 * ──────────────────────────────────────────────────────────────────────────── */

const downloadByFileId = asyncHandler(async (req, res) => {
  const id = req.params.productFileId || req.params.id
  const userId = req.user.id

  const check = await checkFileEntitlement(userId, id)

  // Graceful fallback — if `id` doesn't resolve to a ProductFile, see if it
  // resolves to a Product and serve the legacy meta response. This keeps
  // older dashboard code (which calls `/api/downloads/:productId`) working
  // without changes.
  if (!check.allowed && check.code === "NOT_FOUND") {
    const asProduct = await getEntitledOrderItem(userId, id)
    if (asProduct) {
      const files = asProduct.product?.files || []
      return res.status(200).json({
        success: true,
        data: {
          productId: id,
          files: files.map((file) => ({
            id:           file.id,
            fileName:     file.fileName,
            downloadPath: `/api/downloads/${file.id}`,
            downloadPathLegacy: `/api/downloads/${id}/file/${file.id}`,
          })),
        },
      })
    }
  }

  if (!check.allowed) {
    const statusMap = { FORBIDDEN: 403, NOT_FOUND: 404, LIMIT_EXCEEDED: 429, VALIDATION_ERROR: 400 }
    const status = statusMap[check.code] || 403
    return res.status(status).json({
      success: false,
      code:    check.code,
      message: check.message,
    })
  }

  const { file, entitlement } = check

  // Resolve path safely — see legacy handler for the rationale behind
  // path.normalize + path.relative containment instead of startsWith.
  const cleanPath = path.normalize(
    String(file.filePath || "").replace(/^[/\\]+/, "").replace(/\\/g, "/"),
  )
  const resolvedPath = path.resolve(DOWNLOAD_DIR, cleanPath)
  const rel = path.relative(DOWNLOAD_DIR, resolvedPath)

  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
    logger.warn("[download] path traversal blocked", { filePath: file.filePath, rel })
    return res.status(400).json({ success: false, code: "INVALID_PATH", message: "Access denied." })
  }

  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({
      success: false, code: "FILE_MISSING",
      message: "Download file is temporarily unavailable. Please contact support.",
    })
  }

  // Stream with attachment disposition + original filename
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.fileName)}"`)
  res.setHeader("Cache-Control", "private, no-store")
  if (file.fileType) res.setHeader("Content-Type", file.fileType)
  if (file.fileSize) res.setHeader("Content-Length", String(file.fileSize))

  const stream = fs.createReadStream(resolvedPath)

  // Log + increment AFTER the stream is flushed (so failed streams don't
  // eat a download credit).
  res.on("finish", () => {
    recordDownload({
      userId,
      productId:      file.product.id,
      orderId:        entitlement.orderId,
      userDownloadId: entitlement.id,
      ipAddress:      req.ip || null,
      userAgent:      req.get("user-agent") || null,
    }).catch(() => null)
  })

  stream.on("error", (err) => {
    logger.error("[download] stream error:", err.message)
    if (!res.headersSent) {
      res.status(500).json({ success: false, code: "STREAM_ERROR", message: "Could not stream file" })
    } else {
      res.end()
    }
  })

  stream.pipe(res)
})

module.exports = {
  getDownloadMeta,
  downloadProduct: downloadProductLegacy,   // keep the legacy export name
  downloadByFileId,
}
