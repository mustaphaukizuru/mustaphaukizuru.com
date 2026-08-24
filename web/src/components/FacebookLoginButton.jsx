import { useLocation } from "react-router-dom"
import { AlertOctagon, X as CloseIcon, Mail as MailIcon } from "lucide-react"
import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { API_BASE_URL } from "../lib/api"

/**
 * FacebookLoginButton · OAuth redirect flow
 * ─────────────────────────────────────────────────────────────────────────
 * Follows the exact same pattern as GoogleLoginButton and MicrosoftLoginButton.
 * Full-page redirect to /api/auth/facebook/start → Meta OAuth → callback →
 * session handed off via URL fragment on /auth/facebook/return.
 *
 * Requires on the server:
 *   FACEBOOK_CLIENT_ID         — Meta App Dashboard → App ID
 *   FACEBOOK_CLIENT_SECRET     — Meta App Dashboard → App Secret
 *   FACEBOOK_OAUTH_REDIRECT_URI — exact URI registered in Meta App → Facebook Login → Settings
 *
 * Props:
 *   label       — "signin" | "signup" | "continue"  (default "signin")
 *   redirectTo  — post-login path  (default /dashboard)
 *   className   — extra wrapper classes
 */

const SERVER_ERROR_KEYS = {
  cancelled:            "social.cancelledFacebook",
  state_mismatch:       "social.sessionExpired",
  exchange_failed:      "social.failedFacebook",
  server_misconfigured: "social.notConfiguredFacebook",
  unavailable:          "social.unavailableFacebook",
}

export default function FacebookLoginButton({
  label = "signin",
  redirectTo,
  className = "",
}) {
  const { t } = useTranslation("auth")
  const location = useLocation()
  const [dismissedError, setDismissedError] = useState(false)

  const LABEL_MAP = {
    signin:   t("social.signinFacebook"),
    signup:   t("social.signupFacebook"),
    continue: t("social.continueFacebook"),
  }

  const searchParams = new URLSearchParams(location.search)
  const errorReason = searchParams.get("facebook")
  const errorKey = errorReason && !dismissedError ? SERVER_ERROR_KEYS[errorReason] : null
  const serverError = errorKey ? t(errorKey) : null

  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset dismissal when the URL error param changes
  useEffect(() => { setDismissedError(false) }, [errorReason])

  const returnTo = redirectTo
    || (location.state?.from && typeof location.state.from === "string" ? location.state.from : null)
    || "/dashboard"

  const startHref = `${API_BASE_URL}/api/auth/facebook/start?return_to=${encodeURIComponent(returnTo)}`
  const labelText = LABEL_MAP[label] || LABEL_MAP.signin

  return (
    <div className={`flex w-full flex-col gap-2.5 ${className}`}>
      <a
        href={startHref}
        aria-label={labelText}
        className={[
          "group relative inline-flex w-full items-center justify-center gap-3",
          "min-h-[48px] px-5 py-3 sm:py-3.5",
          "rounded-xl border border-charcoal-80/12 bg-white",
          "shadow-[0_1px_2px_rgb(var(--color-charcoal-rgb)/0.04)]",
          "font-display text-[14px] font-semibold text-charcoal-80/85 sm:text-[14.5px]",
          "transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "hover:-translate-y-0.5 hover:border-charcoal-80/22 hover:bg-mist",
          "hover:shadow-[0_8px_20px_-6px_rgb(var(--color-charcoal-rgb)/0.18)]",
          "active:translate-y-0 active:shadow-[0_1px_2px_rgb(var(--color-charcoal-rgb)/0.04)]",
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2",
        ].join(" ")}
      >
        <FacebookMark />
        <span className="truncate">{labelText}</span>
      </a>

      {serverError && (
        <OAuthError
          message={serverError}
          onDismiss={() => setDismissedError(true)}
        />
      )}
    </div>
  )
}

/* ── Facebook "f" brand mark ─────────────────────────────────────────────
 * Official Facebook brand color #1877F2.
 * Permitted under Meta's Brand Resource Center guidelines. */
function FacebookMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px] shrink-0"
      aria-hidden="true"
    >
      <path
        fill="#1877F2"
        d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.791-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.931-1.956 1.887v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"
      />
    </svg>
  )
}

/* ── Shared error surface ──────────────────────────────────────────────── */
function OAuthError({ message, onDismiss }) {
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
            onClick={() => {
              const el = document.querySelector('input[type="email"], input[name="email"]')
              if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => el.focus({ preventScroll: true }), 280) }
            }}
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
          className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-charcoal-80/55 transition hover:bg-charcoal-80/5 hover:text-charcoal focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
