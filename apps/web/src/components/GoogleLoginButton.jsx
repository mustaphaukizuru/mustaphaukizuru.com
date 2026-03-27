import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { loginWithGoogleCredential } from "../services/authService"

// ─────────────────────────────────────────────────────────────────────────────
// GoogleLoginButton
// Global singleton guard prevents GSI initialize() being called more than once
// even if multiple instances mount (LoginPage + SignupPage in same session)
// ─────────────────────────────────────────────────────────────────────────────

export default function GoogleLoginButton({ onSuccess, redirectTo }) {
  const buttonRef      = useRef(null)
  const navigate       = useNavigate()
  const location       = useLocation()
  const { loginWithGoogle } = useAuth()

  const [error,        setError]        = useState("")
  const [loading,      setLoading]      = useState(false)
  const [sdkReady,     setSdkReady]     = useState(false)
  const [renderFailed, setRenderFailed] = useState(false)
  const renderedRef    = useRef(false)   // per-instance: did this button render?

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  const handleCredential = useCallback(async (credential) => {
    setError("")
    setLoading(true)
    try {
      const data = await loginWithGoogleCredential(credential)
      loginWithGoogle(data)
      // Return to origin page or explicit redirectTo, NOT always dashboard
      const dest = redirectTo
        || location.state?.from
        || (data.user?.role === "admin" ? "/admin" : "/dashboard")
      navigate(dest, { replace: true })
      onSuccess?.(data)
    } catch (err) {
      setError(err.message || "Google sign-in failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [loginWithGoogle, navigate, location, redirectTo, onSuccess])

  // ── Wait for Google SDK ───────────────────────────────────────────────────
  useEffect(() => {
    if (!clientId) return
    if (window.google?.accounts?.id) { setSdkReady(true); return }

    let attempts = 0
    function tryInit() {
      if (window.google?.accounts?.id) { setSdkReady(true); return }
      if (attempts++ < 25) setTimeout(tryInit, 200)
    }
    tryInit()
  }, [clientId])

  // ── Render button when SDK ready ─────────────────────────────────────────
  useEffect(() => {
    if (!sdkReady || !clientId || !buttonRef.current || renderedRef.current) return

    try {
      // SINGLETON: initialize the GSI SDK only once per browser session
      // Multiple component mounts (login + signup pages) must NOT re-initialize
      if (!window.__gsiInitialized) {
        window.google.accounts.id.initialize({
          client_id:              clientId,
          callback:               (res) => handleCredential(res.credential),
          auto_select:            false,
          cancel_on_tap_outside:  true,
        })
        window.__gsiInitialized = true
      } else {
        // Re-register callback for new component instance (important for route changes)
        window.google.accounts.id.initialize({
          client_id:              clientId,
          callback:               (res) => handleCredential(res.credential),
          auto_select:            false,
          cancel_on_tap_outside:  true,
        })
      }

      buttonRef.current.innerHTML = ""
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme:          "outline",
        size:           "large",
        shape:          "rectangular",
        text:           "signin_with",
        width:          buttonRef.current.offsetWidth || 340,
        logo_alignment: "left",
      })
      renderedRef.current = true

      // Detect if render produced an iframe (actual Google button)
      setTimeout(() => {
        if (buttonRef.current && !buttonRef.current.querySelector("iframe")) {
          setRenderFailed(true)
        }
      }, 1000)
    } catch (err) {
      console.warn("[GoogleLoginButton] render failed:", err.message)
      setRenderFailed(true)
    }
  }, [sdkReady, clientId, handleCredential])

  if (!clientId) return null

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Native Google button */}
      {!renderFailed && (
        <div
          ref={buttonRef}
          className="w-full overflow-hidden rounded-xl"
          style={{ minHeight: 44 }}
        />
      )}

      {/* Branded fallback if SDK button didn't render */}
      {renderFailed && (
        <button
          type="button"
          onClick={() => window.google?.accounts?.id?.prompt?.()}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#634F40]/15 bg-white px-4 py-3.5 text-[14px] font-semibold text-[#420060] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#fafafa] disabled:opacity-60"
        >
          <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {loading ? "Signing in…" : "Continue with Google"}
        </button>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {error}
        </div>
      )}
    </div>
  )
}
