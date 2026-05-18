import { useCallback, useEffect, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { AlertOctagon, X as CloseIcon, Mail as MailIcon } from "lucide-react"
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

  // error shape: null | { title, body, kind } — `kind` lets us tailor the
  // tone (a "still loading" notice should feel softer than a hard failure).
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sdkReady, setSdkReady] = useState(false)

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  /* ── Auth callback ─────────────────────────────────────────────────── */
  const handleCredential = useCallback(
    async (credential) => {
      setError(null)
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
        setError({
          kind: "auth",
          title: "Google sign-in failed",
          body:
            err?.message ||
            "We could not verify your Google account. Please try again or sign in with your email.",
        })
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
    setError(null)
    if (!sdkReady) {
      setError({
        kind: "loading",
        title: "Google sign-in is still loading",
        body: "Give it a second and try again, or use the email form above.",
      })
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
          setError({
            kind: "cookies",
            title: "We could not start Google sign-in",
            body:
              "Your browser is blocking the sign-in window — usually because third-party cookies are off for accounts.google.com, or a privacy mode (Safari ITP, Brave Shields) is intercepting it.",
          })
        }
      })
    } catch (err) {
      setError({
        kind: "init",
        title: "Could not start Google sign-in",
        body: err?.message || "Please try again, or sign in with your email below.",
      })
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

      {error && <GoogleSignInError error={error} onDismiss={() => setError(null)} />}
    </div>
  )
}

/* ── Error surface · Brand v3 §11 form-error pattern ───────────────────────
 * Three-region card: icon · message · close. Tone shifts by `kind`:
 *   • cookies — soft amber wash (it's an instruction, not a failure)
 *   • loading — neutral charcoal-tinted info (transient, retry expected)
 *   • auth / init — Rose Signal (the hard-failure tier)
 * Container always carries role="alert" so screen readers announce it
 * the instant it appears.
 *
 * Refinement notes (v2):
 *   • The previous "fix-your-browser" hint list was rendered as upper-
 *     case monospace. On narrow widths the lines overflowed and got
 *     truncated mid-instruction ("ENABLE 3RD-PARTY C…"). It now renders
 *     as proper sentence-case rows with the browser name bolded and the
 *     setting path shown after an arrow — readable on every breakpoint,
 *     never truncated, and matches the cookies banner copy style.
 *   • Subtle inner "instruction" panel separates the help recipe from
 *     the alert body so the eye doesn't read it as part of the error.
 *   • The "sign in with email above" callout is now a real anchor that
 *     scrolls focus to the email input — usable as a recovery path, not
 *     just static reassurance copy. */

// Browser fix-instructions for the "cookies" failure. Kept in a single
// place so future browser additions (Arc, Opera, Vivaldi) drop in here.
const COOKIE_FIX_STEPS = [
  { browser: "Chrome / Edge", path: "Settings → Privacy → enable third-party cookies" },
  { browser: "Safari",        path: "Settings → Privacy → turn off Prevent cross-site tracking" },
  { browser: "Brave",         path: "Shields icon → turn off Cookies blocked for this site" },
]

function focusEmailField() {
  if (typeof document === "undefined") return
  const el = document.querySelector('input[type="email"], input[name="email"]')
  if (el && typeof el.focus === "function") {
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    setTimeout(() => el.focus({ preventScroll: true }), 280)
  }
}

function GoogleSignInError({ error, onDismiss }) {
  const isCookies = error.kind === "cookies"
  const isLoading = error.kind === "loading"

  const tone = isCookies
    ? {
        wrap:     "border-amber/30 bg-amber/[0.07]",
        iconWrap: "bg-amber/15 text-amber-700",
        title:    "text-charcoal",
        body:     "text-charcoal-80/75",
        stepPanel:"border-amber/15 bg-white/60",
      }
    : isLoading
    ? {
        wrap:     "border-charcoal-80/15 bg-charcoal-80/[0.04]",
        iconWrap: "bg-charcoal-80/10 text-charcoal-80/70",
        title:    "text-charcoal",
        body:     "text-charcoal-80/70",
        stepPanel:"border-charcoal-80/10 bg-white/60",
      }
    : {
        wrap:     "border-rose/30 bg-rose/[0.05]",
        iconWrap: "bg-rose/10 text-rose",
        title:    "text-charcoal",
        body:     "text-charcoal-80/75",
        stepPanel:"border-rose/15 bg-white/60",
      }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`relative overflow-hidden rounded-2xl border ${tone.wrap}`}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <span
          aria-hidden="true"
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone.iconWrap}`}
        >
          <AlertOctagon className="h-4 w-4" strokeWidth={2.2} />
        </span>

        <div className="min-w-0 flex-1">
          <p className={`text-[14px] font-bold leading-[1.35] ${tone.title}`}>
            {error.title}
          </p>
          <p className={`mt-1 text-[13px] leading-[1.55] ${tone.body}`}>
            {error.body}
          </p>

          {/* Browser-fix recipe — readable sentence case, no truncation.
              Each row: browser name (bold) + breadcrumb path. */}
          {isCookies && (
            <div className={`mt-3 space-y-1.5 rounded-xl border px-3 py-2.5 ${tone.stepPanel}`}>
              {COOKIE_FIX_STEPS.map((step) => (
                <div
                  key={step.browser}
                  className="flex flex-col gap-0.5 text-[12.5px] leading-[1.5] sm:flex-row sm:items-baseline sm:gap-2"
                >
                  <span className="shrink-0 font-semibold text-charcoal">
                    {step.browser}
                  </span>
                  <span className="text-charcoal-80/65">{step.path}</span>
                </div>
              ))}
            </div>
          )}

          {/* Email-recovery callout — now an actionable button. Focuses
              and scrolls to the email field above so users can complete
              sign-in without leaving this card. */}
          <button
            type="button"
            onClick={focusEmailField}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md text-[12.5px] font-semibold text-violet transition hover:text-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/30 focus-visible:ring-offset-2"
          >
            <MailIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="underline-offset-2 hover:underline">
              You can sign in with your email instead.
            </span>
          </button>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-charcoal-80/55 transition hover:bg-charcoal-80/5 hover:text-charcoal focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
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
