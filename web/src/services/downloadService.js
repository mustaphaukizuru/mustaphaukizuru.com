import { authFetch, AppError } from "../lib/api"

// ─────────────────────────────────────────────────────────────────────────────
// Download Service · v2 · 2026-05-10
//
// All download traffic flows through the centralized authFetch helper, which
// guarantees:
//   • /api/v1/* version upgrade
//   • Authorization: Bearer <token> from the canonical token store
//   • credentials: "include" for cookie-bound deploys
//   • AppError wrapping with sanitised user-facing messages
//   • Auto-handling of 401 AUTH_EXPIRED → session-expired event
//
// Public API:
//   getDownload(productId)              — fetch download metadata for a product
//   streamFileDownload(productId, fileId) — stream a single file as a Blob
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/downloads/:productId
 * Returns the entitlement metadata: list of files the user can download.
 *
 * @param {string} productId
 * @returns {Promise<{productId: string, files: Array<{id: string, fileName: string, downloadPath: string}>}>}
 */
export async function getDownload(productId) {
  if (!productId) {
    throw new AppError("Product ID is required", "VALIDATION_ERROR", 400)
  }

  const response = await authFetch(`/api/v1/downloads/${encodeURIComponent(productId)}`, {
    method: "GET",
  })

  return response?.data || response
}

/**
 * GET /api/v1/downloads/:productId/file/:fileId
 * Streams a single file as a Blob, with the original filename extracted from
 * the Content-Disposition header when present.
 *
 * Backend response codes are mapped to AppError instances with i18n-keyed codes
 * so the UI layer can render a specific message instead of a generic toast:
 *   403 FORBIDDEN       — entitlement missing or revoked
 *   404 NOT_FOUND       — file row missing
 *   404 FILE_MISSING    — file row exists but the asset is not on disk
 *   429 LIMIT_EXCEEDED  — per-entitlement or per-file cap reached
 *   400 VALIDATION_ERROR — bad input
 *
 * @param {string} productId
 * @param {string} fileId
 * @returns {Promise<{ blob: Blob, filename: string }>}
 */
export async function streamFileDownload(productId, fileId) {
  if (!productId || !fileId) {
    throw new AppError("Product and file IDs are required", "VALIDATION_ERROR", 400)
  }

  const endpoint =
    `/api/v1/downloads/${encodeURIComponent(productId)}/file/${encodeURIComponent(fileId)}`

  // authFetch returns either a parsed JSON envelope or, for binary content
  // types, an envelope of shape { ok, status, data: Blob, headers }.
  const response = await authFetch(endpoint, { method: "GET" })

  // Binary success — authFetch normalised it for us.
  if (response?.data instanceof Blob) {
    const filename = parseFilename(response.headers, fileId)
    return { blob: response.data, filename }
  }

  // Some backends return JSON metadata at this URL during early integration.
  // If we got here, the server didn't stream a binary — surface a clear error.
  throw new AppError(
    "Server did not return a downloadable file.",
    "UNEXPECTED_RESPONSE",
    500,
  )
}

/**
 * Extracts a filename from a Content-Disposition header. Falls back to the
 * fileId when the header is missing or unparseable. URL-decodes the filename
 * because the backend percent-encodes it before emitting the header.
 *
 * @param {Headers | null | undefined} headers
 * @param {string} fallback
 * @returns {string}
 */
function parseFilename(headers, fallback) {
  if (!headers || typeof headers.get !== "function") return fallback
  const disposition = headers.get("Content-Disposition") || headers.get("content-disposition")
  if (!disposition) return fallback

  // Prefer RFC 5987 filename* if present (UTF-8 aware), then fall back to filename=.
  const star = disposition.match(/filename\*\s*=\s*[^']*'[^']*'([^;]+)/i)
  if (star?.[1]) {
    try { return decodeURIComponent(star[1].trim().replace(/^"|"$/g, "")) }
    catch { /* fall through */ }
  }

  const plain = disposition.match(/filename\s*=\s*"?([^";]+)"?/i)
  if (plain?.[1]) {
    try { return decodeURIComponent(plain[1].trim()) }
    catch { return plain[1].trim() }
  }
  return fallback
}

/**
 * Triggers a browser download for the given Blob and filename, then revokes
 * the object URL. Pure side-effect — separated from streamFileDownload so
 * unit tests can mock it independently.
 *
 * @param {Blob} blob
 * @param {string} filename
 */
export function triggerBrowserDownload(blob, filename) {
  const objectUrl = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = objectUrl
  link.download = filename || "download"
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(objectUrl)
}
