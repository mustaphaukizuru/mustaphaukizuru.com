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
//
// Step 40 — session auth moved from a localStorage JWT to an httpOnly
// cookie:
//   • The session token is NEVER written to localStorage any more. The
//     server sets `mu_session` (httpOnly) at login; the browser attaches
//     it automatically because every request already uses
//     `credentials: "include"`.
//   • `auth-user` stays — it holds non-sensitive display data (name,
//     avatar, role) so the shell can paint before /auth/me resolves.
//   • State-changing requests echo the readable `mu_csrf` cookie back in
//     an `X-CSRF-Token` header (double-submit; see src/middleware/csrf.js).
//   • `getStoredToken()` is a compatibility shim that now returns null.
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

/** Readable half of the double-submit CSRF pair, set by the server. */
export const CSRF_COOKIE_NAME = "mu_csrf"

/** Methods that mutate state and therefore need the CSRF header. */
const CSRF_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

/** Server endpoint that clears the httpOnly cookies and revokes the JWT. */
export const LOGOUT_ENDPOINT = "/api/v1/auth/logout"

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

/**
 * Read a non-httpOnly cookie by name. Used for `mu_csrf` only — the session
 * cookie is httpOnly and is deliberately invisible here.
 */
export function readCookie(name) {
  if (typeof document === "undefined") return null
  const prefix = `${name}=`
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim()
    if (trimmed.startsWith(prefix)) {
      const raw = trimmed.slice(prefix.length)
      try { return decodeURIComponent(raw) } catch { return raw }
    }
  }
  return null
}

export function getCsrfToken() {
  return readCookie(CSRF_COOKIE_NAME)
}

export function clearStoredAuth() {
  try {
    // AUTH_TOKEN_KEY is no longer written (step 40) but is still removed so a
    // token left behind by a pre-step-40 build does not outlive a sign-out.
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(AUTH_USER_KEY)
  } catch { /* ignore */ }
}

/**
 * COMPATIBILITY SHIM (step 40) — always null.
 *
 * The session token lives in the httpOnly `mu_session` cookie, which JS
 * cannot read; that is the whole point of the migration. Kept as an export so
 * existing call sites keep compiling during the rollout, but nothing should
 * depend on its value. Callers that want "is someone signed in?" should use
 * `getStoredUser()` / `hasStoredSession()`; callers that were attaching an
 * Authorization header no longer need to — the cookie travels on its own.
 */
export function getStoredToken() {
  return null
}

/**
 * Best-effort "does this browser look signed in?" — used to skip a
 * guaranteed-401 round trip. Either signal is enough: the cached display
 * user, or the CSRF cookie the server sets alongside the session cookie.
 * The server remains the only authority; this is just a fast path.
 */
export function hasStoredSession() {
  return Boolean(getStoredUser()) || Boolean(getCsrfToken())
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

/**
 * Persist the non-sensitive half of the session. The `token` field is
 * accepted and IGNORED (step 40) so callers that still destructure a login
 * response `{ user, token }` need no change — the session itself arrived as
 * an httpOnly cookie on that same response.
 */
export function setStoredAuth({ user } = {}) {
  try {
    // Evict any token persisted by a pre-step-40 build of the SPA.
    localStorage.removeItem(AUTH_TOKEN_KEY)
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

/**
 * Sign out for real.
 *
 * The session cookie is httpOnly, so the browser cannot delete it — only the
 * server can, and only the server can revoke the JWT inside it. So we always
 * call the logout endpoint first, then clear local state regardless of the
 * outcome: a failed network call must never leave the UI claiming the user is
 * still signed in.
 */
export async function signOut() {
  try {
    await apiRequest(LOGOUT_ENDPOINT, { method: "POST" })
  } catch { /* offline / already expired — local cleanup still runs */ }
  clearAuth()
}

function dispatchSessionExpired(detail = {}) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth:session-expired", { detail }))
  }
}

/**
 * T1-11 · REQUIRE_ADMIN_2FA is on and this admin has not enrolled. Every
 * admin endpoint answers 403 ADMIN_2FA_REQUIRED, so the redirect belongs
 * here rather than in each page: AdminLayout listens and routes to the
 * enrolment page. The session is still valid — nothing is cleared.
 */
function dispatchAdmin2faRequired(detail = {}) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth:admin-2fa-required", { detail }))
  }
}

async function parseResponseBody(response) {
  const contentType = response.headers.get("content-type") || ""

  if (isJsonContentType(contentType)) {
    try { return await response.json() } catch { return {} }
  }

  // Anything that is not JSON and not a human-readable text/HTML body is a
  // file (product downloads carry their own MIME — zip variants, docx,
  // audio, fonts…). Reading those as text corrupts the bytes.
  const isTextual = contentType.startsWith("text/") || contentType === ""
  const hasAttachment = /attachment/i.test(response.headers.get("content-disposition") || "")
  if (!isTextual || hasAttachment) {
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

// Step 40 · no `requireAuth` parameter any more. There is nothing auth-shaped
// left to attach conditionally: the session travels as a cookie, the CSRF
// header depends only on the HTTP method, and an Authorization header appears
// only when the caller passes an explicit token.
/** The language this page is rendering: `/es/...` → "es", else <html lang>. */
function activeLanguage() {
  if (typeof window === "undefined" || typeof document === "undefined") return null
  if (/^\/es(\/|$)/.test(window.location?.pathname || "")) return "es"
  return document.documentElement.lang || null
}

function createRequestHeaders(options = {}) {
  const headers = new Headers(options.headers || {})
  const body = options.body

  // Step 40 · the session rides on the httpOnly `mu_session` cookie, which the
  // browser attaches by itself (see `credentials: "include"` below). An
  // Authorization header is only sent when a caller explicitly hands us a
  // token — e.g. a one-off integration or a test. We never dig one out of
  // storage, because nothing is stored there any more.
  const explicitToken = options.token
  if (explicitToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${explicitToken}`)
  }

  // CSRF double-submit: mirror the readable `mu_csrf` cookie into the header
  // on every state-changing request. A cross-origin attacker can make the
  // browser SEND our cookies but cannot READ them, so it cannot forge this.
  const method = String(options.method || "GET").toUpperCase()
  if (CSRF_METHODS.has(method) && !headers.has("X-CSRF-Token")) {
    const csrfToken = getCsrfToken()
    if (csrfToken) headers.set("X-CSRF-Token", csrfToken)
  }

  // Tell the API which language the page is actually rendering. Server-side
  // content (case-study copy, service names, email templates) is bilingual and
  // resolved per request by src/utils/resolveUserLocale.js; given no signal it
  // sniffs Accept-Language — the browser's preference, not the one the reader
  // picked. So an English page could be served Spanish case-study prose, and a
  // Spanish page English prose, purely from a header nobody chose.
  //
  // The URL is the single source of truth for language (I18N02, same rule the
  // Seo component follows), with <html lang> as the fallback for the window
  // before Helmet has applied it. Accept-Language is CORS-safelisted, so this
  // adds no preflight.
  if (!headers.has("Accept-Language")) {
    const lang = activeLanguage()
    if (lang) headers.set("Accept-Language", lang)
  }

  if (!isFormData(body) && !headers.has("Content-Type") && body != null) {
    headers.set("Content-Type", "application/json")
  }
  return headers
}

function prepareRequestOptions(options = {}) {
  const { token: _explicitToken, ...fetchOptions } = options
  return {
    ...fetchOptions,
    // Non-negotiable since step 40: without it the browser withholds the
    // `mu_session` cookie on cross-origin dev requests and every authenticated
    // call 401s.
    credentials: options.credentials || "include",
    headers: createRequestHeaders(options),
  }
}

/* ─────────────────────────────── core ──────────────────────────────────── */

async function request(endpoint, options = {}, { requireAuth = false } = {}) {
  // Cheap local pre-flight so obviously-signed-out callers skip a round trip.
  // Step 40 · the old check read the localStorage token, which no longer
  // exists; the cached `auth-user` plus the `mu_csrf` cookie are the visible
  // traces of a live session. The server still decides for real.
  if (requireAuth && !options.token && !hasStoredSession()) {
    throw new AppError(
      "Authentication required. Please sign in.",
      "AUTH_MISSING",
      401,
    )
  }

  const url = buildApiUrl(endpoint)
  const requestOptions = prepareRequestOptions(options)

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

    if (status === 403 && code === "ADMIN_2FA_REQUIRED") {
      dispatchAdmin2faRequired({ code, status, message: rawMessage })
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
