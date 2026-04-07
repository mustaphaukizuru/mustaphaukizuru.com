import { useEffect, useState } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { motion } from "framer-motion"
import { Eye, EyeOff, Mail, Lock, Sparkles } from "lucide-react"
import AuthBrandPanel from "../components/AuthBrandPanel"
import GoogleLoginButton from "../components/GoogleLoginButton"
import { useAuth } from "../context/AuthContext"

const fadeUp = { hidden:{opacity:0,y:16}, show:{opacity:1,y:0,transition:{duration:0.38,ease:"easeOut"}} }
const stagger = { hidden:{}, show:{transition:{staggerChildren:0.06}} }

function AuthInput({ icon: Icon, type="text", value, onChange, placeholder, right, autoComplete }) {
  return (
    <div className="relative">
      {Icon && <Icon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#634F40]/35 pointer-events-none" />}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-xl border border-[#634F40]/15 bg-[#fafafa] py-3.5 pl-11 pr-10 text-[14px] text-[#420060] outline-none transition focus:border-[#420060]/40 focus:bg-white focus:ring-2 focus:ring-[#420060]/8 placeholder:text-[#634F40]/35"
      />
      {right && <div className="absolute right-3 top-1/2 -translate-y-1/2">{right}</div>}
    </div>
  )
}

export default function LoginPage() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const { login, isAuthenticated } = useAuth()

  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [showPw,   setShowPw]   = useState(false)
  const [remember, setRemember] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState("")

  // Restore saved email if remember-me was set
  useEffect(() => {
    const saved = localStorage.getItem("ukizuru-remember-email")
    if (saved) { setEmail(saved); setRemember(true) }
  }, [])

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate(location.state?.from || "/dashboard", { replace: true })
    }
  }, [isAuthenticated, navigate, location])

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    if (!email || !password) { setError("Please enter your email and password."); return }

    setLoading(true)
    try {
      // Pass rememberMe → backend generates 30d token when true
      await login({ email, password, rememberMe: remember })

      // Persist email for next login if remember-me checked
      if (remember) localStorage.setItem("ukizuru-remember-email", email)
      else          localStorage.removeItem("ukizuru-remember-email")

      navigate(location.state?.from || "/dashboard", { replace: true })
    } catch (err) {
      const code = err.code || ""
      const msg  = err.message || ""
      if (code === "NETWORK_ERROR" || msg.includes("connect")) {
        setError("Cannot reach the server. Please check your connection and try again.")
      } else if (code === "AUTH_SUSPENDED") {
        setError("Your account has been suspended. Please contact support.")
      } else if (code === "DB_UNAVAILABLE") {
        setError("Service is temporarily unavailable. Please try again in a moment.")
      } else if (code === "RATE_LIMIT") {
        setError("Too many sign-in attempts. Please wait a few minutes before trying again.")
      } else {
        setError(msg || "Incorrect email or password.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <div className="w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-[0_24px_80px_rgba(66,0,96,0.14)] lg:grid lg:grid-cols-2">
        <AuthBrandPanel
          title="Welcome to Your Digital Hub"
          subtitle="Access your purchased digital products, manage consulting services, and track your digital transformation journey."
          bullets={["Instant download access", "Order history & invoices", "Service tracking & consultations"]}
        />

        {/* Right: form */}
        <motion.div variants={stagger} initial="hidden" animate="show"
          className="flex flex-col justify-center px-6 py-8 sm:px-12 sm:py-12"
        >
          {/* Mobile back link */}
          <Link
            to="/"
            className="mb-5 inline-flex w-fit items-center gap-2 text-[13px] font-medium text-[#420060] transition hover:text-[#2d003f] lg:hidden"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Back to Home
          </Link>

          <motion.div variants={fadeUp}>
            <span className="inline-flex items-center gap-2 rounded-xl bg-[#ede4ef] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#420060]">
              <Sparkles className="h-3 w-3" /> Member Login
            </span>
            <h1 className="mt-3 text-[1.7rem] font-bold tracking-tight text-[#420060]">Sign In</h1>
            <p className="mt-1 text-[14px] text-[#634F40]/60">Enter your credentials to access your account.</p>
          </motion.div>

          {error && (
            <motion.div variants={fadeUp}
              className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700"
            >
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </motion.div>
          )}

          <motion.form variants={stagger} onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <motion.div variants={fadeUp}>
              <label className="mb-1.5 block text-[12px] font-semibold text-[#420060]">Email Address</label>
              <AuthInput icon={Mail} type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" autoComplete="email" />
            </motion.div>

            <motion.div variants={fadeUp}>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-[12px] font-semibold text-[#420060]">Password</label>
                <Link to="/forgot-password" className="text-[12px] font-medium text-[#420060] hover:underline">
                  Forgot password?
                </Link>
              </div>
              <AuthInput icon={Lock} type={showPw ? "text" : "password"} value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="Your password"
                autoComplete="current-password"
                right={
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="text-[#634F40]/40 hover:text-[#420060] transition">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
            </motion.div>

            {/* Remember me */}
            <motion.div variants={fadeUp}>
              <label className="flex cursor-pointer items-center gap-3">
                <div
                  onClick={() => setRemember(!remember)}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border-2 transition-all ${
                    remember ? "border-[#420060] bg-[#420060]" : "border-[#634F40]/25 bg-white"
                  }`}
                >
                  {remember && (
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="select-none text-[13px] text-[#634F40]/70">
                  Remember me for <span className="font-semibold text-[#420060]">30 days</span>
                </span>
              </label>
            </motion.div>

            <motion.button variants={fadeUp} type="submit" disabled={loading}
              className="w-full rounded-xl bg-[#420060] py-3.5 text-[14px] font-semibold text-white shadow-[0_8px_24px_rgba(66,0,96,0.20)] transition hover:-translate-y-0.5 hover:bg-[#2d003f] disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Signing in…
                </span>
              ) : "Sign In"}
            </motion.button>
          </motion.form>

          {/* Google login */}
          <motion.div variants={fadeUp} className="mt-5">
            <div className="relative flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-[#634F40]/10" />
              <span className="text-[12px] text-[#634F40]/40">or continue with</span>
              <div className="h-px flex-1 bg-[#634F40]/10" />
            </div>
            <div className="mt-3">
              <GoogleLoginButton />
            </div>
          </motion.div>

          <motion.p variants={fadeUp} className="mt-6 text-center text-[13px] text-[#634F40]/60">
            Don't have an account?{" "}
            <Link to="/signup" className="font-semibold text-[#420060] hover:underline">Create Account</Link>
          </motion.p>

          <motion.p variants={fadeUp} className="mt-3 text-center text-[11px] leading-5 text-[#634F40]/35">
            By continuing you agree to our{" "}
            <Link to="/terms" className="hover:underline">Terms</Link>{" "}and{" "}
            <Link to="/privacy" className="hover:underline">Privacy Policy</Link>.
          </motion.p>
        </motion.div>
      </div>
    </div>
  )
}
