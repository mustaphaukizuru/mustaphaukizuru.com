import { useLocation } from "react-router-dom"
import { AlertOctagon, X as CloseIcon, Mail as MailIcon } from "lucide-react"
import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { API_BASE_URL } from "../lib/api"

/**
 * MicrosoftLoginButton · OAuth redirect flow
 * ─────────────────────────────────────────────────────────────────────────
 * Identical pattern to GoogleLoginButton — full-page redirect to
 * /api/auth/microsoft/start, returns via /api/auth/microsoft/callback,
 * hands off session via URL fragment on /auth/microsoft/return.
 *
 * Requires on the server:
 *   MICROSOFT_CLIENT_ID       — Azure App Registration → Application ID
 *   MICROSOFT_CLIENT_SECRET   — Azure App Registration → Client Secret value
 *   MICROSOFT_OAUTH_REDIRECT_URI — exact redirect URI registered in Azure
 *
 * Props:
 *   label       — "signin" | "signup" | "continue"  (default "signin")
 *   redirectTo  — post-login path  (default /dashboard)
 *   className   — extra wrapper classes
 */

const SERVER_ERROR_KEYS = {
  cancelled:            "social.cancelledMicrosoft",
  state_mismatch:       "social.sessionExpired",
  exchange_failed:      "social.failedMicrosoft",
  server_misconfigured: "social.notConfiguredMicrosoft",
  unavailable:          "social.unavailableMicrosoft",
}

export default function MicrosoftLoginButton({
  label = "signin",
  redirectTo,
  className = "",
}) {
  const { t } = useTranslation("auth")
  const location = useLocation()
  const [dismissedError, setDismissedError] = useState(false)

  const LABEL_MAP = {
    signin:   t("social.signinMicrosoft"),
    signup:   t("social.signupMicrosoft"),
    continue: t("social.continueMicrosoft"),
  }

  const searchParams = new URLSearchParams(location.search)
  const errorReason = searchParams.get("microsoft")
  const errorKey = errorReason && !dismissedError ? SERVER_ERROR_KEYS[errorReason] : null
  const serverError = errorKey ? t(errorKey) : null

  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset dismissal when the URL error param changes
  useEffect(() => { setDismissedError(false) }, [errorReason])

  const returnTo = redirectTo
    || (location.state?.from && typeof location.state.from === "string" ? location.state.from : null)
    || "/dashboard"

  const startHref = `${API_BASE_URL}/api/auth/microsoft/start?return_to=${encodeURIComponent(returnTo)}`
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
        <MicrosoftMark />
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

/* ── Microsoft four-square logo ─────────────────────────────────────────
 * Official Microsoft brand mark — four colored squares.
 * Permitted under Microsoft's Brand/Logo guidelines for sign-in buttons. */
function MicrosoftMark() {
  return (
    <svg
      viewBox="0 0 21 21"
      className="h-[18px] w-[18px] shrink-0"
      aria-hidden="true"
    >
      <rect x="1"  y="1"  width="9" height="9" fill="#F25022" />
      <rect x="11" y="1"  width="9" height="9" fill="#7FBA00" />
      <rect x="1"  y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  )
}

/* ── Shared error surface — same visual as Google's ───────────────────── */
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
