import { authFetch, AppError } from "../../lib/api"
import { triggerBrowserDownload } from "../../services/downloadService"

/* ──────────────────────────────────────────────────────────────────────────
 *  Download helpers for the purchase funnel (success page + dashboard).
 *
 *  Both hit auth-gated endpoints, so a plain <a href> would 401 on
 *  token-based deploys — everything is streamed through authFetch (which
 *  attaches the Bearer token and normalises binary bodies to a Blob).
 *
 *    streamDownloadById(fileId)  → GET /api/v1/downloads/:productFileId (B04)
 *                                   entitlement + per-file cap enforced server-side
 *    downloadInvoice(url)        → GET /api/v1/orders/:id/invoice.pdf
 *  ────────────────────────────────────────────────────────────────────────── */

function parseFilename(headers, fallback) {
  if (!headers || typeof headers.get !== "function") return fallback
  const disposition = headers.get("Content-Disposition") || headers.get("content-disposition")
  if (!disposition) return fallback
  const star = disposition.match(/filename\*\s*=\s*[^']*'[^']*'([^;]+)/i)
  if (star?.[1]) {
    try { return decodeURIComponent(star[1].trim().replace(/^"|"$/g, "")) } catch { /* fall through */ }
  }
  const plain = disposition.match(/filename\s*=\s*"?([^";]+)"?/i)
  if (plain?.[1]) {
    try { return decodeURIComponent(plain[1].trim()) } catch { return plain[1].trim() }
  }
  return fallback
}

export async function streamDownloadById(fileId, fallbackName = "download") {
  if (!fileId) throw new AppError("File id is required", "VALIDATION_ERROR", 400)
  const response = await authFetch(`/api/v1/downloads/${encodeURIComponent(fileId)}`, { method: "GET" })
  if (response?.data instanceof Blob) {
    return { blob: response.data, filename: parseFilename(response.headers, fallbackName) }
  }
  throw new AppError("Server did not return a downloadable file.", "UNEXPECTED_RESPONSE", 500)
}

/** Streams the file and hands it to the browser. Returns the resolved filename. */
export async function downloadFileById(fileId, fallbackName) {
  const { blob, filename } = await streamDownloadById(fileId, fallbackName)
  triggerBrowserDownload(blob, filename || fallbackName)
  return filename || fallbackName
}

export async function downloadInvoice(invoicePdfUrl, orderNumber) {
  if (!invoicePdfUrl) throw new AppError("Invoice not available", "NOT_FOUND", 404)
  const response = await authFetch(invoicePdfUrl, { method: "GET" })
  if (!(response?.data instanceof Blob)) {
    throw new AppError("Server did not return a PDF.", "UNEXPECTED_RESPONSE", 500)
  }
  const name = parseFilename(response.headers, `receipt-${orderNumber || "order"}.pdf`)
  triggerBrowserDownload(response.data, name)
  return name
}

/** Maps backend download error codes to dashboard i18n keys (dashboard.json). */
export function downloadErrorKey(code = "") {
  switch (code) {
    case "FORBIDDEN":        return "downloads.errors.notEntitled"
    case "NOT_FOUND":
    case "FILE_MISSING":     return "downloads.errors.fileMissing"
    case "LIMIT_EXCEEDED":   return "downloads.errors.limitExceeded"
    case "AUTH_MISSING":     return "downloads.errors.loginRequired"
    case "VALIDATION_ERROR": return "downloads.errors.downloadFailed"
    default:                 return ""
  }
}
