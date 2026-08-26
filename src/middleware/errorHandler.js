// ─────────────────────────────────────────────────────────────────────────────
// B10 · Global error handler — dual-shape responses
//
// Every error response carries BOTH:
//   - top-level `code` + `message`     (legacy — keeps existing frontend code working)
//   - nested `error: { code, message, details }`  (B10 standard shape)
//
// Frontend `web/src/lib/api.js` was updated in B10 to PREFER nested when
// present and fall back to top-level — so old service files and new ones
// both Just Work.
//
// Canonical codes (B10 spec):
//   VALIDATION_ERROR · UNAUTHORIZED · FORBIDDEN · NOT_FOUND · CONFLICT
//   RATE_LIMITED · PAYMENT_FAILED · INTERNAL_ERROR · BAD_REQUEST
//   AUTH_EXPIRED · AUTH_INVALID
//
// Legacy codes still emitted for backward compatibility:
//   DB_UNAVAILABLE · DUPLICATE_ENTRY · RECORD_NOT_FOUND · FOREIGN_KEY_ERROR
//   FILE_TOO_LARGE · DB_ERROR · REQUEST_ERROR
// ─────────────────────────────────────────────────────────────────────────────

const { getRequestId } = require("../lib/requestContext")
const fs     = require("fs")
const path   = require("path")
const logger = require("../utils/logger")
const AppError = require("../utils/AppError")

BigInt.prototype.toJSON = function () { return this.toString() }

// In production the SPA build copies web/public/* → public/. In development
// (`npm run dev` with no build) the source files live in web/public/ only.
// Resolve at startup once so both modes work with no extra config.
function resolveErrorHtml(name) {
  const built = path.join(__dirname, "..", "..", "public", name)
  const src   = path.join(__dirname, "..", "..", "web", "public", name)
  return fs.existsSync(built) ? built : src
}
const HTML_500_PATH = resolveErrorHtml("500.html")
const HTML_503_PATH = resolveErrorHtml("503.html")

/**
 * Decide whether the caller wants HTML or JSON. Same heuristic as notFound.js:
 *   - Anything under /api/ is JSON (frontend service calls).
 *   - Otherwise check Accept: text/html.
 *
 * Kept inline (rather than imported from notFound) to keep this middleware
 * stand-alone — it loads before Sentry and runs on every request path.
 */
function wantsHtml(req) {
  if (req.originalUrl && req.originalUrl.startsWith("/api/")) return false
  const accept = String(req.headers?.accept || "")
  return accept.includes("text/html")
}

/**
 * Read the static error page from /public, with an in-memory cache so we
 * don't pay the disk read on every 5xx. Cache invalidates on file change
 * (mtime check) so editing the HTML in development picks up immediately.
 */
const htmlCache = new Map()
function readErrorHtml(filePath) {
  try {
    const stat = fs.statSync(filePath)
    const cached = htmlCache.get(filePath)
    if (cached && cached.mtimeMs === stat.mtimeMs) return cached.html
    const html = fs.readFileSync(filePath, "utf8")
    htmlCache.set(filePath, { mtimeMs: stat.mtimeMs, html })
    return html
  } catch {
    return null
  }
}

const PRISMA_CONNECTION_MSGS = ["Can't reach database", "Connection refused", "ECONNREFUSED", "P1001", "P1002", "P1003"]
const PRISMA_CLIENT_NAMES    = ["PrismaClientKnownRequestError","PrismaClientUnknownRequestError","PrismaClientRustPanicError","PrismaClientInitializationError","PrismaClientValidationError"]

function isDbConnectionError(err) {
  const msg = err?.message || ""
  return PRISMA_CONNECTION_MSGS.some((m) => msg.includes(m))
}

function isPrismaClientError(err) {
  return PRISMA_CLIENT_NAMES.includes(err?.name)
}

/**
 * Build the dual-shape JSON body. Always returns the same skeleton so
 * downstream consumers (logging, frontend) can rely on a consistent shape.
 *
 * @param {string} code     canonical error code
 * @param {string} message  human-readable explanation
 * @param {object} [details] optional structured details (validation errors,
 *                           prisma metadata, retryAfter, etc.)
 * @param {object} [extra]  optional extra TOP-LEVEL fields (rare)
 */
function buildErrorBody(code, message, details = null, extra = null) {
  // The request id is what turns "something went wrong" into a log query.
  // It is also in the X-Request-Id response header; putting it in the body
  // too means a screenshot of the error is enough to find the trace.
  const requestId = getRequestId()
  return {
    success: false,
    code,            // legacy top-level
    message,         // legacy top-level
    ...(requestId ? { requestId } : {}),
    error: {         // B10 nested standard shape
      code,
      message,
      ...(requestId ? { requestId } : {}),
      ...(details ? { details } : {}),
    },
    ...(extra || {}),
  }
}

/**
 * Send an HTML error page for a browser request. Returns true if a page was
 * sent, false if the caller should fall through to JSON (file missing, etc.).
 */
function sendHtmlError(req, res, status) {
  if (!wantsHtml(req)) return false
  const filePath = status === 503 ? HTML_503_PATH : HTML_500_PATH
  const html = readErrorHtml(filePath)
  if (!html) return false
  res.status(status)
  res.setHeader("Content-Type", "text/html; charset=utf-8")
  res.setHeader("Cache-Control", "no-store")
  res.send(html)
  return true
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err)

  const isProd = process.env.NODE_ENV === "production"

  // ── DB unreachable ─────────────────────────────────────────────────────
  if (isDbConnectionError(err)) {
    logger.error("[DB] Connection error:", err.message)
    if (sendHtmlError(req, res, 503)) return
    return res.status(503).json(buildErrorBody(
      "DB_UNAVAILABLE",
      "Service temporarily unavailable. Please try again shortly.",
    ))
  }

  // ── Prisma known errors ────────────────────────────────────────────────
  if (isPrismaClientError(err)) {
    logger.error("[Prisma]", err.name, err.code, err.message)

    if (err.code === "P2002") {
      return res.status(409).json(buildErrorBody(
        "CONFLICT",
        "A record with this value already exists.",
        { prismaCode: "P2002", target: err.meta?.target || null, legacyCode: "DUPLICATE_ENTRY" },
      ))
    }
    if (err.code === "P2025") {
      return res.status(404).json(buildErrorBody(
        "NOT_FOUND",
        "The requested record was not found.",
        { prismaCode: "P2025", legacyCode: "RECORD_NOT_FOUND" },
      ))
    }
    if (err.code === "P2003") {
      return res.status(400).json(buildErrorBody(
        "BAD_REQUEST",
        "Related record not found.",
        { prismaCode: "P2003", field: err.meta?.field_name || null, legacyCode: "FOREIGN_KEY_ERROR" },
      ))
    }

    return res.status(400).json(buildErrorBody(
      err.code || "BAD_REQUEST",
      isProd ? "Database operation failed." : err.message,
      { prismaCode: err.code || null, legacyCode: "DB_ERROR" },
    ))
  }

  // ── JWT errors ─────────────────────────────────────────────────────────
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json(buildErrorBody("AUTH_INVALID", "Invalid authentication token."))
  }
  if (err.name === "TokenExpiredError") {
    return res.status(401).json(buildErrorBody("AUTH_EXPIRED", "Session expired. Please sign in again."))
  }

  // ── Multer / upload errors ─────────────────────────────────────────────
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json(buildErrorBody(
      "FILE_TOO_LARGE",
      "File too large. Maximum allowed size exceeded.",
      { limit: err.limit || null, field: err.field || null },
    ))
  }

  // ── Validation errors ─────────────────────────────────────────────────
  if (err.name === "ValidationError") {
    return res.status(422).json(buildErrorBody(
      "VALIDATION_ERROR",
      err.message,
      err.details || null,
    ))
  }

  // ── AppError (canonical application error) ────────────────────────────
  // statusCode + code + details are authoritative; same dual-shape body as
  // the legacy {statusCode, code} errors below.
  if (AppError.isAppError(err)) {
    const appStatus = err.statusCode || 500
    if (appStatus >= 500) {
      logger.error("[AppError]", appStatus, err.code, err.message, isProd ? "" : err.stack?.split("\n")[1])
      if (sendHtmlError(req, res, appStatus === 503 ? 503 : 500)) return
    }
    return res.status(appStatus).json(buildErrorBody(
      err.code || mapStatusToCode(appStatus),
      err.message || "Internal server error",
      err.details || null,
      !isProd && appStatus >= 500 ? { stack: err.stack?.split("\n").slice(0, 5) } : null,
    ))
  }

  // ── Application errors (legacy {statusCode, code} shape) ──────────────
  const status   = err.statusCode || err.status || 500
  const message  = err.message || "Internal server error"

  // Map status to canonical code if the error didn't supply one explicitly.
  const code = err.code || mapStatusToCode(status)

  if (status >= 500) {
    logger.error("[Error]", status, err.name, err.message, isProd ? "" : err.stack?.split("\n")[1])
    // Browsers hitting a non-API page (e.g. SSR-style request that crashed)
    // get the branded 500.html. API callers still receive JSON below so
    // existing frontend code (web/src/lib/api.js) keeps working unchanged.
    if (sendHtmlError(req, res, status === 503 ? 503 : 500)) return
  }

  const stackExtra = !isProd && status >= 500
    ? { stack: err.stack?.split("\n").slice(0, 5) }
    : null

  return res.status(status).json(buildErrorBody(
    code,
    message,
    err.details || null,
    stackExtra,
  ))
}

function mapStatusToCode(status) {
  if (status === 400) return "BAD_REQUEST"
  if (status === 401) return "UNAUTHORIZED"
  if (status === 403) return "FORBIDDEN"
  if (status === 404) return "NOT_FOUND"
  if (status === 409) return "CONFLICT"
  if (status === 422) return "VALIDATION_ERROR"
  if (status === 429) return "RATE_LIMITED"
  if (status === 402) return "PAYMENT_FAILED"
  if (status >= 500)  return "INTERNAL_ERROR"
  return "REQUEST_ERROR"
}

module.exports = errorHandler
