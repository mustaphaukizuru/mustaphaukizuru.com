import {
  apiRequest,
  authFetch,
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
} from "../lib/api"

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

export function clearStoredAuth() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(AUTH_USER_KEY)
  } catch {
    // ignore storage errors
  }
}

export function storeAuth(data) {
  if (!data?.token || !data?.user) {
    throw new Error("Invalid authentication payload")
  }

  try {
    localStorage.setItem(AUTH_TOKEN_KEY, data.token)
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user))
  } catch {
    throw new Error("Failed to store authentication data")
  }
}

export async function signup(payload) {
  const response = await apiRequest("/api/v1/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  })

  return response?.data || response
}

/**
 * Login (B09 update).
 *
 * Returns one of:
 *   - { user, token }                              — standard, no 2FA
 *   - { requires2FA: true, twoFactorToken }        — 2FA gate; caller must
 *                                                    show the prompt and
 *                                                    follow up with verifyLoginTwoFactor()
 */
export async function login(payload) {
  const response = await apiRequest("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return response?.data || response
}

export async function loginWithGoogleCredential(credential) {
  if (!credential) {
    throw new Error("Google credential is required")
  }

  const response = await apiRequest("/api/v1/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  })

  return response?.data || response
}

export async function fetchMe() {
  const response = await authFetch("/api/v1/auth/me", {
    method: "GET",
  })

  return response?.data || response
}

/* ────────────────────────────────────────────────────────────────────────────
 * B09 · Two-factor authentication helpers
 *
 * The dashboard uses the authenticated calls (status / setup / verify / disable
 * / regenerate). The login page uses verifyLoginTwoFactor (public — uses the
 * twoFactorToken issued by /api/v1/auth/login).
 * ──────────────────────────────────────────────────────────────────────────── */

export async function fetchTwoFactorStatus() {
  const res = await authFetch("/api/v1/auth/2fa/status", { method: "POST" })
  return res?.data || null
}

export async function setupTwoFactor() {
  const res = await authFetch("/api/v1/auth/2fa/setup", { method: "POST" })
  return res?.data || null
}

export async function verifyTwoFactor(code) {
  const res = await authFetch("/api/v1/auth/2fa/verify", {
    method: "POST",
    body: JSON.stringify({ code }),
  })
  return res?.data || null
}

export async function disableTwoFactor(password) {
  const res = await authFetch("/api/v1/auth/2fa/disable", {
    method: "POST",
    body: JSON.stringify({ password }),
  })
  return res?.data || null
}

export async function regenerateBackupCodes(password) {
  const res = await authFetch("/api/v1/auth/2fa/backup-codes/regenerate", {
    method: "POST",
    body: JSON.stringify({ password }),
  })
  return res?.data || null
}

/**
 * Public — exchange a 2FA pending token + 6-digit code (or backup code)
 * for the real session JWT. Returns the same shape as a regular login:
 * { user, token }.
 */
export async function verifyLoginTwoFactor({ twoFactorToken, code }) {
  const response = await apiRequest("/api/v1/auth/2fa/login-verify", {
    method: "POST",
    body: JSON.stringify({ twoFactorToken, code }),
  })
  return response?.data || response
}
