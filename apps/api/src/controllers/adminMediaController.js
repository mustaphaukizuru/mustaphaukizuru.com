const prisma = require("../lib/prisma")
const path   = require("path")
const fs     = require("fs")

const MEDIA_DIR = path.join(__dirname, "../../public/images/media")

const listMedia = async (req, res) => {
  try {
    const { type, page = 1, limit = 24 } = req.query
    const where = {}
    if (type === "image") where.fileType = { in: ["jpg","jpeg","png","gif","webp","svg"] }
    const [assets, total] = await Promise.all([
      prisma.mediaLibrary.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (Number(page)-1)*Number(limit),
        take: Number(limit),
        include: { uploadedBy: { select: { id:true, fullName:true } } },
      }).catch(() => []),
      prisma.mediaLibrary.count({ where }).catch(() => 0),
    ])
    return res.status(200).json({ success: true, data: assets, meta: { total, page: Number(page), limit: Number(limit) } })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

const deleteMedia = async (req, res) => {
  try {
    const asset = await prisma.mediaLibrary.findUnique({ where: { id: req.params.id } })
    if (!asset) return res.status(404).json({ success: false, message: "Asset not found" })
    // Delete file from disk if exists
    if (asset.filePath) {
      const abs = path.resolve(asset.filePath)
      if (fs.existsSync(abs)) fs.unlinkSync(abs)
    }
    await prisma.mediaLibrary.delete({ where: { id: req.params.id } })
    return res.status(200).json({ success: true, message: "Asset deleted" })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

const updateMedia = async (req, res) => {
  try {
    const { altText } = req.body
    const asset = await prisma.mediaLibrary.update({ where: { id: req.params.id }, data: { altText } })
    return res.status(200).json({ success: true, data: asset })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

// Upload handled by existing product image upload middleware — this is a generic upload endpoint
const uploadMedia = async (req, res) => {
  try {
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
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

module.exports = { listMedia, deleteMedia, updateMedia, uploadMedia }
