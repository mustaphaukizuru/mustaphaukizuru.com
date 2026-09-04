const path = require("path")
const multer = require("multer")
const { STORAGE_PATHS, ensureDir } = require("../config/storagePaths")

/**
 * Multer storage for portfolio images (cover + gallery).
 * Mirrors the pattern established by uploadProductImage.js so the admin
 * upload flow behaves consistently across modules.
 *
 * Destination: <storage>/uploads/portfolio/<timestamp>-<slugified-name>.<ext>
 *              (outside the versioned deploy dir — see storagePaths.js)
 * Public URL:  /images/portfolio/<filename>  (served by app.js static mount)
 */

const PORTFOLIO_IMAGE_DIR = ensureDir(STORAGE_PATHS.portfolioImages)

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, PORTFOLIO_IMAGE_DIR)
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

const uploadPortfolioImage = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 10, // 10 MB
  },
  fileFilter: (_req, file, cb) => {
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
  uploadPortfolioImage,
  PORTFOLIO_IMAGE_DIR,
}
