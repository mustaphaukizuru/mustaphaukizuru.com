import { createContext, useCallback, useContext, useEffect, useState } from "react"
import {
  clearStoredAuth, fetchMe, getStoredToken, getStoredUser,
  login as loginRequest, signup as signupRequest, storeAuth,
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

export function AuthProvider({ children }) {
  const [user,  setUser]  = useState(() => getStoredUser())
  const [token, setToken] = useState(() => getStoredToken())
  const [loading, setLoading] = useState(true)

  // ── Session expired event listener ──────────────────────────────────────
  useEffect(() => {
    function handleExpiry() {
      setUser(null)
      setToken(null)
    }
    window.addEventListener("auth:session-expired", handleExpiry)
    return () => window.removeEventListener("auth:session-expired", handleExpiry)
  }, [])

  // ── Bootstrap: verify stored token on mount ──────────────────────────────
  useEffect(() => {
    async function bootstrap() {
      const existingToken = getStoredToken()
      if (!existingToken) {
        setLoading(false)
        return
      }

      const storedUser = getStoredUser()
      if (storedUser) {
        setUser(storedUser)
        setToken(existingToken)
      }

      try {
        const me = await fetchMe()
        setUser(normalizeUser(me))
        setToken(existingToken)
      } catch (err) {
        const isNetworkError = err?.code === "NETWORK_ERROR" || err?.message?.includes("ERR_CONNECTION_REFUSED")

        if (isNetworkError) {
          console.warn("[Auth] API unreachable — using cached auth state")
        } else {
          clearStoredAuth()
          setUser(null)
          setToken(null)
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
    setToken(enriched.token)
    return enriched
  }, [])

  const login = useCallback(async (payload) => {
    const data = await loginRequest(payload)
    const enriched = { ...data, user: normalizeUser(data.user) }
    storeAuth(enriched)
    setUser(enriched.user)
    setToken(enriched.token)
    return enriched
  }, [])

  const loginWithGoogle = useCallback((data) => {
    const enriched = { ...data, user: normalizeUser(data.user) }
    storeAuth(enriched)
    setUser(enriched.user)
    setToken(enriched.token)
    return enriched
  }, [])

  const logout = useCallback(() => {
    clearStoredAuth()
    setUser(null)
    setToken(null)
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
      } catch {}
      return updated
    })
  }, [])

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user && !!token,
    signup,
    login,
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
