/* ════════════════════════════════════════════════════════════════════════
   ResetPasswordPage · v6 · Cusana split-screen layout
   ────────────────────────────────────────────────────────────────────────
   Existing contract preserved:
     · POST /api/auth/reset-password/:token { password }
     · Token comes from /reset-password/:token route param

   Security & UX upgrades:
     · 10-character minimum (matches reference + stricter than backend's 8)
     · Live strength meter via existing scorePassword() heuristic — submit
       gated on score ≥ 3 (Medium)
     · Confirm-password live match indicator
     · Caps-Lock advisory
     · Expired/invalid token UX with one-click "{t("reset.newLink")}"
     · "Successfully reset" hero state matching the reference design
     · ARIA live region on errors
     · prefers-reduced-motion respected
   ════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { m, useReducedMotion } from "framer-motion"
import {
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldAlert,
} from "lucide-react"

import AuthShell from "../components/auth/AuthShell"
import AuthErrorBanner from "../components/auth/AuthErrorBanner"
import useCapsLock from "../hooks/useCapsLock"
import { scorePassword } from "../components/AuthInput"
import { apiPost } from "../lib/api"

const MIN_PW_LENGTH = 10

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } },
}
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}

const STRENGTH_META = {
  0: { label: "Too short", color: "bg-charcoal-80/15", text: "text-charcoal-80/65" },
  1: { label: "Weak", color: "bg-rose", text: "text-rose-700" },
  2: { label: "Weak", color: "bg-rose", text: "text-rose-700" },
  3: { label: "Medium", color: "bg-amber", text: "text-amber-700" },
  4: { label: "Strong", color: "bg-mint", text: "text-emerald-700" },
  5: { label: "Excellent", color: "bg-mint", text: "text-emerald-700" },
}

export default function ResetPasswordPage() {
  const { t } = useTranslation("auth")
  const { token } = useParams()
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const capsOn = useCapsLock()

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [showCf, setShowCf] = useState(false)

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  // error: null | string | { kind, title, body, action }
  const [error, setError] = useState(null)
  const [, setTokenExpired] = useState(false)

  const score = useMemo(() => scorePassword(password), [password])
  const meta = STRENGTH_META[score] || STRENGTH_META[0]
  const matches = confirm.length > 0 && password === confirm

  const submitDisabled =
    loading ||
    password.length < MIN_PW_LENGTH ||
    !matches ||
    score < 3

  // The "request a new link" action shared by every token-related error
  // path. Centralized so the affordance never drifts in copy or styling.
  const newLinkAction = (
    <Link
      to="/forgot-password"
      className="inline-flex items-center gap-1 rounded-md text-[12.5px] font-semibold text-violet underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
    >
      {t("reset.newLink") || "Request a new link"} →
    </Link>
  )

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!token) {
      setError({
        kind: "error",
        title: "Reset link is missing",
        body: "We can't find a valid token in this URL. Request a fresh password-reset email.",
        action: newLinkAction,
      })
      setTokenExpired(true)
      return
    }
    if (password.length < MIN_PW_LENGTH) {
      setError({
        kind: "warning",
        title: "Password is too short",
        body: `Use at least ${MIN_PW_LENGTH} characters — currently ${password.length}.`,
      })
      return
    }
    if (password !== confirm) {
      setError({
        kind: "warning",
        title: "Passwords don't match",
        body: "Re-enter the same password in both fields.",
      })
      return
    }
    if (score < 3) {
      setError({
        kind: "warning",
        title: "Choose a stronger password",
        body: "Mix uppercase, lowercase, numbers, and a symbol. The strength meter below shows your progress.",
      })
      return
    }

    setLoading(true)
    try {
      await apiPost(`/api/auth/reset-password/${token}`, { password })
      setSuccess(true)
      window.setTimeout(() => navigate("/login"), 3000)
    } catch (err) {
      const code = err?.code || ""
      const msg = err?.toUserMessage?.() || err?.message || ""
      if (code === "NETWORK_ERROR") {
        setError({
          kind: "warning",
          title: "Can't reach the server",
          body: "Check your internet connection and try again. If the problem persists, our servers may be briefly unavailable.",
        })
      } else if (/expired|invalid/i.test(msg)) {
        setTokenExpired(true)
        setError({
          kind: "error",
          title: "This reset link has expired",
          body: "Reset links are good for 30 minutes. Request a new one and we'll send a fresh email.",
          action: newLinkAction,
        })
      } else {
        setError(msg || "Failed to reset password. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <AuthShell
      >
        <m.div
          initial="hidden"
          animate="show"
          variants={reduce ? undefined : stagger}
          className="text-center"
        >
          <m.div
            variants={fadeUp}
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-mint shadow-[0_12px_36px_rgb(var(--color-mint-rgb)/0.40)] ring-4 ring-mint/15"
          >
            <CheckCircle2 className="h-8 w-8 text-white" />
          </m.div>

          <m.h1
            variants={fadeUp}
            className="mt-6 font-display text-[1.75rem] font-bold tracking-tight text-charcoal"
          >
            {t("reset.successTitle")}
          </m.h1>
          <m.p
            variants={fadeUp}
            className="mt-2 text-[14px] leading-6 text-charcoal-80/65"
          >
            {t("reset.successBody")}
          </m.p>

          <m.div variants={fadeUp} className="mt-7">
            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center rounded-xl bg-charcoal py-3.5 text-[14px] font-semibold text-white shadow-[var(--shadow-n3)] transition hover:-translate-y-0.5 hover:bg-charcoal-light focus:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
            >
              {t("reset.backToLogin")}
            </Link>
          </m.div>
        </m.div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
    >
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
            {t("reset.createNew")}
          </h1>
          <p className="mt-2 text-[14px] leading-6 text-charcoal-80/65">
            {t("reset.subtitle")}
          </p>
        </m.div>

        {error && (
          <m.div variants={fadeUp} className="mt-6">
            <AuthErrorBanner error={error} onDismiss={() => setError(null)} />
          </m.div>
        )}

        <m.form
          variants={reduce ? undefined : stagger}
          onSubmit={handleSubmit}
          noValidate
          className="mt-6 flex flex-col gap-4"
        >
          <m.div variants={fadeUp}>
            <label htmlFor="reset-password" className="mb-1.5 block text-[12px] font-semibold text-charcoal">
              {t("reset.newPasswordLabel")}
            </label>
            <div className="group relative">
              <Lock
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-80/35 transition group-focus-within:text-violet"
              />
              <input
                id="reset-password"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("reset.passwordPlaceholder")}
                autoComplete="new-password"
                required
                disabled={loading}
                className="block w-full rounded-xl border border-charcoal-80/15 bg-white py-3.5 pl-11 pr-12 text-[14px] text-charcoal outline-none transition placeholder:text-charcoal-80/35 focus:border-violet focus:ring-[3px] focus:ring-violet/15 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
                aria-pressed={showPw}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-charcoal-80/65 transition hover:text-violet focus:outline-none focus-visible:ring-2 focus-visible:ring-azure/40"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <div className="mt-2 flex items-center gap-2" aria-hidden={!password}>
              <div className="flex flex-1 gap-1">
                {[0, 1, 2, 3].map((i) => {
                  const filled = Math.min(4, Math.ceil(score))
                  return (
                    <span
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i < filled ? meta.color : "bg-charcoal-80/8"
                      }`}
                    />
                  )
                })}
              </div>
              <span
                className={`font-mono text-[10px] font-bold uppercase tracking-wide ${meta.text}`}
                role="status"
                aria-live="polite"
              >
                {password ? meta.label : ","}
              </span>
            </div>
            {/* Length-aware hint — turns rose when the password is shorter
                than MIN_PW_LENGTH so the user immediately sees why a
                strong-but-short password leaves Submit disabled. The
                strength meter scores variety; the gate also checks length. */}
            <p
              className={`mt-1.5 text-[11px] ${
                password.length > 0 && password.length < MIN_PW_LENGTH
                  ? "font-medium text-rose-700"
                  : "text-charcoal-80/65"
              }`}
            >
              {t("reset.mustBeAtLeast")} {MIN_PW_LENGTH} characters
              {password.length > 0 && password.length < MIN_PW_LENGTH
                ? ` (${password.length} / ${MIN_PW_LENGTH}).`
                : "."}
            </p>

            {capsOn && (
              <p
                role="status"
                aria-live="polite"
                className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-amber/10 px-2 py-1 text-[11px] font-medium text-amber-700"
              >
                <ShieldAlert className="h-3 w-3" /> {t("reset.capsLockOn")}
              </p>
            )}
          </m.div>

          <m.div variants={fadeUp}>
            <label htmlFor="reset-confirm" className="mb-1.5 block text-[12px] font-semibold text-charcoal">
              {t("reset.repeatNew")}
            </label>
            <div className="group relative">
              <Lock
                aria-hidden="true"
                className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 transition ${
                  confirm.length > 0
                    ? matches
                      ? "text-emerald-700"
                      : "text-rose-700"
                    : "text-charcoal-80/35 group-focus-within:text-violet"
                }`}
              />
              <input
                id="reset-confirm"
                type={showCf ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={t("reset.passwordPlaceholder")}
                autoComplete="new-password"
                required
                disabled={loading}
                aria-invalid={confirm.length > 0 && !matches ? true : undefined}
                className={`block w-full rounded-xl border bg-white py-3.5 pl-11 pr-12 text-[14px] text-charcoal outline-none transition placeholder:text-charcoal-80/35 focus:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60 ${
                  confirm.length === 0
                    ? "border-charcoal-80/15 focus:border-violet focus:ring-violet/15"
                    : matches
                    ? "border-mint/55 focus:border-mint focus:ring-mint/15"
                    : "border-rose/55 focus:border-rose focus:ring-rose/15"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowCf((v) => !v)}
                aria-label={showCf ? "Hide password" : "Show password"}
                aria-pressed={showCf}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-charcoal-80/65 transition hover:text-violet focus:outline-none focus-visible:ring-2 focus-visible:ring-azure/40"
              >
                {showCf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirm.length > 0 && (
              <p
                className={`mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium ${
                  matches ? "text-emerald-700" : "text-rose-700"
                }`}
                role="status"
                aria-live="polite"
              >
                {matches ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    {t("reset.passwordsMatch")}
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3 w-3" />
                    {t("reset.passwordsDontMatch")}
                  </>
                )}
              </p>
            )}
          </m.div>

          <m.button
            variants={fadeUp}
            type="submit"
            disabled={submitDisabled}
            aria-busy={loading || undefined}
            aria-describedby={submitDisabled && !loading ? "reset-disabled-hint" : undefined}
            className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-charcoal py-3.5 text-[14px] font-semibold text-white shadow-[var(--shadow-n3)] transition hover:-translate-y-0.5 hover:bg-charcoal-light focus:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating password…
              </span>
            ) : (
              "Submit"
            )}
          </m.button>

          {/* Surfacing the first unmet requirement when the button is
              disabled — the previous build silently disabled Submit when
              the password was strong but too short, leaving the user
              guessing why a click did nothing. */}
          {submitDisabled && !loading && (
            <p
              id="reset-disabled-hint"
              role="status"
              aria-live="polite"
              className="-mt-1 text-center text-[11.5px] text-charcoal-80/65"
            >
              {password.length < MIN_PW_LENGTH ? `Password needs at least ${MIN_PW_LENGTH} characters (${password.length} so far).`
                : !matches ? "Repeat your password — they need to match."
                : score < 3 ? "Use a stronger password (mix letters, numbers, and a symbol)."
                : "Complete the requirements above to continue."}
            </p>
          )}
        </m.form>
      </m.div>
    </AuthShell>
  )
}