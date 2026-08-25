import {
  apiRequest,
  authFetch,
  clearStoredAuth as clearStoredAuthFromApi,
  getStoredToken as getStoredTokenFromApi,
  getStoredUser as getStoredUserFromApi,
  hasStoredSession as hasStoredSessionFromApi,
  setStoredAuth,
  signOut as signOutFromApi,
} from "../lib/api"

/* ────────────────────────────────────────────────────────────────────────────
 * Storage helpers
 *
 * Audit M1 · these used to be a second, hand-rolled copy of the localStorage
 * helpers in lib/api.js — two implementations of the same thing that drifted
 * apart. They are now thin re-exports of the lib/api.js originals, so there is
 * exactly ONE place that knows how the session is persisted. That single point
 * mattered for step 40: switching the session to an httpOnly cookie needed one
 * edit, not a hunt through parallel copies.
 * ──────────────────────────────────────────────────────────────────────────── */

/** @deprecated Step 40 — always null; the session token is httpOnly. */
export const getStoredToken = getStoredTokenFromApi
export const getStoredUser = getStoredUserFromApi
export const clearStoredAuth = clearStoredAuthFromApi
export const hasStoredSession = hasStoredSessionFromApi

/**
 * Full sign-out: asks the server to clear the httpOnly cookies and revoke the
 * JWT, then wipes the cached display user. Prefer this over clearStoredAuth()
 * — local-only cleanup cannot end a cookie session.
 */
export const signOut = signOutFromApi

/**
 * Persist the post-login state.
 *
 * Step 40 · only `user` is stored; the session itself arrived on the same
 * response as an httpOnly `mu_session` cookie. `data.token` may still be
 * present (rollout shim) and is deliberately ignored.
 */
export function storeAuth(data) {
  if (!data?.user) {
    throw new Error("Invalid authentication payload")
  }
  setStoredAuth({ user: data.user })
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
