import { useState } from "react"
import { Link, useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Lock, Eye, EyeOff, ArrowLeft, CheckCircle2, Sparkles } from "lucide-react"
import AuthBrandPanel from "../components/AuthBrandPanel"
import { apiRequest } from "../lib/api"

const fadeUp = { hidden:{opacity:0,y:16}, show:{opacity:1,y:0,transition:{duration:0.38,ease:"easeOut"}} }
const stagger = { hidden:{}, show:{transition:{staggerChildren:0.06}} }

export default function ResetPasswordPage() {
  const { token }    = useParams()
  const navigate     = useNavigate()

  const [password,  setPassword]  = useState("")
  const [confirm,   setConfirm]   = useState("")
  const [showPw,    setShowPw]    = useState(false)
  const [showCf,    setShowCf]    = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [success,   setSuccess]   = useState(false)
  const [error,     setError]     = useState("")

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    if (password.length < 6) { setError("Password must be at least 6 characters."); return }
    if (password !== confirm) { setError("Passwords do not match."); return }

    setLoading(true)
    try {
      await apiRequest(`/api/auth/reset-password/${token}`, { method:"POST", body: JSON.stringify({ password }) })
      setSuccess(true)
      setTimeout(() => navigate("/login"), 3000)
    } catch (err) {
      const code = err.code || ""
      if (code === "NETWORK_ERROR") setError("Cannot reach the server. Please check your connection.")
      else if (err.message?.includes("expired") || err.message?.includes("invalid")) {
        setError("This reset link has expired or is invalid. Please request a new one.")
      } else {
        setError(err.message || "Failed to reset password. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <div className="w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-[0_24px_80px_rgba(66,0,96,0.14)] lg:grid lg:grid-cols-2">
        <AuthBrandPanel
          title="Create New Password"
          subtitle="Choose a strong password to secure your account. You'll be redirected to sign in after."
          bullets={["At least 6 characters", "Avoid reusing old passwords", "Store it somewhere safe"]}
        />

        <motion.div variants={stagger} initial="hidden" animate="show"
          className="flex flex-col justify-center px-8 py-12 sm:px-12"
        >
          {success ? (
            <motion.div variants={stagger} className="flex flex-col items-center gap-6 text-center py-4">
              <motion.div variants={fadeUp}
                className="flex h-20 w-20 items-center justify-center rounded-xl bg-[#e8f4ea] text-[#2FA36B] shadow-[0_8px_24px_rgba(47,163,107,0.15)]"
              >
                <CheckCircle2 className="h-10 w-10" />
              </motion.div>
              <motion.div variants={fadeUp}>
                <h2 className="text-[1.5rem] font-bold text-[#420060]">Password Reset!</h2>
                <p className="mt-2 text-[14px] leading-6 text-[#634F40]/60">
                  Your password has been updated. Redirecting to sign in…
                </p>
              </motion.div>
              <motion.div variants={fadeUp}>
                <Link to="/login" className="rounded-xl bg-[#420060] px-6 py-3 text-[13px] font-semibold text-white transition hover:bg-[#2d003f]">
                  Sign In Now
                </Link>
              </motion.div>
            </motion.div>
          ) : (
            <>
              <Link to="/login" className="mb-6 inline-flex items-center gap-2 text-[13px] text-[#634F40]/55 hover:text-[#420060] transition">
                <ArrowLeft className="h-4 w-4" /> Back to Sign In
              </Link>

              <motion.div variants={fadeUp}>
                <span className="inline-flex items-center gap-2 rounded-xl bg-[#ede4ef] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#420060]">
                  <Sparkles className="h-3 w-3" /> New Password
                </span>
                <h1 className="mt-3 text-[1.7rem] font-bold tracking-tight text-[#420060]">Reset Password</h1>
                <p className="mt-1 text-[14px] text-[#634F40]/60">Enter your new password below.</p>
              </motion.div>

              {error && (
                <motion.div variants={fadeUp}
                  className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700"
                >
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{error}</span>
                  {error.includes("expired") && (
                    <Link to="/forgot-password" className="ml-auto shrink-0 font-semibold underline hover:no-underline">
                      Get new link
                    </Link>
                  )}
                </motion.div>
              )}

              <motion.form variants={stagger} onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
                {[
                  { label:"New Password",     value:password, set:setPassword, show:showPw, toggle:()=>setShowPw(!showPw), placeholder:"Min. 6 characters",  ac:"new-password" },
                  { label:"Confirm Password", value:confirm,  set:setConfirm,  show:showCf, toggle:()=>setShowCf(!showCf), placeholder:"Re-enter password",  ac:"new-password" },
                ].map(({ label, value, set, show, toggle, placeholder, ac }) => (
                  <motion.div variants={fadeUp} key={label}>
                    <label className="mb-1.5 block text-[12px] font-semibold text-[#420060]">{label}</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#634F40]/35 pointer-events-none" />
                      <input type={show ? "text" : "password"} value={value} onChange={(e) => set(e.target.value)}
                        placeholder={placeholder} autoComplete={ac}
                        className="w-full rounded-xl border border-[#634F40]/15 bg-[#fafafa] py-3.5 pl-11 pr-11 text-[14px] text-[#420060] outline-none transition focus:border-[#420060]/40 focus:bg-white focus:ring-2 focus:ring-[#420060]/8 placeholder:text-[#634F40]/35"
                      />
                      <button type="button" onClick={toggle}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#634F40]/40 hover:text-[#420060] transition"
                      >
                        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </motion.div>
                ))}

                <motion.button variants={fadeUp} type="submit" disabled={loading}
                  className="w-full rounded-xl bg-[#420060] py-3.5 text-[14px] font-semibold text-white shadow-[0_8px_24px_rgba(66,0,96,0.20)] transition hover:-translate-y-0.5 hover:bg-[#2d003f] disabled:opacity-60"
                >
                  {loading ? <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>Resetting…</span> : "Reset Password"}
                </motion.button>
              </motion.form>
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}
