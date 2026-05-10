const prisma       = require("../lib/prisma")
const path         = require("path")
const fs           = require("fs")
const asyncHandler = require("../utils/asyncHandler")

// Phase 9.2c · refactored to asyncHandler so unhandled errors flow into the
// central errorHandler middleware. The pre-Phase-9.2 code did
//   catch (err) { return res.status(500).json({ message: err.message }) }
// which leaked Prisma engine details, file paths, and raw stack-derived
// strings to the client. errorHandler sanitises before returning.

const MEDIA_DIR = path.join(__dirname, "../../public/images/media")

const listMedia = asyncHandler(async (req, res) => {
  const { type, page = 1, limit = 24 } = req.query
  const where = {}
  if (type === "image") where.fileType = { in: ["jpg", "jpeg", "png", "gif", "webp", "svg"] }
  const [assets, total] = await Promise.all([
    prisma.mediaLibrary.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      include: { uploadedBy: { select: { id: true, fullName: true } } },
    }).catch(() => []),
    prisma.mediaLibrary.count({ where }).catch(() => 0),
  ])
  return res.status(200).json({
    success: true,
    data:    assets,
    meta:    { total, page: Number(page), limit: Number(limit) },
  })
})

const deleteMedia = asyncHandler(async (req, res) => {
  const asset = await prisma.mediaLibrary.findUnique({ where: { id: req.params.id } })
  if (!asset) return res.status(404).json({ success: false, message: "Asset not found" })
  // Delete file from disk if exists
  if (asset.filePath) {
    const abs = path.resolve(asset.filePath)
    if (fs.existsSync(abs)) fs.unlinkSync(abs)
  }
  await prisma.mediaLibrary.delete({ where: { id: req.params.id } })
  return res.status(200).json({ success: true, message: "Asset deleted" })
})

const updateMedia = asyncHandler(async (req, res) => {
  const { altText } = req.body
  const asset = await prisma.mediaLibrary.update({
    where: { id: req.params.id },
    data:  { altText },
  })
  return res.status(200).json({ success: true, data: asset })
})

// Upload handled by existing product image upload middleware — this is a generic upload endpoint
const uploadMedia = asyncHandler(async (req, res) => {
  const file = req.file
  if (!file) return res.status(400).json({ success: false, message: "No file uploaded" })

  const fileUrl = `/images/media/${file.filename}`
  const asset = await prisma.mediaLibrary.create({
    data: {
      fileName:     file.originalname,
      filePath:     file.path,
      fileUrl,
      fileType:     file.originalname.split(".").pop()?.toLowerCase() || "",
      mimeType:     file.mimetype,
      fileSize:     file.size,
      altText:      req.body.altText || "",
      uploadedById: req.user?.id,
    },
  })
  return res.status(201).json({ success: true, data: asset })
})

module.exports = { listMedia, deleteMedia, updateMedia, uploadMedia }
