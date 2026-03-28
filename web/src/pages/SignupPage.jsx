import { useEffect, useState } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { motion } from "framer-motion"
import { Eye, EyeOff, Mail, Lock, User, Sparkles } from "lucide-react"
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
        type={type} value={value} onChange={onChange} placeholder={placeholder} autoComplete={autoComplete}
        className="w-full rounded-xl border border-[#634F40]/15 bg-[#fafafa] py-3.5 pl-11 pr-10 text-[14px] text-[#420060] outline-none transition focus:border-[#420060]/40 focus:bg-white focus:ring-2 focus:ring-[#420060]/8 placeholder:text-[#634F40]/35"
      />
      {right && <div className="absolute right-3 top-1/2 -translate-y-1/2">{right}</div>}
    </div>
  )
}

export default function SignupPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signup, isAuthenticated } = useAuth()

  const [fullName, setFullName] = useState("")
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [confirm,  setConfirm]  = useState("")
  const [showPw,   setShowPw]   = useState(false)
  const [showCf,   setShowCf]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState("")

  useEffect(() => {
    if (isAuthenticated) navigate(location.state?.from || "/dashboard", { replace: true })
  }, [isAuthenticated, navigate, location])

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    if (!fullName.trim()) { setError("Full name is required."); return }
    if (!email)           { setError("Email address is required."); return }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return }
    if (password !== confirm) { setError("Passwords do not match."); return }

    setLoading(true)
    try {
      await signup({ fullName: fullName.trim(), email, password })
      navigate("/dashboard", { replace: true })
    } catch (err) {
      const code = err.code || ""
      if (code === "NETWORK_ERROR") setError("Cannot reach the server. Please check your connection.")
      else if (code === "DUPLICATE_ENTRY" || err.message?.includes("exists")) setError("An account with this email already exists. Try signing in instead.")
      else if (code === "DB_UNAVAILABLE") setError("Service temporarily unavailable. Please try again shortly.")
      else setError(err.message || "Account creation failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <div className="w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-[0_24px_80px_rgba(66,0,96,0.14)] lg:grid lg:grid-cols-2">
        <AuthBrandPanel
          title="Join the Platform"
          subtitle="Create your account to access digital products, consulting services, and your personal dashboard."
          bullets={["Instant product downloads", "Professional consulting access", "Secure member portal"]}
        />

        <motion.div variants={stagger} initial="hidden" animate="show"
          className="flex flex-col justify-center px-8 py-12 sm:px-12"
        >
          <motion.div variants={fadeUp}>
            <span className="inline-flex items-center gap-2 rounded-xl bg-[#ede4ef] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#420060]">
              <Sparkles className="h-3 w-3" /> Create Account
            </span>
            <h1 className="mt-3 text-[1.7rem] font-bold tracking-tight text-[#420060]">Get Started</h1>
            <p className="mt-1 text-[14px] text-[#634F40]/60">Create your free account in seconds.</p>
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
              <label className="mb-1.5 block text-[12px] font-semibold text-[#420060]">Full Name</label>
              <AuthInput icon={User} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" autoComplete="name" />
            </motion.div>
            <motion.div variants={fadeUp}>
              <label className="mb-1.5 block text-[12px] font-semibold text-[#420060]">Email Address</label>
              <AuthInput icon={Mail} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
            </motion.div>
            <motion.div variants={fadeUp}>
              <label className="mb-1.5 block text-[12px] font-semibold text-[#420060]">Password</label>
              <AuthInput icon={Lock} type={showPw ? "text" : "password"} value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 characters" autoComplete="new-password"
                right={<button type="button" onClick={() => setShowPw(!showPw)} className="text-[#634F40]/40 hover:text-[#420060]">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>}
              />
            </motion.div>
            <motion.div variants={fadeUp}>
              <label className="mb-1.5 block text-[12px] font-semibold text-[#420060]">Confirm Password</label>
              <AuthInput icon={Lock} type={showCf ? "text" : "password"} value={confirm}
                onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" autoComplete="new-password"
                right={<button type="button" onClick={() => setShowCf(!showCf)} className="text-[#634F40]/40 hover:text-[#420060]">
                  {showCf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>}
              />
            </motion.div>

            <motion.button variants={fadeUp} type="submit" disabled={loading}
              className="w-full rounded-xl bg-[#420060] py-3.5 text-[14px] font-semibold text-white shadow-[0_8px_24px_rgba(66,0,96,0.20)] transition hover:-translate-y-0.5 hover:bg-[#2d003f] disabled:opacity-60"
            >
              {loading ? <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>Creating account…</span> : "Create Account"}
            </motion.button>
          </motion.form>

          <motion.div variants={fadeUp} className="mt-5">
            <div className="relative flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-[#634F40]/10" />
              <span className="text-[12px] text-[#634F40]/40">or continue with</span>
              <div className="h-px flex-1 bg-[#634F40]/10" />
            </div>
            <div className="mt-3"><GoogleLoginButton /></div>
          </motion.div>

          <motion.p variants={fadeUp} className="mt-6 text-center text-[13px] text-[#634F40]/60">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-[#420060] hover:underline">Sign In</Link>
          </motion.p>
          <motion.p variants={fadeUp} className="mt-3 text-center text-[11px] leading-5 text-[#634F40]/35">
            By creating an account you agree to our{" "}
            <Link to="/terms" className="hover:underline">Terms</Link>{" "}and{" "}
            <Link to="/privacy" className="hover:underline">Privacy Policy</Link>.
          </motion.p>
        </motion.div>
      </div>
    </div>
  )
}
