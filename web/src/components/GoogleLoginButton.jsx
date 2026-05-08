import { useCallback, useEffect, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { loginWithGoogleCredential } from "../services/authService"

/* ──────────────────────────────────────────────────────────────────────────
 *  GoogleLoginButton · v2 · Brand Identity v3.0
 *  ────────────────────────────────────────────────────────────────────────
 *  A single, brand-aligned button — replaces the prior native-GSI render
 *  plus hand-rolled fallback. On click, triggers Google's One-Tap prompt;
 *  the credential flows back through the callback we register at
 *  `google.accounts.id.initialize()`.
 *
 *  Auth flow contract — UNCHANGED from prior version:
 *    · On successful Google credential → loginWithGoogleCredential()
 *    · Pass result through useAuth().loginWithGoogle()
 *    · Redirect to: explicit `redirectTo` > location.state.from > role default
 *    · Admin users → /admin; everyone else → /dashboard
 *
 *  Brand alignment (Brand v3.0 §11 button variants · §10 elevation):
 *    · Cloud-Mist surface · 1px charcoal/12 hairline · rounded-xl
 *    · Sora 600 · 14px label · charcoal/85 (4.96:1 contrast — WCAG AA)
 *    · Crisp 4-color official Google "G" mark (18px SVG, sharp at 2x)
 *    · Hover: −0.5px lift · shadow blooms · border deepens
 *    · Active: snaps back, shadow collapses
 *    · Focus-visible: 3px Deep Azure ring · 2px offset
 *    · Loading: spinner + "Signing you in…" · aria-busy
 *    · Disabled: 60% opacity · cursor-not-allowed · no hover lift
 *    · Min 48px height — exceeds WCAG 44px touch-target minimum
 *    · Full-width fluid · respects parent max-width on every breakpoint
 *
 *  Props:
 *    label?         · "signin" (default) · "signup" · "continue"
 *    onSuccess?(data)
 *    redirectTo?    · explicit destination after auth
 *    className?     · escape hatch for outer wrapper
 *  ──────────────────────────────────────────────────────────────────────── */

const LABEL_MAP = {
  signin: "Sign in with Google",
  signup: "Sign up with Google",
  continue: "Continue with Google",
}

export default function GoogleLoginButton({
  label = "signin",
  onSuccess,
  redirectTo,
  className = "",
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { loginWithGoogle } = useAuth()

  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [sdkReady, setSdkReady] = useState(false)

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  /* ── Auth callback ─────────────────────────────────────────────────── */
  const handleCredential = useCallback(
    async (credential) => {
      setError("")
      setLoading(true)
      try {
        const data = await loginWithGoogleCredential(credential)
        loginWithGoogle(data)
        const dest =
          redirectTo ||
          location.state?.from ||
          (data.user?.role === "admin" ? "/admin" : "/dashboard")
        navigate(dest, { replace: true })
        onSuccess?.(data)
      } catch (err) {
        setError(err.message || "Google sign-in failed. Please try again.")
      } finally {
        setLoading(false)
      }
    },
    [loginWithGoogle, navigate, location, redirectTo, onSuccess]
  )

  /* ── CWV · lazy-load the GSI script on first mount ─────────────────
   *
   *  Previously the Google Identity Services SDK was loaded by a
   *  `<script src="https://accounts.google.com/gsi/client" async defer>`
   *  in index.html, which downloaded ~80 KB of JS on EVERY public page
   *  even though only LoginPage / SignupPage / GoogleLoginButton actually
   *  need it. Now the script is injected into the document head only when
   *  GoogleLoginButton mounts. Polling continues to work as before.
   *  Subsequent mounts in the same session reuse the already-attached
   *  script (idempotent insert via id check).
   *  ────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!clientId) return
    if (window.google?.accounts?.id) {
      setSdkReady(true)
      return
    }

    // Inject the SDK script tag if it's not already there. Idempotent —
    // re-mounting the component (e.g. nav between LoginPage and SignupPage)
    // detects the existing element and skips the second insert.
    const SCRIPT_ID = "google-gsi-client"
    if (!document.getElementById(SCRIPT_ID)) {
      const el = document.createElement("script")
      el.id    = SCRIPT_ID
      el.src   = "https://accounts.google.com/gsi/client"
      el.async = true
      el.defer = true
      document.head.appendChild(el)
    }

    let attempts = 0
    function tryInit() {
      if (window.google?.accounts?.id) {
        setSdkReady(true)
        return
      }
      if (attempts++ < 25) setTimeout(tryInit, 200)
    }
    tryInit()
  }, [clientId])

  /* ── Initialize GSI once SDK is ready. We re-register the callback per
   * mount so the latest closure handles credentials correctly across
   * route changes (LoginPage ↔ SignupPage in the same session). ───── */
  useEffect(() => {
    if (!sdkReady || !clientId) return
    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (res) => handleCredential(res.credential),
        auto_select: false,
        cancel_on_tap_outside: true,
      })
    } catch (err) {
      // GSI rarely throws here, but if it does we surface a clear error
      // on click rather than crashing the page.
      // eslint-disable-next-line no-console
      console.warn("[GoogleLoginButton] init failed:", err.message)
    }
  }, [sdkReady, clientId, handleCredential])

  /* ── Click handler ─────────────────────────────────────────────────── */
  const handleClick = () => {
    setError("")
    if (!sdkReady) {
      setError("Google sign-in is still loading. Please try again in a moment.")
      return
    }
    try {
      window.google.accounts.id.prompt((notification) => {
        // Common reasons One Tap is suppressed:
        //   · User dismissed it three times in 24h
        //   · Third-party cookies disabled in the browser
        //   · ITP/Privacy modes (Safari, Brave) without exception
        if (
          notification?.isNotDisplayed?.() ||
          notification?.isSkippedMoment?.()
        ) {
          setError(
            "We could not start Google sign-in. Enable third-party cookies for accounts.google.com or use the email form above."
          )
        }
      })
    } catch (err) {
      setError(err.message || "Could not start Google sign-in.")
    }
  }

  if (!clientId) return null

  const labelText = loading
    ? "Signing you in…"
    : LABEL_MAP[label] || LABEL_MAP.signin

  return (
    <div className={`flex w-full flex-col gap-2.5 ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        aria-busy={loading || undefined}
        aria-label={labelText}
        className={[
          /* layout */
          "group relative inline-flex w-full items-center justify-center gap-3",
          "min-h-[48px] px-5 py-3 sm:py-3.5",
          /* surface */
          "rounded-xl border border-charcoal-80/12 bg-white",
          "shadow-[0_1px_2px_rgba(26,27,35,0.04)]",
          /* type */
          "font-display text-[14px] font-semibold text-charcoal-80/85 sm:text-[14.5px]",
          /* motion */
          "transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          /* hover */
          "hover:-translate-y-0.5 hover:border-charcoal-80/22 hover:bg-mist",
          "hover:shadow-[0_8px_20px_-6px_rgba(26,27,35,0.18)]",
          /* active */
          "active:translate-y-0 active:shadow-[0_1px_2px_rgba(26,27,35,0.04)]",
          /* focus */
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2",
          /* disabled */
          "disabled:cursor-not-allowed disabled:opacity-60",
          "disabled:hover:translate-y-0 disabled:hover:bg-white",
          "disabled:hover:shadow-[0_1px_2px_rgba(26,27,35,0.04)]",
        ].join(" ")}
      >
        {loading ? <SpinnerIcon /> : <GoogleGMark />}
        <span className="truncate">{labelText}</span>
      </button>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose/30 bg-rose/5 px-4 py-3 text-[13px] leading-[1.5] text-rose"
        >
          {error}
        </div>
      )}
    </div>
  )
}

/* ── Google "G" · official 4-color brand mark ────────────────────────────
 * Vector at 18×18 viewBox · stays sharp at any DPI · permitted under
 * Google's Sign-in with Google branding guidelines so long as the button
 * label includes "Google" verbatim. */
function GoogleGMark() {
  return (
    <svg
      viewBox="0 0 18 18"
      className="h-[18px] w-[18px] shrink-0"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.547 0 9c0 1.453.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  )
}

/* ── Spinner · inherits currentColor from the button label ─────────────── */
function SpinnerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px] shrink-0 animate-spin"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.2"
        strokeWidth="3"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}
