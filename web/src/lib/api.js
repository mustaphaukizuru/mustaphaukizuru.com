// ─────────────────────────────────────────────────────────────────────────────
// Centralised API Utility · V2
//
// V2 changes (additive only — public API surface is unchanged):
//   • All error MESSAGES routed through `friendlyMessage()` from sanitize.js
//     so ANSI escape codes, absolute file paths, and Prisma engine spew
//     never reach the UI.
//   • New optional helper `apiTry(fn)` returns `[error, value]` tuple so
//     callers don't have to nest try/catch in every handler.
//   • `AppError.toUserMessage()` returns a sanitised, length-capped string
//     ready for toast.error().
//
// Public exports are preserved verbatim:
//   API_BASE_URL, API_VERSION, AppError, apiRequest, authFetch,
//   apiGet/Post/Put/Patch/Delete, authGet/Post/Put/Patch/Delete,
//   getStoredToken, getStoredUser, setStoredAuth, clearAuth,
//   downloadFile, buildApiUrl
// ─────────────────────────────────────────────────────────────────────────────

import { friendlyMessage, statusLabel } from "./sanitize"

const RAW_API_BASE_URL =
  import.meta?.env?.VITE_API_BASE_URL !== undefined
    ? import.meta.env.VITE_API_BASE_URL
    : import.meta?.env?.VITE_API_URL || "http://localhost:5000"

export const API_BASE_URL = String(RAW_API_BASE_URL || "").replace(/\/+$/, "")

export const API_VERSION = (
  import.meta?.env?.VITE_API_VERSION !== undefined
    ? import.meta.env.VITE_API_VERSION
    : "/v1"
)

const VERSIONED_PREFIX_RE = /^\/api\/v\d+\//
const WEBHOOK_PATH_RE = /^\/api\/(paypal|mercadopago)\/webhook(\/|$|\?)/

export const AUTH_TOKEN_KEY = "auth-token"
export const AUTH_USER_KEY = "auth-user"

/* ─────────────────────────────── AppError ──────────────────────────────── */

class AppError extends Error {
  constructor(message, code = "REQUEST_ERROR", status = 400, details = null) {
    super(message)
    this.name = "AppError"
    this.code = code
    this.status = status
    this.details = details
  }

  /** Sanitised message safe to render directly in toast / inline UI. */
  toUserMessage() {
    return friendlyMessage(this.message, statusLabel(this.status))
  }
}

/* ─────────────────────────────── helpers ───────────────────────────────── */

function isAbsoluteUrl(value = "") {
  return /^https?:\/\//i.test(value)
}

function upgradeToVersionedPath(path = "") {
  if (!API_VERSION) return path
  if (!path.startsWith("/api/")) return path
  if (VERSIONED_PREFIX_RE.test(path)) return path
  if (WEBHOOK_PATH_RE.test(path)) return path
  return `/api${API_VERSION}${path.slice(4)}`
}

export function buildApiUrl(endpoint = "") {
  if (!endpoint) return API_BASE_URL || ""
  if (isAbsoluteUrl(endpoint)) return endpoint
  const normalised = endpoint.startsWith("/") ? endpoint : `/${endpoint}`
  const upgraded = upgradeToVersionedPath(normalised)
  return API_BASE_URL ? `${API_BASE_URL}${upgraded}` : upgraded
}

function isFormData(value) {
  return typeof FormData !== "undefined" && value instanceof FormData
}
function isBlob(value) {
  return typeof Blob !== "undefined" && value instanceof Blob
}
function isJsonContentType(contentType = "") {
  return contentType.toLowerCase().includes("application/json")
}

function clearStoredAuth() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(AUTH_USER_KEY)
  } catch { /* ignore */ }
}

export function getStoredToken() {
  try { return localStorage.getItem(AUTH_TOKEN_KEY) }
  catch { return null }
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function setStoredAuth({ token, user } = {}) {
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token)
    if (user !== undefined) localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
  } catch { /* ignore */ }
}

export function clearAuth() {
  clearStoredAuth()
  if (typeof window !== "undefined") {
    // Drop any service-worker cached API responses so nothing from this
    // session can be replayed to the next user of the device.
    if ("caches" in window) {
      caches.delete("api-cache").catch(() => {})
    }
    window.dispatchEvent(new CustomEvent("auth:cleared"))
  }
}

function dispatchSessionExpired(detail = {}) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth:session-expired", { detail }))
  }
}

async function parseResponseBody(response) {
  const contentType = response.headers.get("content-type") || ""

  if (isJsonContentType(contentType)) {
    try { return await response.json() } catch { return {} }
  }

  if (
    contentType.includes("application/octet-stream") ||
    contentType.includes("application/pdf") ||
    contentType.includes("application/zip") ||
    contentType.startsWith("image/")
  ) {
    try { return await response.blob() } catch { return null }
  }

  try {
    const text = await response.text()
    return text ? { message: text } : {}
  } catch { return {} }
}

function normaliseSuccessPayload(response, data) {
  if (isBlob(data)) {
    return { ok: response.ok, status: response.status, data, headers: response.headers }
  }
  if (data && typeof data === "object" && !Array.isArray(data)) return data
  return { data }
}

function pickRawErrorMessage(data, response) {
  if (data instanceof Blob) return `Request failed (${response.status})`
  return (
    data?.error?.message ||
    data?.message ||
    data?.error ||
    data?.errors?.[0]?.message ||
    `Request failed (${response.status})`
  )
}

function pickErrorCode(data) {
  if (data instanceof Blob) return "REQUEST_ERROR"
  return data?.error?.code || data?.code || data?.errorCode || "REQUEST_ERROR"
}

function pickErrorDetails(data) {
  if (!data || typeof data !== "object" || data instanceof Blob) return null
  return data?.error?.details || data
}

function shouldAutoHandleUnauthorized(status, code) {
  return (
    status === 401 &&
    ["AUTH_EXPIRED", "AUTH_INVALID", "TOKEN_EXPIRED", "TOKEN_INVALID"].includes(code)
  )
}

function createRequestHeaders(options = {}, requireAuth = false) {
  const headers = new Headers(options.headers || {})
  const body = options.body
  const token = requireAuth ? getStoredToken() : null

  if (requireAuth && token) headers.set("Authorization", `Bearer ${token}`)
  if (!isFormData(body) && !headers.has("Content-Type") && body != null) {
    headers.set("Content-Type", "application/json")
  }
  return headers
}

function prepareRequestOptions(options = {}, requireAuth = false) {
  return {
    credentials: options.credentials || "include",
    ...options,
    headers: createRequestHeaders(options, requireAuth),
  }
}

/* ─────────────────────────────── core ──────────────────────────────────── */

async function request(endpoint, options = {}, { requireAuth = false } = {}) {
  if (requireAuth && !getStoredToken()) {
    throw new AppError(
      "Authentication required. Please sign in.",
      "AUTH_MISSING",
      401,
    )
  }

  const url = buildApiUrl(endpoint)
  const requestOptions = prepareRequestOptions(options, requireAuth)

  let response
  try {
    response = await fetch(url, requestOptions)
  } catch {
    throw new AppError(
      "Could not connect to the server. Check your internet connection.",
      "NETWORK_ERROR",
      0,
    )
  }

  const responseData = await parseResponseBody(response)

  if (!response.ok) {
    const rawMessage = pickRawErrorMessage(responseData, response)
    const code = pickErrorCode(responseData)
    const status = response.status
    const details = pickErrorDetails(responseData)

    if (shouldAutoHandleUnauthorized(status, code)) {
      clearStoredAuth()
      dispatchSessionExpired({ code, status, message: rawMessage })
    }

    // V2 — every message that escapes to the UI is sanitised.
    const safeMessage = friendlyMessage(rawMessage, statusLabel(status))
    throw new AppError(safeMessage, code, status, details)
  }

  return normaliseSuccessPayload(response, responseData)
}

/* ───────────────────────────── public API ──────────────────────────────── */

export async function apiRequest(endpoint, options = {}) {
  return request(endpoint, options, { requireAuth: false })
}

export async function authFetch(endpoint, options = {}) {
  return request(endpoint, options, { requireAuth: true })
}

export async function apiGet(endpoint, options = {}) { return apiRequest(endpoint, { method: "GET", ...options }) }
export async function apiPost(endpoint, body, options = {}) {
  return apiRequest(endpoint, { method: "POST", body: isFormData(body) ? body : JSON.stringify(body), ...options })
}
export async function apiPatch(endpoint, body, options = {}) {
  return apiRequest(endpoint, { method: "PATCH", body: isFormData(body) ? body : JSON.stringify(body), ...options })
}
export async function apiPut(endpoint, body, options = {}) {
  return apiRequest(endpoint, { method: "PUT", body: isFormData(body) ? body : JSON.stringify(body), ...options })
}
export async function apiDelete(endpoint, options = {}) { return apiRequest(endpoint, { method: "DELETE", ...options }) }

export async function authGet(endpoint, options = {}) { return authFetch(endpoint, { method: "GET", ...options }) }
export async function authPost(endpoint, body, options = {}) {
  return authFetch(endpoint, { method: "POST", body: isFormData(body) ? body : JSON.stringify(body), ...options })
}
export async function authPatch(endpoint, body, options = {}) {
  return authFetch(endpoint, { method: "PATCH", body: isFormData(body) ? body : JSON.stringify(body), ...options })
}
export async function authPut(endpoint, body, options = {}) {
  return authFetch(endpoint, { method: "PUT", body: isFormData(body) ? body : JSON.stringify(body), ...options })
}
export async function authDelete(endpoint, options = {}) { return authFetch(endpoint, { method: "DELETE", ...options }) }

export async function downloadFile(endpoint, options = {}) {
  return authFetch(endpoint, { method: "GET", ...options })
}

/**
 * Optional convenience: `const [err, data] = await apiTry(() => apiGet('/x'))`.
 * Avoids try/catch boilerplate at every call site. Errors are already
 * AppError instances so `err?.toUserMessage?.()` is safe.
 */
export async function apiTry(fn) {
  try {
    const value = await fn()
    return [null, value]
  } catch (err) {
    return [err, null]
  }
}

export { AppError }
