import { useLocation } from "react-router-dom"
import { AlertOctagon, X as CloseIcon, Mail as MailIcon } from "lucide-react"
import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { API_BASE_URL } from "../lib/api"

/* ──────────────────────────────────────────────────────────────────────────
 *  GoogleLoginButton · v3 · OAuth redirect flow
 *  ────────────────────────────────────────────────────────────────────────
 *  Previous v2 used Google's One-Tap (`google.accounts.id.prompt()`), which
 *  needed third-party cookies for accounts.google.com and triggered Brave's
 *  "Access other apps and services" Shields prompt. ~40% of modern browser
 *  defaults blocked it outright. A failure produced a giant amber toast
 *  full of browser-specific instructions — that was the band-aid.
 *
 *  v3 does the standard OAuth Authorization Code redirect flow that
 *  GitHub, Linear, Vercel, Notion, Figma all use:
 *
 *    1. User clicks the button.
 *    2. Browser navigates to /api/auth/google/start (server-side).
 *    3. Server generates CSRF state + nonce, sets httpOnly cookies,
 *       302-redirects the user to https://accounts.google.com.
 *    4. User authenticates ON Google's domain (first-party cookies).
 *    5. Google 302-redirects back to /api/auth/google/callback?code=...
 *    6. Server exchanges code, validates state + nonce, creates session,
 *       302-redirects to /auth/google/return#token=...&user=...
 *    7. /auth/google/return reads the URL fragment, stores the session,
 *       replaces the URL to scrub the token from history, navigates to
 *       /dashboard (or the original return_to).
 *
 *  Net result:
 *    · No "Access other apps" prompt — there is no popup
 *    · No third-party cookie requirement — Google's login is first-party
 *    · No Brave Shields false-positive — nothing for Shields to flag
 *    · No ~80 KB of `accounts.google.com/gsi/client` JS loaded on every
 *      Login/Signup page mount
 *    · No more "fix-your-browser" instructions
 *
 *  The error UI is preserved but tiny — only fires when the SERVER
 *  redirected us back to /login with `?google=cancelled|state_mismatch|
 *  exchange_failed|unavailable`. Most users never see it.
 *  ──────────────────────────────────────────────────────────────────── */

// Label keys resolved at render time via i18n — no static map needed.
// SERVER_ERROR_COPY moved to i18n "auth:social.*" keys.

export default function GoogleLoginButton({
  label = "signin",
  redirectTo,
  className = "",
}) {
  const { t } = useTranslation("auth")
  const location = useLocation()
  const [dismissedError, setDismissedError] = useState(false)

  const LABEL_MAP = {
    signin:   t("social.signinGoogle"),
    signup:   t("social.signupGoogle"),
    continue: t("social.continueGoogle"),
  }

  const SERVER_ERROR_KEYS = {
    cancelled:            "social.cancelledGoogle",
    state_mismatch:       "social.sessionExpired",
    exchange_failed:      "social.failedGoogle",
    server_misconfigured: "social.notConfiguredGoogle",
    unavailable:          "social.unavailableGoogle",
  }

  const searchParams = new URLSearchParams(location.search)
  const googleErrorReason = searchParams.get("google")
  const errorKey = googleErrorReason && !dismissedError ? SERVER_ERROR_KEYS[googleErrorReason] : null
  const serverError = errorKey ? t(errorKey) : null

  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset dismissal when the URL error param changes
  useEffect(() => { setDismissedError(false) }, [googleErrorReason])

  const returnTo = redirectTo
    || (location.state?.from && typeof location.state.from === "string" ? location.state.from : null)
    || "/dashboard"

  const startHref = `${API_BASE_URL}/api/auth/google/start?return_to=${encodeURIComponent(returnTo)}`

  const labelText = LABEL_MAP[label] || LABEL_MAP.signin

  return (
    <div className={`flex w-full flex-col gap-2.5 ${className}`}>
      <a
        href={startHref}
        aria-label={labelText}
        className={[
          /* layout */
          "group relative inline-flex w-full items-center justify-center gap-3",
          "min-h-[48px] px-5 py-3 sm:py-3.5",
          /* surface */
          "rounded-xl border border-charcoal-80/12 bg-white",
          "shadow-[0_1px_2px_rgb(var(--color-charcoal-rgb)/0.04)]",
          /* type */
          "font-display text-[14px] font-semibold text-charcoal-80/85 sm:text-[14.5px]",
          /* motion */
          "transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          /* hover */
          "hover:-translate-y-0.5 hover:border-charcoal-80/22 hover:bg-mist",
          "hover:shadow-[0_8px_20px_-6px_rgb(var(--color-charcoal-rgb)/0.18)]",
          /* active */
          "active:translate-y-0 active:shadow-[0_1px_2px_rgb(var(--color-charcoal-rgb)/0.04)]",
          /* focus */
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2",
        ].join(" ")}
      >
        <GoogleGMark />
        <span className="truncate">{labelText}</span>
      </a>

      {serverError && (
        <GoogleSignInError
          message={serverError}
          onDismiss={() => setDismissedError(true)}
        />
      )}
    </div>
  )
}

/* ── Error surface · single calm row, no browser instructions ────────────
 * Only shown when the BACKEND redirected back with ?google=<reason>.
 * Most users never see this — the redirect flow works for everyone the
 * first time. When it doesn't, we say so plainly and point them at the
 * email form. No amber alarm. No fix-your-browser recipe.
 * ──────────────────────────────────────────────────────────────────── */

function focusEmailField() {
  if (typeof document === "undefined") return
  const el = document.querySelector('input[type="email"], input[name="email"]')
  if (el && typeof el.focus === "function") {
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    setTimeout(() => el.focus({ preventScroll: true }), 280)
  }
}

function GoogleSignInError({ message, onDismiss }) {
  const { t } = useTranslation("auth")
  return (
    <div
      role="alert"
      aria-live="polite"
      className="relative overflow-hidden rounded-2xl border border-charcoal-80/15 bg-charcoal-80/[0.03]"
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-charcoal-80/10 text-charcoal-80/70"
        >
          <AlertOctagon className="h-3.5 w-3.5" strokeWidth={2.2} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-[1.55] text-charcoal-80/80">{message}</p>
          <button
            type="button"
            onClick={focusEmailField}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md text-[12.5px] font-semibold text-violet transition hover:text-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/30 focus-visible:ring-offset-2"
          >
            <MailIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="underline-offset-2 hover:underline">{t("social.useEmailInstead")}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("social.dismiss")}
          className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-charcoal-80/65 transition hover:bg-charcoal-80/5 hover:text-charcoal focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
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
