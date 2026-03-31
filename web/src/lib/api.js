// ─────────────────────────────────────────────────────────────────────────────
// Centralized API Utility
// Single source of truth for all frontend API communication
//
// Supports:
// - Local development: VITE_API_BASE_URL=http://localhost:5000
// - Production: VITE_API_BASE_URL="" → same-origin requests
// - Structured application errors
// - Authenticated and public requests
// - JSON and FormData bodies
// - Global session-expiry notification
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// API Base URL Resolution
// ─────────────────────────────────────────────────────────────────────────────
// Rules:
// 1. If VITE_API_BASE_URL exists, use it exactly
//    - local dev: "http://localhost:5000"
//    - production: "" (empty string for same-origin)
// 2. Fallback to VITE_API_URL if present
// 3. Final fallback: "http://localhost:5000" for local safety only
//
// Note:
// In production, the preferred setup is VITE_API_BASE_URL=
// which makes requests look like /api/products instead of
// https://mustaphaukizuru.com/api/products
// ─────────────────────────────────────────────────────────────────────────────

const RAW_API_BASE_URL =
  import.meta?.env?.VITE_API_BASE_URL !== undefined
    ? import.meta.env.VITE_API_BASE_URL
    : import.meta?.env?.VITE_API_URL || "http://localhost:5000"

export const API_BASE_URL = String(RAW_API_BASE_URL || "").replace(/\/+$/, "")

// ─────────────────────────────────────────────────────────────────────────────
// Storage Keys
// Keep these centralized to avoid mismatches across the app
// ─────────────────────────────────────────────────────────────────────────────
export const AUTH_TOKEN_KEY = "auth-token"
export const AUTH_USER_KEY = "auth-user"

// ─────────────────────────────────────────────────────────────────────────────
// AppError
// Standardized frontend error object
// ─────────────────────────────────────────────────────────────────────────────
class AppError extends Error {
  constructor(message, code = "REQUEST_ERROR", status = 400, details = null) {
    super(message)
    this.name = "AppError"
    this.code = code
    this.status = status
    this.details = details
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isAbsoluteUrl(value = "") {
  return /^https?:\/\//i.test(value)
}

export function buildApiUrl(endpoint = "") {
  if (!endpoint) return API_BASE_URL || ""

  if (isAbsoluteUrl(endpoint)) return endpoint

  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`

  return API_BASE_URL
    ? `${API_BASE_URL}${normalizedEndpoint}`
    : normalizedEndpoint
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
  } catch {
    // Ignore storage errors
  }
}

export function getStoredToken() {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY)
  } catch {
    return null
  }
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setStoredAuth({ token, user } = {}) {
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token)
    if (user !== undefined) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
    }
  } catch {
    // Ignore storage errors
  }
}

export function clearAuth() {
  clearStoredAuth()

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth:cleared"))
  }
}

function dispatchSessionExpired(detail = {}) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("auth:session-expired", {
        detail,
      })
    )
  }
}

async function parseResponseBody(response) {
  const contentType = response.headers.get("content-type") || ""

  if (isJsonContentType(contentType)) {
    try {
      return await response.json()
    } catch {
      return {}
    }
  }

  // Handle file/binary responses
  if (
    contentType.includes("application/octet-stream") ||
    contentType.includes("application/pdf") ||
    contentType.includes("application/zip") ||
    contentType.startsWith("image/")
  ) {
    try {
      return await response.blob()
    } catch {
      return null
    }
  }

  try {
    const text = await response.text()
    return text ? { message: text } : {}
  } catch {
    return {}
  }
}

function normalizeSuccessPayload(response, data) {
  // Binary/file responses
  if (isBlob(data)) {
    return {
      ok: response.ok,
      status: response.status,
      data,
      headers: response.headers,
    }
  }

  // JSON object responses
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data
  }

  // Array or primitive responses
  return {
    data,
  }
}

function normalizeErrorMessage(data, response) {
  if (data instanceof Blob) {
    return `Request failed (${response.status})`
  }

  return (
    data?.message ||
    data?.error ||
    data?.errors?.[0]?.message ||
    `Request failed (${response.status})`
  )
}

function normalizeErrorCode(data) {
  if (data instanceof Blob) return "REQUEST_ERROR"

  return data?.code || data?.errorCode || "REQUEST_ERROR"
}

function shouldAutoHandleUnauthorized(status, code) {
  return (
    status === 401 &&
    ["AUTH_EXPIRED", "AUTH_INVALID", "TOKEN_EXPIRED", "TOKEN_INVALID"].includes(
      code
    )
  )
}

function createRequestHeaders(options = {}, requireAuth = false) {
  const headers = new Headers(options.headers || {})
  const body = options.body
  const token = requireAuth ? getStoredToken() : null

  if (requireAuth && token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  // Only set JSON content type when body is not FormData
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

// ─────────────────────────────────────────────────────────────────────────────
// Core Request Function
// ─────────────────────────────────────────────────────────────────────────────
async function request(endpoint, options = {}, { requireAuth = false } = {}) {
  if (requireAuth && !getStoredToken()) {
    throw new AppError(
      "Authentication required. Please sign in.",
      "AUTH_MISSING",
      401
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
      0
    )
  }

  const responseData = await parseResponseBody(response)

  if (!response.ok) {
    const message = normalizeErrorMessage(responseData, response)
    const code = normalizeErrorCode(responseData)
    const status = response.status
    const details =
      responseData && typeof responseData === "object" ? responseData : null

    if (shouldAutoHandleUnauthorized(status, code)) {
      clearStoredAuth()
      dispatchSessionExpired({ code, status, message })
    }

    throw new AppError(message, code, status, details)
  }

  return normalizeSuccessPayload(response, responseData)
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API Request
// Use for public endpoints such as:
// /api/products
// /api/categories
// /api/contact
// /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
export async function apiRequest(endpoint, options = {}) {
  return request(endpoint, options, { requireAuth: false })
}

// ─────────────────────────────────────────────────────────────────────────────
// Authenticated API Request
// Use for member/admin endpoints such as:
// /api/member/orders
// /api/member/downloads
// /api/admin/products
// ─────────────────────────────────────────────────────────────────────────────
export async function authFetch(endpoint, options = {}) {
  return request(endpoint, options, { requireAuth: true })
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Helpers
// ─────────────────────────────────────────────────────────────────────────────
export async function apiGet(endpoint, options = {}) {
  return apiRequest(endpoint, {
    method: "GET",
    ...options,
  })
}

export async function apiPost(endpoint, body, options = {}) {
  return apiRequest(endpoint, {
    method: "POST",
    body: isFormData(body) ? body : JSON.stringify(body),
    ...options,
  })
}

export async function apiPatch(endpoint, body, options = {}) {
  return apiRequest(endpoint, {
    method: "PATCH",
    body: isFormData(body) ? body : JSON.stringify(body),
    ...options,
  })
}

export async function apiPut(endpoint, body, options = {}) {
  return apiRequest(endpoint, {
    method: "PUT",
    body: isFormData(body) ? body : JSON.stringify(body),
    ...options,
  })
}

export async function apiDelete(endpoint, options = {}) {
  return apiRequest(endpoint, {
    method: "DELETE",
    ...options,
  })
}

export async function authGet(endpoint, options = {}) {
  return authFetch(endpoint, {
    method: "GET",
    ...options,
  })
}

export async function authPost(endpoint, body, options = {}) {
  return authFetch(endpoint, {
    method: "POST",
    body: isFormData(body) ? body : JSON.stringify(body),
    ...options,
  })
}

export async function authPatch(endpoint, body, options = {}) {
  return authFetch(endpoint, {
    method: "PATCH",
    body: isFormData(body) ? body : JSON.stringify(body),
    ...options,
  })
}

export async function authPut(endpoint, body, options = {}) {
  return authFetch(endpoint, {
    method: "PUT",
    body: isFormData(body) ? body : JSON.stringify(body),
    ...options,
  })
}

export async function authDelete(endpoint, options = {}) {
  return authFetch(endpoint, {
    method: "DELETE",
    ...options,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// File Download Helper
// Useful for protected product download endpoints
// Example:
// await downloadFile("/api/member/downloads/product-id")
// ─────────────────────────────────────────────────────────────────────────────
export async function downloadFile(endpoint, options = {}) {
  const result = await authFetch(endpoint, {
    method: "GET",
    ...options,
  })

  return result
}

export { AppError }