const prisma       = require("../lib/prisma")
const asyncHandler = require("../utils/asyncHandler")

// Phase 9.2c · refactored to asyncHandler so unhandled errors flow into the
// central errorHandler middleware. The pre-Phase-9.2 code did
//   catch (err) { return res.status(500).json({ message: err.message }) }
// which leaked Prisma engine details, file paths, and raw stack-derived
// strings to the client. errorHandler sanitises before returning.

// Generic admin upload endpoint (blog covers, bio assets).
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

module.exports = { uploadMedia }
