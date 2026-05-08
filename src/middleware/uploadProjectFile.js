const multer = require("multer")
const path   = require("path")
const fs     = require("fs")

// Stores at public/files/projects/<projectId>/<timestamp>-<sanitized-name>
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = path.join(__dirname, "../../public/files/projects", String(req.params.id || "_orphan"))
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120)
    cb(null, `${Date.now()}-${safe}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    // Allow common deliverable types — block scripts/binaries.
    const ok = /^(image\/|application\/pdf|application\/zip|application\/vnd|text\/|application\/msword|application\/json)/i.test(file.mimetype)
    cb(ok ? null : new Error("Unsupported file type"), ok)
  },
})

module.exports = upload.single("file")
