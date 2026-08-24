/* ════════════════════════════════════════════════════════════════════════
   AuthErrorBanner · shared error surface for auth + form flows
   ────────────────────────────────────────────────────────────────────────
   One canonical error card used by LoginPage · SignupPage ·
   ForgotPasswordPage · ResetPasswordPage · and any form that surfaces a
   server-side failure inside an AuthShell-like layout.

   Brand alignment (Brand Identity v3.0 §11 + §05):
     · Rose Signal var(--color-rose) reserved for hard failures (kind="error")
     · Amber Glow var(--color-amber) for recoverable warnings (kind="warning")
     · Charcoal-tinted neutral for transient info (kind="info")
     · Icon plate · title + body hierarchy · optional inline action
     · role="alert" + aria-live="assertive" wired automatically
     · Optional dismiss × button with keyboard support

   Backward-compatible API:
     · Pass a plain string  →  rendered as a single-line error message
     · Pass an object       →  { title, body, kind?, action? }
       where `action` is a ReactNode (Link / button) rendered inline at
       the right of the body, useful for "Sign in instead" affordances
       when a duplicate-email is detected during signup.
   ════════════════════════════════════════════════════════════════════════ */

import { AlertOctagon, AlertTriangle, Info, X as CloseIcon } from "lucide-react"

const TONE = {
  error: {
    icon: AlertOctagon,
    wrap: "border-rose/30 bg-rose/[0.05]",
    iconWrap: "bg-rose/10 text-rose",
    title: "text-charcoal",
    body: "text-charcoal-80/75",
    role: "alert",
    live: "assertive",
  },
  warning: {
    icon: AlertTriangle,
    wrap: "border-amber/30 bg-amber/[0.06]",
    iconWrap: "bg-amber/15 text-amber-700",
    title: "text-charcoal",
    body: "text-charcoal-80/75",
    role: "alert",
    live: "polite",
  },
  info: {
    icon: Info,
    wrap: "border-charcoal-80/15 bg-charcoal-80/[0.04]",
    iconWrap: "bg-charcoal-80/10 text-charcoal-80/70",
    title: "text-charcoal",
    body: "text-charcoal-80/70",
    role: "status",
    live: "polite",
  },
}

/**
 * Normalise the error prop into the canonical { kind, title, body, action }
 * shape. Strings are treated as the body of a generic error so existing
 * callers (`setError("Incorrect email or password.")`) keep working without
 * a refactor of every handler.
 */
function normalise(error) {
  if (!error) return null
  if (typeof error === "string") {
    return { kind: "error", title: null, body: error, action: null }
  }
  return {
    kind: error.kind || "error",
    title: error.title || null,
    body: error.body || error.message || "",
    action: error.action || null,
  }
}

export default function AuthErrorBanner({ error, onDismiss, className = "" }) {
  const data = normalise(error)
  if (!data) return null

  const tone = TONE[data.kind] || TONE.error
  const Icon = tone.icon

  return (
    <div
      role={tone.role}
      aria-live={tone.live}
      className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 text-[13px] leading-[1.55] ${tone.wrap} ${className}`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tone.iconWrap}`}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
      </span>

      <div className="min-w-0 flex-1">
        {data.title && (
          <p className={`font-semibold leading-[1.35] ${tone.title}`}>
            {data.title}
          </p>
        )}
        {data.body && (
          <p className={`${data.title ? "mt-0.5" : ""} ${tone.body}`}>
            {data.body}
          </p>
        )}
        {data.action && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {data.action}
          </div>
        )}
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-charcoal-80/55 transition hover:bg-charcoal-80/5 hover:text-charcoal focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

export { AuthErrorBanner }
