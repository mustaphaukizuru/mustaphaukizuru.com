const path = require("path")
const multer = require("multer")
const { STORAGE_PATHS, ensureDir } = require("../config/storagePaths")

// Runtime uploads live OUTSIDE the deploy directory (storagePaths.js) and
// are served at /images/products by app.js. Seed images tracked in git stay
// under public/images/products — both mounts share the URL prefix.
const PRODUCT_IMAGE_DIR = ensureDir(STORAGE_PATHS.productImages)

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