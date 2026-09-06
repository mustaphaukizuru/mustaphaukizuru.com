/* eslint-disable react-refresh/only-export-components -- provider + hook co-located */
import { createContext, useCallback, useContext, useEffect, useState } from "react"
import {
  clearStoredAuth, fetchMe, getStoredUser, hasStoredSession,
  login as loginRequest, signOut as signOutRequest,
  signup as signupRequest, storeAuth,
  verifyLoginTwoFactor as verifyLoginTwoFactorRequest,
} from "../services/authService"

const AuthContext = createContext(null)

// ── After login/signup, if there's no "from" page, land here ──────────────
// Dashboard is only reachable via the user dropdown menu — never auto-redirect
export const POST_AUTH_FALLBACK = "/store"

// ── Normalize avatar from various OAuth providers ─────────────────────────
// Google → picture, Firebase → photoURL, some backends → avatar / image.url
function normalizeUser(raw) {
  if (!raw) return raw
  const avatarUrl =
    raw.avatarUrl ||
    raw.picture ||
    raw.photoURL ||
    raw.avatar ||
    raw.image?.url ||
    raw.profileImage ||
    null
  return { ...raw, avatarUrl }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 40 · the session token is gone from this file.
//
// It now lives in the httpOnly `mu_session` cookie, which JS cannot read and
// therefore cannot hold in state. What the provider tracks is the USER — the
// display identity — and `isAuthenticated` is derived from that alone. The
// cached `auth-user` entry is only a paint-fast hint; `fetchMe()` on mount is
// what actually confirms the cookie is still valid, and a 401 from any request
// tears the local state down through the "auth:session-expired" event that
// lib/api.js dispatches.
// ─────────────────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser())
  const [loading, setLoading] = useState(true)

  // ── Session expired event listener ──────────────────────────────────────
  useEffect(() => {
    function handleExpiry() {
      setUser(null)
    }
    window.addEventListener("auth:session-expired", handleExpiry)
    return () => window.removeEventListener("auth:session-expired", handleExpiry)
  }, [])

  // ── Bootstrap: verify stored token on mount ──────────────────────────────
  useEffect(() => {
    async function bootstrap() {
      // No local trace of a session (no cached user, no mu_csrf cookie) → skip
      // the guaranteed-401 round trip. The session cookie itself is invisible
      // to us, so these are the only signals available client-side.
      if (!hasStoredSession()) {
        setLoading(false)
        return
      }

      const storedUser = getStoredUser()
      if (storedUser) setUser(storedUser)

      try {
        const me = await fetchMe()
        setUser(normalizeUser(me))
      } catch (err) {
        const isNetworkError = err?.code === "NETWORK_ERROR" || err?.message?.includes("ERR_CONNECTION_REFUSED")

        if (isNetworkError) {
          console.warn("[Auth] API unreachable, using cached auth state")
        } else {
          clearStoredAuth()
          setUser(null)
        }
      } finally {
        setLoading(false)
      }
    }
    bootstrap()
  }, [])

  // ── Auth actions ─────────────────────────────────────────────────────────
  const signup = useCallback(async (payload) => {
    const data = await signupRequest(payload)
    const enriched = { ...data, user: normalizeUser(data.user) }
    storeAuth(enriched)
    setUser(enriched.user)
    return enriched
  }, [])

  /**
   * Login (B09 update).
   *
   * Returns one of:
   *   { requires2FA: true, twoFactorToken }   — caller must show the 2FA prompt
   *   { user, token }                          — standard, session is now live
   *
   * If requires2FA is true, NO state is stored and `isAuthenticated` stays
   * false. Only after `completeTwoFactorLogin()` succeeds does the session
   * become live.
   */
  const login = useCallback(async (payload) => {
    const data = await loginRequest(payload)

    // ── 2FA gate — return as-is, no storage ──────────────────────────────
    if (data?.requires2FA) {
      return {
        requires2FA: true,
        twoFactorToken: data.twoFactorToken,
      }
    }

    // ── Standard path ──────────────────────────────────────────────────────
    const enriched = { ...data, user: normalizeUser(data.user) }
    try {
      storeAuth(enriched)
    } catch (err) {
      // Step 40 · this can no longer cost the user their session — that
      // arrived as an httpOnly cookie on the login response and survives a
      // storage failure. Only the cached display user is lost, so we warn and
      // carry on rather than aborting a login that actually succeeded.

      console.warn("[auth] storeAuth failed, continuing on the cookie session:", err)
    }
    setUser(enriched.user)
    return enriched
  }, [])

  /**
   * Complete a 2FA-gated login. Called by LoginPage after the user types
   * their 6-digit TOTP or a backup code.
   */
  const completeTwoFactorLogin = useCallback(async ({ twoFactorToken, code }) => {
    const data = await verifyLoginTwoFactorRequest({ twoFactorToken, code })
    const enriched = { ...data, user: normalizeUser(data.user) }
    storeAuth(enriched)
    setUser(enriched.user)
    return enriched
  }, [])

  const loginWithGoogle = useCallback((data) => {
    const enriched = { ...data, user: normalizeUser(data.user) }
    storeAuth(enriched)
    setUser(enriched.user)
    return enriched
  }, [])

  /**
   * Sign out. Step 40 · this MUST reach the server: the session cookie is
   * httpOnly (only the server can delete it) and its JWT stays valid until
   * the server bumps the user's revocation watermark. Clearing localStorage
   * alone would look signed-out while the session stayed alive. Local state is
   * cleared regardless of the network outcome.
   */
  const logout = useCallback(async () => {
    try {
      await signOutRequest()
    } catch {
      // Swallowed deliberately. The request layer already absorbs a network
      // failure, so reaching here means something unexpected — a storage
      // quota, the cache API throwing. The local cleanup below is what the
      // user asked for either way, and letting this reject shows up as an
      // unhandled rejection at every `onClick={logout}` call site.
    } finally {
      clearStoredAuth()
      setUser(null)
    }
  }, [])

  const updateUser = useCallback((updates) => {
    setUser((prev) => {
      if (!prev) return prev
      const updated = normalizeUser({ ...prev, ...updates })
      try {
        const stored = getStoredUser()
        if (stored) {
          localStorage.setItem("auth-user", JSON.stringify({ ...stored, ...updates }))
        }
      } catch { /* ignore */ }
      return updated
    })
  }, [])

  const value = {
    user,
    loading,
    // Step 40 · derived from the user alone — there is no client-visible token
    // to check any more. The cookie's validity is proven by requests
    // succeeding, and a 401 tears this down via "auth:session-expired".
    isAuthenticated: !!user,
    signup,
    login,
    completeTwoFactorLogin,
    loginWithGoogle,
    logout,
    updateUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
