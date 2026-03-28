// ─────────────────────────────────────────────────────────────────────────────
// Centralized API utility — single source of truth
// All structured errors returned as: { code, message, status }
// ─────────────────────────────────────────────────────────────────────────────

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL !== undefined
    ? import.meta.env.VITE_API_BASE_URL
    : (import.meta.env.VITE_API_URL || "http://localhost:5000")

// ── AppError — structured error object ───────────────────────────────────────
class AppError extends Error {
  constructor(message, code = "REQUEST_ERROR", status = 400) {
    super(message)
    this.name    = "AppError"
    this.code    = code
    this.status  = status
  }
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    return response.json().catch(() => ({}))
  }
  const text = await response.text().catch(() => "")
  return text ? { message: text } : {}
}

// ── Public fetch (no auth required) ─────────────────────────────────────────
export async function apiRequest(endpoint, options = {}) {
  let response
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    })
  } catch (networkErr) {
    throw new AppError(
      "Could not connect to the server. Check your internet connection.",
      "NETWORK_ERROR", 0
    )
  }

  const data = await parseResponse(response)

  if (!response.ok) {
    const msg    = data.message || data.error || `Request failed (${response.status})`
    const code   = data.code   || "REQUEST_ERROR"
    const status = response.status
    throw new AppError(msg, code, status)
  }

  return data
}

// ── Authenticated fetch (auto-injects Bearer token) ──────────────────────────
export async function authFetch(endpoint, options = {}) {
  const token = localStorage.getItem("auth-token")

  if (!token) {
    throw new AppError("Authentication required. Please sign in.", "AUTH_MISSING", 401)
  }

  const isFormData = options.body instanceof FormData

  let response
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(options.headers || {}),
      },
    })
  } catch (networkErr) {
    throw new AppError(
      "Could not connect to the server.",
      "NETWORK_ERROR", 0
    )
  }

  const data = await parseResponse(response)

  if (!response.ok) {
    const msg    = data.message || data.error || `Request failed (${response.status})`
    const code   = data.code   || "REQUEST_ERROR"
    const status = response.status

    // Handle session expiry globally
    if (status === 401 && (code === "AUTH_EXPIRED" || code === "AUTH_INVALID")) {
      localStorage.removeItem("auth-token")
      localStorage.removeItem("auth-user")
      // Soft redirect to login
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth:session-expired"))
      }
    }

    throw new AppError(msg, code, status)
  }

  return data
}

export { AppError }
