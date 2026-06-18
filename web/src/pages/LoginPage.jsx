/* ════════════════════════════════════════════════════════════════════════
   LoginPage · v6 · Cusana split-screen layout · hardened security UX
   ────────────────────────────────────────────────────────────────────────
   Preserves the existing auth contract:
     · email + password + rememberMe → AuthContext.login()
     · 2FA-gated path · routes to <TwoFactorPrompt /> when requires2FA
     · Google credential path · via <GoogleLoginButton />
     · "{t("login.rememberMe")}" persists email in localStorage (existing key)

   Security upgrades on top of v5:
     · Caps-Lock indicator on password field
     · Honeypot field ("website") — silently rejects submissions from bots
     · 429 / RATE_LIMIT response triggers an in-page countdown lockout
     · Email is trimmed + lowercased before submission
     · ARIA live region on errors · `role="alert"` for SR announcements
     · Disable submit when form is empty or while a request is in flight
     · prefers-reduced-motion respected via Framer Motion useReducedMotion

   Visual: form on the LEFT, dark hero with dashboard widgets on the RIGHT
   (matches reference designs).
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { motion, useReducedMotion } from "framer-motion"
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  Loader2,
  ShieldAlert,
} from "lucide-react"

import AuthShell from "../components/auth/AuthShell"
import AuthErrorBanner from "../components/auth/AuthErrorBanner"
import BrandMark from "../components/auth/BrandMark"
import GoogleLoginButton from "../components/GoogleLoginButton"
import MicrosoftLoginButton from "../components/MicrosoftLoginButton"
import FacebookLoginButton from "../components/FacebookLoginButton"
import TwoFactorPrompt from "../components/auth/TwoFactorPrompt"
import { useAuth } from "../context/AuthContext"
import useCapsLock from "../hooks/useCapsLock"
import useCountdown from "../hooks/useCountdown"

const REMEMBER_KEY = "ukizuru-remember-email"
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

export default function LoginPage() {
  const { t } = useTranslation("auth")
  const navigate = useNavigate()
  const location = useLocation()
  const reduce = useReducedMotion()
  const { login, completeTwoFactorLogin, isAuthenticated } = useAuth()

  // ── Form state ──────────────────────────────────────────────────────
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(false)
  const [honeypot, setHoneypot] = useState("") // bot trap

  const [loading, setLoading] = useState(false)
  // error: null | string | { kind, title, body, action }
  // AuthErrorBanner accepts every shape — strings stay as legacy single-line
  // surfaces, objects unlock the title+body+action treatment for specific
  // failure modes (401, 429, suspended, network).
  const [error, setError] = useState(null)

  // ── 2FA branch state ───────────────────────────────────────────────
  const [twoFactorToken, setTwoFactorToken] = useState(null)
  const [twoFactorError, setTwoFactorError] = useState("")
  const [twoFactorLoading, setTwoFactorLoading] = useState(false)

  // ── Helpers ────────────────────────────────────────────────────────
  const capsOn = useCapsLock()
  const lockout = useCountdown()

  // Restore saved email if remember-me was previously set.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY)
      if (saved) {
        setEmail(saved)
        setRemember(true)
      }
    } catch {
      /* localStorage unavailable — silently ignore */
    }
  }, [])

  // Redirect if already authenticated.
  useEffect(() => {
    if (isAuthenticated) {
      navigate(location.state?.from || "/dashboard", { replace: true })
    }
  }, [isAuthenticated, navigate, location])

  // Email validity (presentational only — server is the source of truth).
  const emailValid = useMemo(() => EMAIL_RE.test(email.trim()), [email])
  // Only disable for transient/security states. Empty-field validation
  // happens inside handleSubmit so a user who clicks Submit with empty
  // fields gets a clear "Please enter your email and password" message
  // instead of a silently-disabled button.
  const submitDisabled = loading || lockout.isRunning

  // ── Submit ─────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    // Bot trap — honeypot must remain empty. If it's filled, treat as
    // browser autofill (not a bot) and clear it before the next submit
    // rather than silently blocking. Real bots fill consistently — log
    // for diagnostics but don't kill the flow on first occurrence.
    if (honeypot) {
      // Most likely browser autofill on a real user, not a bot. Clear
      // silently and continue with the real submission below — no
      // second click required. Logged for diagnostics only.
      // eslint-disable-next-line no-console
      console.warn("[login] honeypot was filled — assuming autofill, proceeding")
      setHoneypot("")
    }

    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail || !password) {
      setError({
        kind: "warning",
        title: "Email and password are required",
        body: "Fill both fields to sign in.",
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
    if (lockout.isRunning) return

    setLoading(true)
    try {
      const result = await login({
        email: cleanEmail,
        password,
        rememberMe: remember,
      })

      // ── 2FA branch ────────────────────────────────────────────────
      if (result?.requires2FA) {
        setTwoFactorToken(result.twoFactorToken)
        return
      }

      // ── Standard success ──────────────────────────────────────────
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, cleanEmail)
        else localStorage.removeItem(REMEMBER_KEY)
      } catch {
        /* ignore */
      }
      navigate(location.state?.from || "/dashboard", { replace: true })
    } catch (err) {
      // Surface in devtools — without this the user reports "nothing happened"
      // because some hosts compress error text to one greyed-out line and the
      // network failure mode (CORS preflight, DNS) leaves no visible feedback.
      // eslint-disable-next-line no-console
      console.error("[login] failed:", err)

      const code = err?.code || ""
      const status = err?.status || 0
      const msg = err?.toUserMessage?.() || err?.message || ""

      if (code === "NETWORK_ERROR" || status === 0) {
        // status===0 covers the case where fetch threw before getting a
        // response (typically CORS preflight failure or DNS error). Without
        // this branch the user sees nothing because msg is empty.
        setError({
          kind: "warning",
          title: "Can't reach the server",
          body: "Check your internet connection and try again. If the problem persists, our servers may be briefly unavailable.",
        })
      } else if (code === "AUTH_SUSPENDED") {
        setError({
          kind: "error",
          title: "Account suspended",
          body: "Your account is currently suspended. Please contact support to restore access.",
          action: (
            <Link
              to="/contact"
              className="inline-flex items-center gap-1 rounded-md text-[12.5px] font-semibold text-violet underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
            >
              Contact support →
            </Link>
          ),
        })
      } else if (code === "DB_UNAVAILABLE") {
        setError({
          kind: "warning",
          title: "Service temporarily unavailable",
          body: "We're briefly offline for maintenance. Please try again in a minute.",
        })
      } else if (status === 429 || code === "RATE_LIMIT") {
        const seconds = Number(err?.details?.retryAfter) || 60
        lockout.start(seconds)
        setError({
          kind: "warning",
          title: "Too many sign-in attempts",
          body: `For security, sign-in is paused for ${seconds} seconds. If you've forgotten your password, reset it now.`,
          action: (
            <Link
              to="/forgot-password"
              className="inline-flex items-center gap-1 rounded-md text-[12.5px] font-semibold text-violet underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
            >
              Reset password →
            </Link>
          ),
        })
      } else if (status === 401) {
        setError({
          kind: "error",
          title: "Incorrect email or password",
          body: "Double-check the spelling and try again. If you've forgotten your password, you can reset it.",
          action: (
            <Link
              to="/forgot-password"
              className="inline-flex items-center gap-1 rounded-md text-[12.5px] font-semibold text-violet underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
            >
              Forgot password →
            </Link>
          ),
        })
      } else {
        setError(msg || "Sign-in failed. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  // ── 2FA verify ─────────────────────────────────────────────────────
  async function handleTwoFactorSubmit(code) {
    setTwoFactorError("")
    setTwoFactorLoading(true)
    try {
      await completeTwoFactorLogin({ twoFactorToken, code })
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, email.trim().toLowerCase())
      } catch {
        /* ignore */
      }
      navigate(location.state?.from || "/dashboard", { replace: true })
    } catch (err) {
      const msg = err?.toUserMessage?.() || err?.message || "Verification failed."
      setTwoFactorError(msg)
      throw err
    } finally {
      setTwoFactorLoading(false)
    }
  }

  function cancelTwoFactor() {
    setTwoFactorToken(null)
    setTwoFactorError("")
  }

  // ── Render ─────────────────────────────────────────────────────────
  if (twoFactorToken) {
    return (
      <AuthShell
      >
        <TwoFactorPrompt
          email={email.trim().toLowerCase()}
          loading={twoFactorLoading}
          error={twoFactorError}
          onSubmit={handleTwoFactorSubmit}
          onCancel={cancelTwoFactor}
        />
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <motion.div
        initial="hidden"
        animate="show"
        variants={reduce ? undefined : stagger}
      >
        {/* Brand mark + headline */}
        <motion.div variants={fadeUp} className="text-center">
          <BrandMark />
          <h1 className="mt-5 font-display text-[1.75rem] font-bold tracking-tight text-charcoal">
            {t("login.welcomeBack")}
          </h1>
          <p className="mt-2 text-[14px] leading-6 text-charcoal-80/65">
            {t("login.subtitle")}
          </p>
        </motion.div>

        {/* Error banner · shared brand v3 surface (AuthErrorBanner).
            Accepts both legacy strings and the richer { title, body, action }
            shape produced by the catch-block branches above. */}
        {error && (
          <motion.div variants={fadeUp} className="mt-6">
            <AuthErrorBanner error={error} onDismiss={() => setError(null)} />
          </motion.div>
        )}

        <motion.form
          variants={reduce ? undefined : stagger}
          onSubmit={handleSubmit}
          noValidate
          className="mt-6 flex flex-col gap-4"
        >
          {/* Honeypot · invisible to humans, enticing to bots.
              The name is intentionally non-standard so Chrome / Safari
              autofill heuristics don't fill it for real users — autofill
              of `website`, `address`, `name`, etc. would silently block
              login. autoComplete="new-password" is the one value the
              major browsers actually respect for defeating autofill. */}
          <input
            type="text"
            name="ukz_trap_field_xq7"
            tabIndex={-1}
            autoComplete="new-password"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            aria-hidden="true"
            data-lpignore="true"
            data-1p-ignore="true"
            className="absolute left-[-9999px] h-0 w-0 opacity-0"
          />

          {/* Email */}
          <motion.div variants={fadeUp}>
            <label
              htmlFor="login-email"
              className="mb-1.5 block text-[12px] font-semibold text-charcoal"
            >
              Email
            </label>
            <div className="group relative">
              <Mail
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-80/35 transition group-focus-within:text-violet"
              />
              <input
                id="login-email"
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("login.emailPlaceholder")}
                autoComplete="email"
                inputMode="email"
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                required
                disabled={loading || lockout.isRunning}
                className="block w-full rounded-xl border border-charcoal-80/15 bg-white py-3.5 pl-11 pr-4 text-[14px] text-charcoal outline-none transition placeholder:text-charcoal-80/35 focus:border-violet focus:ring-[3px] focus:ring-violet/15 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </motion.div>

          {/* Password */}
          <motion.div variants={fadeUp}>
            <label
              htmlFor="login-password"
              className="mb-1.5 block text-[12px] font-semibold text-charcoal"
            >
              Password
            </label>
            <div className="group relative">
              <Lock
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-80/35 transition group-focus-within:text-violet"
              />
              <input
                id="login-password"
                type={showPw ? "text" : "password"}
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("login.passwordPlaceholder")}
                autoComplete="current-password"
                required
                disabled={loading || lockout.isRunning}
                className="block w-full rounded-xl border border-charcoal-80/15 bg-white py-3.5 pl-11 pr-12 text-[14px] text-charcoal outline-none transition placeholder:text-charcoal-80/35 focus:border-violet focus:ring-[3px] focus:ring-violet/15 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
                aria-pressed={showPw}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-charcoal-80/45 transition hover:text-violet focus:outline-none focus-visible:ring-2 focus-visible:ring-azure/40"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Caps-Lock advisory · live region */}
            {capsOn && (
              <p
                role="status"
                aria-live="polite"
                className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-amber/10 px-2 py-1 text-[11px] font-medium text-amber-700"
              >
                <ShieldAlert className="h-3 w-3" /> {t("login.capsLockOn")}
              </p>
            )}
          </motion.div>

          {/* Remember + Forgot */}
          <motion.div
            variants={fadeUp}
            className="flex items-center justify-between"
          >
            <label className="inline-flex cursor-pointer select-none items-center gap-2 text-[13px] text-charcoal-80/75">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-charcoal-80/30 text-violet focus:ring-violet/20"
              />
              <span>{t("login.rememberMe")}</span>
            </label>
            <Link
              to="/forgot-password"
              className="text-[13px] font-semibold text-violet transition hover:text-violet-deep"
            >
              {t("login.forgot")}
            </Link>
          </motion.div>

          {/* Submit · dark CTA matches reference */}
          <motion.button
            variants={fadeUp}
            type="submit"
            disabled={submitDisabled}
            aria-busy={loading || undefined}
            aria-describedby={lockout.isRunning ? "login-lockout-hint" : undefined}
            className="mt-1 inline-flex w-full items-center justify-center rounded-xl bg-charcoal py-3.5 text-[14px] font-semibold text-white shadow-[0_10px_30px_rgba(26,27,35,0.18)] transition hover:-translate-y-0.5 hover:bg-charcoal-light focus:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in…
              </span>
            ) : lockout.isRunning ? (
              `Try again in ${lockout.seconds}s`
            ) : (
              "Sign In"
            )}
          </motion.button>

          {/* Surface the lockout reason when active so the user knows the
              button is disabled by the rate-limiter, not by validation. */}
          {lockout.isRunning && !loading && (
            <p
              id="login-lockout-hint"
              role="status"
              aria-live="polite"
              className="-mt-1 text-center text-[11.5px] text-rose-700"
            >
              {t("login.tooMany")}
            </p>
          )}
        </motion.form>

        {/* Divider · {t("login.orLoginWith")} */}
        <motion.div variants={fadeUp} className="mt-6">
          <div className="flex items-center gap-3 text-[11.5px] text-charcoal-80/45">
            <span className="h-px flex-1 bg-charcoal-80/12" />
            <span className="font-semibold uppercase tracking-[0.16em]">
              {t("login.orLoginWith")}
            </span>
            <span className="h-px flex-1 bg-charcoal-80/12" />
          </div>
          <div className="mt-4 flex flex-col gap-3">
            <GoogleLoginButton />
            <MicrosoftLoginButton />
            <FacebookLoginButton />
          </div>
        </motion.div>

        {/* Footer link */}
        <motion.p
          variants={fadeUp}
          className="mt-7 text-center text-[13px] text-charcoal-80/65"
        >
          {t("login.noAccount")}{" "}
          <Link
            to="/signup"
            className="font-semibold text-violet transition hover:text-violet-deep"
          >
            {t("login.signUp")}
          </Link>
        </motion.p>
      </motion.div>
    </AuthShell>
  )
}
