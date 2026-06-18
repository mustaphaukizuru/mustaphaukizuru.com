const multer = require("multer")
const path   = require("path")
const fs     = require("fs")

// Uploads MUST live outside ../public — that directory is the Vite build
// output and is wiped on every `npm run build` (vite.config emptyOutDir:true),
// which previously deleted every uploaded avatar/cover. storage/ persists
// across builds and deploys (product download files already live there).
// app.js serves these back under the original /images/* URLs, so the URLs
// stored in the database never change.
const AVATAR_DIR = path.join(__dirname, "../../storage/uploads/avatars")
const MEDIA_DIR  = path.join(__dirname, "../../storage/uploads/media")

// Ensure a directory exists. Called at load AND inside each destination
// callback so a missing folder (fresh deploy, post-build wipe) can never
// ENOENT a write.
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}
ensureDir(AVATAR_DIR)
ensureDir(MEDIA_DIR)

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => { ensureDir(AVATAR_DIR); cb(null, AVATAR_DIR) },
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase()
    const name = `avatar-${req.user?.id || Date.now()}${ext}`
    cb(null, name)
  },
})

const mediaStorage = multer.diskStorage({
  destination: (req, file, cb) => { ensureDir(MEDIA_DIR); cb(null, MEDIA_DIR) },
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase()
    const name = `media-${Date.now()}${ext}`
    cb(null, name)
  },
})

const imageFilter = (req, file, cb) => {
  if (/image\/(jpeg|jpg|png|gif|webp)/.test(file.mimetype)) cb(null, true)
  else cb(new Error("Only image files allowed"), false)
}

// Blocked extensions for media uploads
const MEDIA_BLOCKED_EXT = new Set([
  ".php",".php3",".php4",".php5",".phtml",
  ".js",".mjs",".cjs",".ts",".jsx",".tsx",
  ".sh",".bash",".py",".rb",".pl",".exe",".com",".bat",".cmd",
  ".htaccess",".htpasswd",".svg",  // SVG can contain JS
])
function mediaFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase()
  if (MEDIA_BLOCKED_EXT.has(ext)) {
    return cb(new Error(`File type "${ext}" not permitted in media library`))
  }
  cb(null, true)
}

module.exports = {
  uploadAvatar: multer({ storage: avatarStorage, fileFilter: imageFilter, limits: { fileSize: 5 * 1024 * 1024 } }).single("avatar"),
  uploadMedia:  multer({ storage: mediaStorage,  fileFilter: mediaFilter,   limits: { fileSize: 20* 1024 * 1024 } }).single("file"),
}
