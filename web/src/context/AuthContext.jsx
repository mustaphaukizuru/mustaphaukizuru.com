import { createContext, useCallback, useContext, useEffect, useState } from "react"
import {
  clearStoredAuth, fetchMe, getStoredToken, getStoredUser,
  login as loginRequest, signup as signupRequest, storeAuth,
} from "../services/authService"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(() => getStoredUser())  // eager init — no flicker
  const [token,   setToken]   = useState(() => getStoredToken())
  const [loading, setLoading] = useState(true)                   // only true during initial verify

  // ── Session expired event listener ───────────────────────────────────────
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

      // Show stored user instantly while verifying with server (zero flicker)
      const storedUser = getStoredUser()
      if (storedUser) {
        setUser(storedUser)
        setToken(existingToken)
      }

      try {
        const me = await fetchMe()
        setUser(me)
        setToken(existingToken)
      } catch (err) {
        const isNetworkError =
          err?.code === "NETWORK_ERROR" ||
          err?.message?.includes("ERR_CONNECTION_REFUSED") ||
          err?.message?.includes("Failed to fetch") ||
          err?.message?.includes("Could not connect")

        if (isNetworkError) {
          // API temporarily unreachable (server starting up, brief outage, etc.)
          // Keep the cached auth state — do NOT log the user out
          // They will be re-verified on next successful API call
          console.warn("[Auth] API unreachable — using cached auth state")
        } else {
          // Token is genuinely invalid or expired — clear and force re-login
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
    storeAuth(data)
    setUser(data.user)
    setToken(data.token)
    return data
  }, [])

  const login = useCallback(async (payload) => {
    const data = await loginRequest(payload)
    storeAuth(data)
    setUser(data.user)
    setToken(data.token)
    return data
  }, [])

  const loginWithGoogle = useCallback((data) => {
    storeAuth(data)
    setUser(data.user)
    setToken(data.token)
    return data
  }, [])

  const logout = useCallback(() => {
    clearStoredAuth()
    setUser(null)
    setToken(null)
  }, [])

  const updateUser = useCallback((updates) => {
    setUser((prev) => prev ? { ...prev, ...updates } : prev)
    try {
      const stored = getStoredUser()
      if (stored) {
        localStorage.setItem("auth-user", JSON.stringify({ ...stored, ...updates }))
      }
    } catch {}
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