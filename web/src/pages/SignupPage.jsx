/* ════════════════════════════════════════════════════════════════════════
   SignupPage · v6 · Cusana split-screen layout · stronger validation
   ────────────────────────────────────────────────────────────────────────
   Existing contract preserved:
     · AuthContext.signup({ fullName, email, password })
     · Google OAuth via GoogleLoginButton

   Security upgrades:
     · 10-character minimum (matches reference design + stricter than
       backend's 8-char floor, which remains the server-side guarantee)
     · Live strength meter via existing scorePassword() heuristic — submit
       gated on score ≥ 3 (Medium)
     · Confirm-password live match indicator
     · Honeypot field "company_role" — silently rejects bot submissions
     · Terms acceptance checkbox — required before submit
     · Email is trimmed + lowercased before submission
     · ARIA live region on errors · `role="alert"`
     · prefers-reduced-motion respected
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react"
import { useLocation } from "react-router-dom"
import { LocalizedLink as Link } from "../components/LocalizedLink"
import useNavigate from "../hooks/useLocalizedNavigate"
import { m, useReducedMotion } from "framer-motion"
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react"

import AuthShell from "../components/auth/AuthShell"
import AuthErrorBanner from "../components/auth/AuthErrorBanner"
import BrandMark from "../components/auth/BrandMark"
import GoogleLoginButton from "../components/GoogleLoginButton"
import MicrosoftLoginButton from "../components/MicrosoftLoginButton"
import FacebookLoginButton from "../components/FacebookLoginButton"
import { scorePassword } from "../components/AuthInput"
import { useAuth } from "../context/AuthContext"
import useCapsLock from "../hooks/useCapsLock"

import { useTranslation } from "react-i18next"
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PW_LENGTH = 10

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
  },
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

export default function SignupPage() {
  const { t } = useTranslation("auth")
  const navigate = useNavigate()
  const location = useLocation()
  const reduce = useReducedMotion()
  const { signup, isAuthenticated } = useAuth()

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [showCf, setShowCf] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [honeypot, setHoneypot] = useState("")

  const [loading, setLoading] = useState(false)
  // error: null | string | { kind, title, body, action }
  // The richer object shape unlocks contextual recovery actions —
  // most notably the "Sign in instead" link on duplicate-email errors.
  const [error, setError] = useState(null)

  const capsOn = useCapsLock()

  useEffect(() => {
    if (isAuthenticated) {
      navigate(location.state?.from || "/dashboard", { replace: true })
    }
  }, [isAuthenticated, navigate, location])

  const score = useMemo(() => scorePassword(password), [password])
  const meta = STRENGTH_META[score] || STRENGTH_META[0]
  const matches = confirm.length > 0 && password === confirm
  const emailValid = useMemo(() => EMAIL_RE.test(email.trim()), [email])

  const submitDisabled =
    loading ||
    !fullName.trim() ||
    !email.trim() ||
    password.length < MIN_PW_LENGTH ||
    !matches ||
    score < 3 ||
    !acceptedTerms

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (honeypot) return

    const cleanName = fullName.trim()
    const cleanEmail = email.trim().toLowerCase()

    if (cleanName.length < 2) {
      setError({
        kind: "warning",
        title: "Your full name is required",
        body: "Enter at least 2 characters — first and last name help personalize your dashboard.",
      })
      return
    }
    if (!EMAIL_RE.test(cleanEmail)) {
      setError({
        kind: "warning",
        title: "Email format looks off",
        body: "Make sure it follows name@example.com.",
      })
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
    if (!acceptedTerms) {
      setError({
        kind: "warning",
        title: "Please accept the Terms",
        body: "Tick the agreement below to continue. We treat your data as carefully as our own.",
      })
      return
    }

    setLoading(true)
    try {
      await signup({
        fullName: cleanName,
        email: cleanEmail,
        password,
      })
      navigate("/dashboard", { replace: true })
    } catch (err) {
      const code = err?.code || ""
      const msg = err?.toUserMessage?.() || err?.message || ""
      if (code === "NETWORK_ERROR") {
        setError({
          kind: "warning",
          title: "Can't reach the server",
          body: "Check your internet connection and try again. If the problem persists, our servers may be briefly unavailable.",
        })
      } else if (code === "DUPLICATE_ENTRY" || /exist/i.test(msg)) {
        // The single most actionable failure on this page: their email is
        // already in our database, so the cheapest path forward is signing
        // in — not creating a new account. Inline action makes that one tap.
        setError({
          kind: "error",
          title: "Account already exists",
          body: `An account with ${cleanEmail} is already registered. You can sign in instead, or reset your password if you've forgotten it.`,
          action: (
            <>
              <Link
                to="/login"
                state={{ prefillEmail: cleanEmail }}
                className="inline-flex items-center gap-1 rounded-md text-[12.5px] font-semibold text-violet underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
              >
                {t("signup.signInInstead")}
              </Link>
              <Link
                to="/forgot-password"
                className="inline-flex items-center gap-1 rounded-md text-[12.5px] font-semibold text-charcoal-80/65 underline-offset-2 hover:text-violet hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
              >
                {t("signup.resetPassword")}
              </Link>
            </>
          ),
        })
      } else if (code === "DB_UNAVAILABLE") {
        setError({
          kind: "warning",
          title: "Service temporarily unavailable",
          body: "We're briefly offline for maintenance. Please try again in a minute.",
        })
      } else {
        setError(msg || "Account creation failed. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
    >
      <m.div
        initial="hidden"
        animate="show"
        variants={reduce ? undefined : stagger}
      >
        <m.div variants={fadeUp} className="text-center">
          <BrandMark />
          <h1 className="mt-5 font-display text-[1.75rem] font-bold tracking-tight text-charcoal">
            {t("signup.title")}
          </h1>
          <p className="mt-2 text-[14px] leading-6 text-charcoal-80/65">
            {t("signup.subtitle")}
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
          <input
            type="text"
            name="company_role"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            aria-hidden="true"
            className="absolute left-[-9999px] h-0 w-0 opacity-0"
          />

          <m.div variants={fadeUp}>
            <label htmlFor="signup-name" className="mb-1.5 block text-[12px] font-semibold text-charcoal">
              {t("signup.nameLabel")}
            </label>
            <Field
              id="signup-name"
              icon={User}
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t("signup.namePlaceholder")}
              autoComplete="name"
              disabled={loading}
              required
            />
          </m.div>

          <m.div variants={fadeUp}>
            <label htmlFor="signup-email" className="mb-1.5 block text-[12px] font-semibold text-charcoal">
              {t("signup.emailLabel")}
            </label>
            <Field
              id="signup-email"
              icon={Mail}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("signup.emailPlaceholder")}
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              disabled={loading}
              required
              valid={email.length > 0 && emailValid}
            />
          </m.div>

          <m.div variants={fadeUp}>
            <label htmlFor="signup-password" className="mb-1.5 block text-[12px] font-semibold text-charcoal">
              {t("signup.passwordLabel")}
            </label>
            <Field
              id="signup-password"
              icon={Lock}
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("signup.passwordPlaceholder")}
              autoComplete="new-password"
              disabled={loading}
              required
              right={
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  aria-pressed={showPw}
                  className="rounded-md p-1.5 text-charcoal-80/65 transition hover:text-violet focus:outline-none focus-visible:ring-2 focus-visible:ring-azure/40"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />

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
            <p className="mt-1.5 text-[11px] text-charcoal-80/65">
              {t("signup.mustBeAtLeast")} {MIN_PW_LENGTH} {t("signup.pwHint")}
            </p>

            {capsOn && (
              <p
                role="status"
                aria-live="polite"
                className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-amber/10 px-2 py-1 text-[11px] font-medium text-amber-700"
              >
                <ShieldAlert className="h-3 w-3" /> {t("signup.capsLockOn")}
              </p>
            )}
          </m.div>

          <m.div variants={fadeUp}>
            <label htmlFor="signup-confirm" className="mb-1.5 block text-[12px] font-semibold text-charcoal">
              {t("signup.repeatPassword")}
            </label>
            <Field
              id="signup-confirm"
              icon={Lock}
              type={showCf ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={t("signup.repeatPlaceholder")}
              autoComplete="new-password"
              disabled={loading}
              required
              valid={matches}
              invalid={confirm.length > 0 && !matches}
              right={
                <button
                  type="button"
                  onClick={() => setShowCf((v) => !v)}
                  aria-label={showCf ? "Hide password" : "Show password"}
                  aria-pressed={showCf}
                  className="rounded-md p-1.5 text-charcoal-80/65 transition hover:text-violet focus:outline-none focus-visible:ring-2 focus-visible:ring-azure/40"
                >
                  {showCf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
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
                    {t("signup.passwordsMatch")}
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3 w-3" />
                    {t("signup.passwordsDontMatch")}
                  </>
                )}
              </p>
            )}
          </m.div>

          <m.label
            variants={fadeUp}
            className="mt-1 inline-flex cursor-pointer items-start gap-2.5 text-[12.5px] leading-5 text-charcoal-80/75"
          >
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-charcoal-80/30 text-violet focus:ring-violet/20"
            />
            <span>
              {t("signup.iAgree")}{" "}
              <Link to="/terms" className="font-semibold text-violet hover:text-violet-deep">
                {t("signup.termsLink")}
              </Link>{" "}
              {t("signup.andConnective")}{" "}
              <Link to="/privacy" className="font-semibold text-violet hover:text-violet-deep">
                {t("signup.privacyShort")}
              </Link>
              .
            </span>
          </m.label>

          <m.button
            variants={fadeUp}
            type="submit"
            disabled={submitDisabled}
            aria-busy={loading || undefined}
            className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-charcoal py-3.5 text-[14px] font-semibold text-white shadow-[0_10px_30px_rgba(26,27,35,0.18)] transition hover:-translate-y-0.5 hover:bg-charcoal-light focus:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("signup.creatingAccount")}
              </span>
            ) : (
              t("signup.createAccount") || "Sign Up"
            )}
          </m.button>
        </m.form>

        <m.div variants={fadeUp} className="mt-6">
          <div className="relative flex items-center gap-3">
            <div className="h-px flex-1 bg-charcoal-80/10" />
            <span className="text-[12px] font-medium text-charcoal-80/65">
              {t("signup.orSignupWith")}
            </span>
            <div className="h-px flex-1 bg-charcoal-80/10" />
          </div>
          <div className="mt-4 flex flex-col gap-3">
            <GoogleLoginButton label="signup" />
            <MicrosoftLoginButton label="signup" />
            <FacebookLoginButton label="signup" />
          </div>
        </m.div>

        <m.p
          variants={fadeUp}
          className="mt-7 text-center text-[13px] text-charcoal-80/65"
        >
          {t("signup.alreadyHave")}{" "}
          <Link to="/login" className="font-semibold text-violet transition hover:text-violet-deep">
            {t("signup.signIn")}
          </Link>
        </m.p>
      </m.div>
    </AuthShell>
  )
}

/* ──────────────────────────────────────────────────────────────────────
 * Field — local input primitive used only by SignupPage.
 * Mirrors the visual contract of AuthShell-styled inputs while supporting
 * inline `valid` / `invalid` states for live confirm-match feedback.
 * ────────────────────────────────────────────────────────────────────── */
function Field({
  id,
  icon: Icon,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
  disabled,
  inputMode,
  spellCheck,
  autoCapitalize,
  autoCorrect,
  right,
  valid,
  invalid,
}) {
  const borderClass = invalid
    ? "border-rose/55 focus:border-rose focus:ring-rose/15"
    : valid
    ? "border-mint/55 focus:border-mint focus:ring-mint/15"
    : "border-charcoal-80/15 focus:border-violet focus:ring-violet/15"

  return (
    <div className="group relative">
      {Icon && (
        <Icon
          aria-hidden="true"
          className={`pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 transition ${
            invalid
              ? "text-rose-700"
              : valid
              ? "text-emerald-700"
              : "text-charcoal-80/35 group-focus-within:text-violet"
          }`}
        />
      )}
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        spellCheck={spellCheck}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        required={required}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={`block w-full rounded-xl border bg-white py-3.5 pl-11 ${
          right ? "pr-12" : "pr-4"
        } text-[14px] text-charcoal outline-none transition placeholder:text-charcoal-80/35 focus:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60 ${borderClass}`}
      />
      {right && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">{right}</div>
      )}
    </div>
  )
}
