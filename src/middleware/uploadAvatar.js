const multer = require("multer")
const path   = require("path")
const fs     = require("fs")

const AVATAR_DIR = path.join(__dirname, "../../public/images/avatars")
if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true })

const MEDIA_DIR = path.join(__dirname, "../../public/images/media")
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true })

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATAR_DIR),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase()
    const name = `avatar-${req.user?.id || Date.now()}${ext}`
    cb(null, name)
  },
})

const mediaStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, MEDIA_DIR),
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
