// ─────────────────────────────────────────────────────────────────────────────
// Global error handler — structured error codes, no stack leaks in production
// ─────────────────────────────────────────────────────────────────────────────
BigInt.prototype.toJSON = function () { return this.toString() }

const PRISMA_CONNECTION_MSGS = ["Can't reach database", "Connection refused", "ECONNREFUSED", "P1001", "P1002", "P1003"]
const PRISMA_CLIENT_NAMES    = ["PrismaClientKnownRequestError","PrismaClientUnknownRequestError","PrismaClientRustPanicError","PrismaClientInitializationError","PrismaClientValidationError"]

function isDbConnectionError(err) {
  const msg = err?.message || ""
  return PRISMA_CONNECTION_MSGS.some((m) => msg.includes(m))
}

function isPrismaClientError(err) {
  return PRISMA_CLIENT_NAMES.includes(err?.name)
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err)

  const isProd = process.env.NODE_ENV === "production"

  // ── DB unreachable ─────────────────────────────────────────────────────
  if (isDbConnectionError(err)) {
    console.error("[DB] Connection error:", err.message)
    return res.status(503).json({
      success: false, code: "DB_UNAVAILABLE",
      message: "Service temporarily unavailable. Please try again shortly.",
    })
  }

  // ── Prisma known errors ────────────────────────────────────────────────
  if (isPrismaClientError(err)) {
    console.error("[Prisma]", err.name, err.code, err.message)

    if (err.code === "P2002") return res.status(409).json({ success:false, code:"DUPLICATE_ENTRY",  message:"A record with this value already exists." })
    if (err.code === "P2025") return res.status(404).json({ success:false, code:"RECORD_NOT_FOUND", message:"The requested record was not found." })
    if (err.code === "P2003") return res.status(400).json({ success:false, code:"FOREIGN_KEY_ERROR", message:"Related record not found." })

    return res.status(400).json({
      success:false, code: err.code || "DB_ERROR",
      message: isProd ? "Database operation failed." : err.message,
    })
  }

  // ── JWT errors ─────────────────────────────────────────────────────────
  if (err.name === "JsonWebTokenError")  return res.status(401).json({ success:false, code:"AUTH_INVALID", message:"Invalid authentication token." })
  if (err.name === "TokenExpiredError")  return res.status(401).json({ success:false, code:"AUTH_EXPIRED", message:"Session expired. Please sign in again." })

  // ── Multer / upload errors ─────────────────────────────────────────────
  if (err.code === "LIMIT_FILE_SIZE")    return res.status(413).json({ success:false, code:"FILE_TOO_LARGE", message:"File too large. Maximum allowed size exceeded." })

  // ── Validation errors ─────────────────────────────────────────────────
  if (err.name === "ValidationError")   return res.status(422).json({ success:false, code:"VALIDATION_ERROR", message:err.message })

  // ── Application errors ────────────────────────────────────────────────
  const status  = err.statusCode || err.status || 500
  const message = err.message || "Internal server error"
  const code    = err.code    || (status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR")

  if (status >= 500) console.error("[Error]", status, err.name, err.message, isProd ? "" : err.stack?.split("\n")[1])

  return res.status(status).json({
    success: false, code, message,
    ...((!isProd && status >= 500) ? { stack: err.stack?.split("\n").slice(0,5) } : {}),
  })
}

module.exports = errorHandler
