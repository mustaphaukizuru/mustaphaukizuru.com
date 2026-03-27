const fs = require("fs")
const path = require("path")
const multer = require("multer")

const PRODUCT_IMAGE_DIR = path.resolve(__dirname, "../../public/images/products")

if (!fs.existsSync(PRODUCT_IMAGE_DIR)) {
  fs.mkdirSync(PRODUCT_IMAGE_DIR, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, PRODUCT_IMAGE_DIR)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .toLowerCase()

    cb(null, `${Date.now()}-${base}${ext}`)
  },
})

const uploadProductImage = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 10,
  },
  fileFilter: (_req, file, cb) => {
    const path = require("path")
    const ext = path.extname(file.originalname).toLowerCase()
    const allowedExts = [".jpg", ".jpeg", ".png", ".gif", ".webp"]
    const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
    if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error("Only JPEG, PNG, GIF, and WebP images are allowed"))
    }
  },
})

module.exports = {
  uploadProductImage,
  PRODUCT_IMAGE_DIR,
}