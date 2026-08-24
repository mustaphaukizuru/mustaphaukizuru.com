/* ════════════════════════════════════════════════════════════════════════
   ForgotPasswordPage · v7 · marketing-rail layout
   ────────────────────────────────────────────────────────────────────────
   Existing contract preserved:
     · POST /api/auth/forgot-password { email }
     · Backend always returns 200 with neutral copy (no user enumeration)

   Security & UX:
     · 60-second resend cooldown
     · Smart "Open Gmail / Outlook / Yahoo / iCloud / Proton" deep link
     · Honeypot field "address" — silently rejects bot submissions
     · Email is trimmed + lowercased before submission
     · ARIA live region on errors
     · Dev-mode fallback: surfaces resetUrl if SMTP failed (NODE_ENV !== production)
     · prefers-reduced-motion respected
   ════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { m, useReducedMotion } from "framer-motion"
import {
  Mail,
  ArrowLeft,
  Loader2,
  Inbox,
  ExternalLink,
} from "lucide-react"

import AuthShell from "../components/auth/AuthShell"
import AuthErrorBanner from "../components/auth/AuthErrorBanner"
import useCountdown from "../hooks/useCountdown"
import { apiPost } from "../lib/api"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESEND_SECONDS = 60

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } },
}
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}

function inboxForEmail(email = "") {
  const domain = email.split("@")[1]?.toLowerCase() || ""
  if (!domain) return null
  if (/(^|\.)gmail\.com$/.test(domain) || /(^|\.)googlemail\.com$/.test(domain)) {
    return { label: "Open Gmail", url: "https://mail.google.com" }
  }
  if (/(outlook|hotmail|live|msn)\.com$/.test(domain)) {
    return { label: "Open Outlook", url: "https://outlook.live.com/mail" }
  }
  if (/(yahoo|ymail|rocketmail)\.com$/.test(domain)) {
    return { label: "Open Yahoo Mail", url: "https://mail.yahoo.com" }
  }
  if (/(^|\.)icloud\.com$/.test(domain) || /(^|\.)me\.com$/.test(domain)) {
    return { label: "Open iCloud Mail", url: "https://www.icloud.com/mail" }
  }
  if (/(^|\.)proton(mail)?\.(com|me)$/.test(domain)) {
    return { label: "Open Proton Mail", url: "https://mail.proton.me" }
  }
  return { label: `Open ${domain}`, url: `https://${domain}` }
}

export default function ForgotPasswordPage() {
  const { t } = useTranslation("auth")
  const reduce = useReducedMotion()
  const cooldown = useCountdown()

  const [email, setEmail] = useState("")
  const [honeypot, setHoneypot] = useState("")
  const [loading, setLoading] = useState(false)
  // error: null | string | { kind, title, body, action }
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)
  // devResetUrl is only ever populated outside production AND only when the
  // server's email pipeline failed — see authController.forgotPassword.
  // It exists so Mustapha can recover local-dev flows when SMTP is broken.
  const [devResetUrl, setDevResetUrl] = useState("")

  const emailValid = useMemo(() => EMAIL_RE.test(email.trim()), [email])
  const inbox = useMemo(() => inboxForEmail(email.trim()), [email])

  async function submitRequest(e) {
    e?.preventDefault?.()
    setError(null)
    if (honeypot) return
    const cleanEmail = email.trim().toLowerCase()
    if (!EMAIL_RE.test(cleanEmail)) {
      setError({
        kind: "warning",
        title: "Email format looks off",
        body: t("forgot.invalidEmail") || "Make sure it follows name@example.com.",
      })
      return
    }
    if (cooldown.isRunning) return

    setLoading(true)
    try {
      const resp = await apiPost("/api/auth/forgot-password", { email: cleanEmail })
      const devUrl = resp?.data?.devResetUrl || ""
      setDevResetUrl(devUrl)
      setSent(true)
      cooldown.start(RESEND_SECONDS)
    } catch (err) {
      const code = err?.code || ""
      const msg = err?.toUserMessage?.() || err?.message || ""
      if (code === "NETWORK_ERROR") {
        setError({
          kind: "warning",
          title: "Can't reach the server",
          body: "Check your internet connection and try again. If the problem persists, our servers may be briefly unavailable.",
        })
      } else if (code === "DB_UNAVAILABLE") {
        setError({
          kind: "warning",
          title: "Service temporarily unavailable",
          body: "We're briefly offline for maintenance. Please try again in a minute.",
        })
      } else {
        setError(msg || "Failed to send reset link. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <AuthShell>
        <m.div
          initial="hidden"
          animate="show"
          variants={reduce ? undefined : stagger}
          className="text-center"
        >
          <m.div
            variants={fadeUp}
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet to-violet-deep shadow-[0_12px_36px_rgb(var(--color-violet-rgb)/0.40)] ring-4 ring-violet-pale"
          >
            <Inbox className="h-7 w-7 text-white" />
          </m.div>

          <m.h1
            variants={fadeUp}
            className="mt-6 font-display text-[1.75rem] font-bold tracking-tight text-charcoal"
          >
            {t("forgot.checkEmail")}
          </m.h1>
          <m.p
            variants={fadeUp}
            className="mt-2 text-[14px] leading-6 text-charcoal-80/65"
          >
            {t("forgot.weSent")}{" "}
            <span className="font-semibold text-charcoal">{email.trim().toLowerCase()}</span>{t("forgot.checkInbox")}
          </m.p>

          <m.div variants={fadeUp} className="mt-7 flex flex-col gap-3">
            {inbox && (
              <a
                href={inbox.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-charcoal py-3.5 text-[14px] font-semibold text-white shadow-[0_10px_30px_rgb(var(--color-charcoal-rgb)/0.18)] transition hover:-translate-y-0.5 hover:bg-charcoal-light focus:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
              >
                {inbox.label}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}

            <button
              type="button"
              onClick={submitRequest}
              disabled={loading || cooldown.isRunning}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-charcoal-80/15 bg-white py-3 text-[13px] font-semibold text-violet transition hover:bg-violet-pale disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Resending…
                </>
              ) : cooldown.isRunning ? (
                `Resend in ${cooldown.seconds}s`
              ) : (
                "Resend email"
              )}
            </button>
          </m.div>

          {devResetUrl && (
            <m.div
              variants={fadeUp}
              role="status"
              className="mt-5 rounded-xl border border-amber-300 bg-amber/10 px-4 py-3 text-left text-[12px] text-amber-700"
            >
              <strong className="block text-[11px] uppercase tracking-wider text-amber-700">
                {t("forgot.devMode")}
              </strong>
              <p className="mt-1 leading-5">
                {t("forgot.emailUndelivered")}
              </p>
              <a
                href={devResetUrl}
                className="mt-1 block break-all font-mono text-[11px] text-violet hover:underline"
              >
                {devResetUrl}
              </a>
            </m.div>
          )}

          <m.p
            variants={fadeUp}
            className="mt-6 text-[12.5px] text-charcoal-80/55"
          >
            {t("forgot.didntReceive")}{" "}
            <Link to="/contact" className="font-semibold text-violet hover:text-violet-deep">
              {t("forgot.contactSupport")}
            </Link>
            .
          </m.p>

          <m.div variants={fadeUp} className="mt-8">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-80/65 transition hover:text-violet"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("forgot.backToSignin")}
            </Link>
          </m.div>
        </m.div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <m.div
        initial="hidden"
        animate="show"
        variants={reduce ? undefined : stagger}
      >
        <m.div variants={fadeUp}>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal-80/65 transition hover:text-violet"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
        </m.div>

        <m.div variants={fadeUp} className="mt-6 text-center">
          <h1 className="font-display text-[1.75rem] font-bold tracking-tight text-charcoal">
            {t("forgot.title")}
          </h1>
          <p className="mt-2 text-[14px] leading-6 text-charcoal-80/65">
            {t("forgot.subtitle")}
          </p>
        </m.div>

        {error && (
          <m.div variants={fadeUp} className="mt-6">
            <AuthErrorBanner error={error} onDismiss={() => setError(null)} />
          </m.div>
        )}

        <m.form
          variants={reduce ? undefined : stagger}
          onSubmit={submitRequest}
          noValidate
          className="mt-6 flex flex-col gap-4"
        >
          <input
            type="text"
            name="address"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            aria-hidden="true"
            className="absolute left-[-9999px] h-0 w-0 opacity-0"
          />

          <m.div variants={fadeUp}>
            <label htmlFor="forgot-email" className="mb-1.5 block text-[12px] font-semibold text-charcoal">
              Email
            </label>
            <div className="group relative">
              <Mail
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-80/35 transition group-focus-within:text-violet"
              />
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("forgot.emailPlaceholder")}
                autoComplete="email"
                inputMode="email"
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                required
                disabled={loading}
                className="block w-full rounded-xl border border-charcoal-80/15 bg-white py-3.5 pl-11 pr-4 text-[14px] text-charcoal outline-none transition placeholder:text-charcoal-80/35 focus:border-violet focus:ring-[3px] focus:ring-violet/15 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </m.div>

          <m.button
            variants={fadeUp}
            type="submit"
            disabled={loading || cooldown.isRunning}
            aria-busy={loading || undefined}
            aria-describedby={!emailValid && email.length > 0 ? "forgot-email-hint" : (cooldown.isRunning ? "forgot-cooldown-hint" : undefined)}
            className="mt-1 inline-flex w-full items-center justify-center rounded-xl bg-charcoal py-3.5 text-[14px] font-semibold text-white shadow-[0_10px_30px_rgb(var(--color-charcoal-rgb)/0.18)] transition hover:-translate-y-0.5 hover:bg-charcoal-light focus:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending…
              </span>
            ) : cooldown.isRunning ? (
              `Try again in ${cooldown.seconds}s`
            ) : (
              "Submit"
            )}
          </m.button>

          {/* Surfacing why the user might not see what they expect:
              · empty form → submit fires validation, shows error inline
              · invalid email → hint below the button (button stays clickable
                so the validation message can render predictably)
              · cooldown → countdown is on the button itself */}
          {!loading && !cooldown.isRunning && email.length > 0 && !emailValid && (
            <p
              id="forgot-email-hint"
              role="status"
              aria-live="polite"
              className="-mt-1 text-center text-[11.5px] text-rose-700"
            >
              {t("forgot.invalidEmail")}
            </p>
          )}
          {cooldown.isRunning && !loading && (
            <p
              id="forgot-cooldown-hint"
              role="status"
              aria-live="polite"
              className="-mt-1 text-center text-[11.5px] text-charcoal-80/60"
            >
              Wait {cooldown.seconds}s before requesting another reset link.
            </p>
          )}
        </m.form>
      </m.div>
    </AuthShell>
  )
}
