const path = require("path")
const fs = require("fs")
const asyncHandler = require("../utils/asyncHandler")
const prisma = require("../lib/prisma")

const DOWNLOAD_DIR = path.resolve(__dirname, "../../storage/productfile")

async function getEntitledOrderItem(userId, productId) {
  return prisma.orderItem.findFirst({
    where: {
      productId,
      order: {
        userId,
        status: "paid",
      },
    },
    include: {
      order: true,
      product: {
        include: {
          files: {
            orderBy: {
              isPrimary: "desc",
            },
          },
        },
      },
    },
  })
}

const getDownloadMeta = asyncHandler(async (req, res) => {
  const { productId } = req.params
  const userId = req.user.id

  const entitledItem = await getEntitledOrderItem(userId, productId)

  if (!entitledItem) {
    return res.status(403).json({
      success: false,
      message: "You do not have access to this download.",
    })
  }

  const files = entitledItem.product?.files || []

  return res.status(200).json({
    success: true,
    data: {
      productId,
      files: files.map((file) => ({
        id: file.id,
        fileName: file.fileName,
        downloadPath: `/api/downloads/${productId}/file/${file.id}`,
      })),
    },
  })
})

const downloadProduct = asyncHandler(async (req, res) => {
  const { productId, fileId } = req.params
  const userId = req.user.id

  const entitledItem = await getEntitledOrderItem(userId, productId)

  if (!entitledItem) {
    return res.status(403).json({
      success: false,
      message: "You do not have access to this download.",
    })
  }

  const fileRecord = await prisma.productFile.findFirst({
    where: {
      id: fileId,
      productId,
    },
  })

  if (!fileRecord) {
    return res.status(404).json({
      success: false,
      message: "Download file is not configured for this product.",
    })
  }

  // Resolve path — filePath may be just filename, relative path, or slug-prefixed
  // Strip any leading slashes, normalize separators
  const cleanPath = fileRecord.filePath.replace(/^[\/]+/, "").replace(/\\/g, "/")
  const resolvedPath = path.resolve(DOWNLOAD_DIR, cleanPath)

  // Security: ensure resolved path stays within download directory
  if (!resolvedPath.startsWith(DOWNLOAD_DIR)) {
    return res.status(400).json({
      success: false,
      message: "Access denied.",
    })
  }

  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({
      success: false,
      message: "Download file is temporarily unavailable. Please contact support.",
    })
  }

  await prisma.downloadLog.create({
    data: {
      user: { connect: { id: userId } },
      product: { connect: { id: productId } },
      order: { connect: { id: entitledItem.orderId } },
    },
  }).catch(() => null)

  return res.download(resolvedPath, fileRecord.fileName)
})

module.exports = {
  getDownloadMeta,
  downloadProduct,
}