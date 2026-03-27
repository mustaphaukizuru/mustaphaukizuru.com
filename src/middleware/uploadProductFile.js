const fs   = require("fs")
const path = require("path")
const multer = require("multer")

const PRODUCT_FILE_DIR = path.resolve(__dirname, "../../storage/productfile")
if (!fs.existsSync(PRODUCT_FILE_DIR)) fs.mkdirSync(PRODUCT_FILE_DIR, { recursive: true })

// Allowed download file types — digital products only
const ALLOWED_PRODUCT_EXTENSIONS = new Set([
  ".zip", ".pdf", ".docx", ".doc", ".xlsx", ".xls",
  ".pptx", ".ppt", ".epub", ".txt", ".md", ".csv",
  ".mp4", ".mp3", ".wav", ".png", ".jpg", ".jpeg",
  ".ai", ".psd", ".sketch", ".figma", ".svg",
  ".tar", ".gz", ".rar", ".7z",
])

// NEVER allow server-executable files
const BLOCKED_EXTENSIONS = new Set([
  ".php", ".php3", ".php4", ".php5", ".phtml",
  ".js", ".mjs", ".cjs", ".ts",   // server scripts
  ".sh", ".bash", ".zsh", ".fish",
  ".py", ".rb", ".pl", ".lua",
  ".exe", ".com", ".bat", ".cmd",
  ".htaccess", ".htpasswd",
])

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PRODUCT_FILE_DIR),
  filename: (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase()
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9\-_]/g, "-")
      .toLowerCase()
      .slice(0, 80)
    cb(null, `${Date.now()}-${base}${ext}`)
  },
})

function productFileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase()

  if (BLOCKED_EXTENSIONS.has(ext)) {
    return cb(new Error(`File type "${ext}" is not permitted for product delivery`))
  }
  if (!ALLOWED_PRODUCT_EXTENSIONS.has(ext)) {
    return cb(new Error(`File type "${ext}" is not in the allowed product file list`))
  }
  cb(null, true)
}

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },   // 200MB max (was 500MB — reduced)
  fileFilter: productFileFilter,
})

module.exports = { upload, PRODUCT_FILE_DIR }
