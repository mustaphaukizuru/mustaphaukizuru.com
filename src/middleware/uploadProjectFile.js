const multer = require("multer")
const path   = require("path")
const { STORAGE_PATHS, ensureDir } = require("../config/storagePaths")

/**
 * Project deliverables — PRIVATE files, streamed through ownership-checked
 * controllers (never express.static).
 *
 * Stored at <storage>/projects/<projectId>/<timestamp>-<sanitized-name>.
 * The DB keeps the legacy-shaped relative path `/files/projects/<id>/<name>`
 * so `resolveSafePath` in clientProjectController can locate both old and
 * new rows against STORAGE_PATHS.projectFiles.
 *
 * WHY NOT public/: this used to write to public/files/projects — inside the
 * versioned deploy directory on Hostinger, so every deploy wiped every client
 * deliverable while ProjectFile.filePath still pointed at it. Same bug class
 * as the avatars/receipts loss fixed in storagePaths.js.
 */
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const id = String(req.params.id || "_orphan").replace(/[^a-zA-Z0-9_-]/g, "")
    cb(null, ensureDir(path.join(STORAGE_PATHS.projectFiles, id)))
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120)
    cb(null, `${Date.now()}-${safe}`)
  },
})

// Extension allowlist is the real gate — `file.mimetype` is whatever the
// client claimed. Scripts and executables are rejected by omission.
const ALLOWED_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
  ".pdf", ".zip", ".txt", ".md", ".csv", ".json",
  ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".fig", ".sketch", ".ai", ".psd",
])

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase()
    const ok  = ALLOWED_EXT.has(ext)
    cb(ok ? null : new Error("Unsupported file type"), ok)
  },
})

module.exports = upload.single("file")
module.exports.ALLOWED_EXT = ALLOWED_EXT
// Client dropzone + ticket attachments: several files per request.
module.exports.many = upload.array("files", 10)
