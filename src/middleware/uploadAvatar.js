const multer = require("multer")
const path   = require("path")
const fs     = require("fs")
const { STORAGE_PATHS } = require("../config/storagePaths")
const AppError = require("../utils/AppError")
const logger = require("../utils/logger")

// Uploads MUST live outside ../public — that directory is the Vite build
// output and is wiped on every `npm run build` (vite.config emptyOutDir:true),
// which previously deleted every uploaded avatar/cover. storage/ persists
// across builds and deploys (product download files already live there).
// app.js serves these back under the original /images/* URLs, so the URLs
// stored in the database never change.
const AVATAR_DIR = STORAGE_PATHS.avatars
const MEDIA_DIR  = STORAGE_PATHS.media

// Ensure a directory exists. Called at load AND inside each destination
// callback so a missing folder (fresh deploy, post-build wipe) can never
// ENOENT a write.
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}
ensureDir(AVATAR_DIR)
ensureDir(MEDIA_DIR)

// Security · ALLOWLIST for avatars. Files land under /images/avatars and are
// served by express.static with a Content-Type derived from the extension,
// so the extension is the security boundary: it comes from this map, never
// from file.originalname. Extension AND declared MIME must both match, and
// the bytes are checked against the format's signature after the write
// (verifyAvatarSignature below). `.jpeg` is stored as `.jpg`.
const AVATAR_ALLOWED = new Map([
  [".jpg",  { mime: "image/jpeg", ext: ".jpg" }],
  [".jpeg", { mime: "image/jpeg", ext: ".jpg" }],
  [".png",  { mime: "image/png",  ext: ".png" }],
  [".webp", { mime: "image/webp", ext: ".webp" }],
  [".gif",  { mime: "image/gif",  ext: ".gif" }],
])

function avatarEntry(file) {
  const ext   = path.extname(file?.originalname || "").toLowerCase()
  const entry = AVATAR_ALLOWED.get(ext)
  if (!entry || entry.mime !== String(file?.mimetype || "").toLowerCase()) return null
  return entry
}

function avatarFilter(req, file, cb) {
  const entry = avatarEntry(file)
  if (!entry) {
    const got = path.extname(file?.originalname || "").toLowerCase() || file?.mimetype || "unknown"
    return cb(AppError.badRequest(`Avatar must be a JPEG, PNG, WebP or GIF image (got "${got}")`, "UNSUPPORTED_MEDIA_TYPE"))
  }
  cb(null, true)
}

// First bytes of each accepted format. `null` = any byte (WebP's RIFF size).
const AVATAR_SIGNATURES = {
  ".jpg":  [[0xFF, 0xD8, 0xFF]],
  ".png":  [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  ".gif":  [[0x47, 0x49, 0x46, 0x38]],
  ".webp": [[0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50]],
}

function readHead(filePath, length = 12) {
  let fd
  try {
    fd = fs.openSync(filePath, "r")
    const buf = Buffer.alloc(length)
    const n = fs.readSync(fd, buf, 0, length, 0)
    return buf.subarray(0, n)
  } catch {
    return Buffer.alloc(0)
  } finally {
    if (fd !== undefined) fs.closeSync(fd)
  }
}

function matchesSignature(head, ext) {
  const sigs = AVATAR_SIGNATURES[ext] || []
  return sigs.some((sig) => sig.every((b, i) => b === null || head[i] === b))
}

/**
 * Runs after multer has written the file: the declared type was allowed,
 * now the bytes must agree. A mismatch (HTML renamed to .png, say) unlinks
 * the file and answers 400 — nothing under /images/avatars is ever a
 * document. Mount it directly after the multer middleware.
 */
function verifyAvatarSignature(req, res, next) {
  const file = req.file
  if (!file) return next()
  const ext = path.extname(file.filename || "").toLowerCase()
  if (matchesSignature(readHead(file.path), ext)) return next()
  // Synchronously, and that matters. Fire-and-forget left the rejected
  // bytes on disk after the 400 had already been written — a caller that
  // was told "refused" could still fetch the file for as long as the
  // unlink took to land, and a failing unlink said nothing at all.
  try { fs.unlinkSync(file.path) } catch (err) {
    if (err?.code !== "ENOENT") logger.error(`[uploadAvatar] could not remove ${file.path}: ${err.message}`)
  }
  req.file = undefined
  next(AppError.badRequest("The uploaded file is not the image type it claims to be", "UNSUPPORTED_MEDIA_TYPE"))
}

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => { ensureDir(AVATAR_DIR); cb(null, AVATAR_DIR) },
  filename:    (req, file, cb) => {
    // fileFilter has already run, so the entry exists; the extension is the
    // canonical one from the allowlist, not whatever the upload was called.
    const ext  = avatarEntry(file)?.ext || ".bin"
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

// Security · ALLOWLIST for media uploads. Files land under /images/media and
// are served by express.static with a Content-Type derived from extension,
// so anything the browser will execute or render as a document (.html,
// .svg, .js, .php, …) is an XSS vector. Extension AND declared MIME must
// both match one of these.
const MEDIA_ALLOWED = new Map([
  [".jpg",  ["image/jpeg"]],
  [".jpeg", ["image/jpeg"]],
  [".png",  ["image/png"]],
  [".gif",  ["image/gif"]],
  [".webp", ["image/webp"]],
  [".avif", ["image/avif"]],
  [".mp4",  ["video/mp4"]],
  [".webm", ["video/webm"]],
  [".mp3",  ["audio/mpeg"]],
  [".pdf",  ["application/pdf"]],
  [".zip",  ["application/zip", "application/x-zip-compressed"]],
])
function mediaFilter(req, file, cb) {
  const ext   = path.extname(file.originalname).toLowerCase()
  const mimes = MEDIA_ALLOWED.get(ext)
  if (!mimes || !mimes.includes(String(file.mimetype).toLowerCase())) {
    return cb(new Error(`File type "${ext || file.mimetype}" not permitted in media library`))
  }
  cb(null, true)
}

module.exports = {
  uploadAvatar: multer({ storage: avatarStorage, fileFilter: avatarFilter, limits: { fileSize: 5 * 1024 * 1024 } }).single("avatar"),
  uploadMedia:  multer({ storage: mediaStorage,  fileFilter: mediaFilter,   limits: { fileSize: 20* 1024 * 1024 } }).single("file"),
  verifyAvatarSignature,
  // exported for tests
  avatarEntry,
  matchesSignature,
  AVATAR_ALLOWED,
}
