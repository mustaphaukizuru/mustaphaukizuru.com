import { useState } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Mail, ArrowLeft, CheckCircle2, Sparkles, RotateCcw } from "lucide-react"
import AuthBrandPanel from "../components/AuthBrandPanel"
import { apiRequest } from "../lib/api"

const fadeUp = { hidden:{opacity:0,y:16}, show:{opacity:1,y:0,transition:{duration:0.38,ease:"easeOut"}} }
const stagger = { hidden:{}, show:{transition:{staggerChildren:0.06}} }

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState("")
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState("")

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    if (!email.trim()) { setError("Please enter your email address."); return }

    setLoading(true)
    try {
      await apiRequest("/api/auth/forgot-password", { method:"POST", body: JSON.stringify({ email }) })
      setSent(true)
    } catch (err) {
      const code = err.code || ""
      if (code === "NETWORK_ERROR") setError("Cannot reach the server. Please check your connection.")
      else if (code === "DB_UNAVAILABLE") setError("Service temporarily unavailable. Please try again shortly.")
      else setError(err.message || "Failed to send reset link. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <div className="w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-[0_24px_80px_rgba(66,0,96,0.14)] lg:grid lg:grid-cols-2">
        <AuthBrandPanel
          title="Reset Your Password"
          subtitle="Enter your email and we'll send you a secure link to create a new password."
          bullets={["Link expires in 1 hour", "Check your spam folder too", "Contact support if you need help"]}
        />

        <motion.div variants={stagger} initial="hidden" animate="show"
          className="flex flex-col justify-center px-6 py-8 sm:px-12 sm:py-12"
        >
          {/* Mobile back to home */}
          <Link
            to="/"
            className="mb-3 inline-flex w-fit items-center gap-2 text-[13px] font-medium text-[#420060] transition hover:text-[#2d003f] lg:hidden"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Back to Home
          </Link>

          <Link to="/login" className="mb-6 inline-flex items-center gap-2 text-[13px] text-[#634F40]/55 hover:text-[#420060] transition">
            <ArrowLeft className="h-4 w-4" /> Back to Sign In
          </Link>

          {sent ? (
            <motion.div variants={stagger} className="flex flex-col items-center gap-6 text-center py-4">
              <motion.div variants={fadeUp}
                className="flex h-20 w-20 items-center justify-center rounded-xl bg-[#e8f4ea] text-[#2FA36B] shadow-[0_8px_24px_rgba(47,163,107,0.15)]"
              >
                <CheckCircle2 className="h-10 w-10" />
              </motion.div>
              <motion.div variants={fadeUp}>
                <h2 className="text-[1.5rem] font-bold text-[#420060]">Check Your Email</h2>
                <p className="mt-2 text-[14px] leading-7 text-[#634F40]/60">
                  If <span className="font-semibold text-[#420060]">{email}</span> has an account,
                  a reset link has been sent. It expires in 1 hour.
                </p>
              </motion.div>
              <motion.div variants={fadeUp} className="w-full space-y-3">
                <button type="button" onClick={() => { setSent(false); setEmail("") }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#634F40]/15 bg-[#fafafa] py-3 text-[13px] font-medium text-[#420060] transition hover:bg-[#ede4ef]"
                >
                  <RotateCcw className="h-4 w-4" /> Try a different email
                </button>
                <Link to="/login"
                  className="flex w-full items-center justify-center rounded-xl bg-[#420060] py-3 text-[13px] font-semibold text-white transition hover:bg-[#2d003f]"
                >
                  Back to Sign In
                </Link>
              </motion.div>
              <motion.p variants={fadeUp} className="text-[12px] text-[#634F40]/40">
                Didn't receive it? Check your spam folder or{" "}
                <Link to="/contact" className="text-[#420060] hover:underline">contact support</Link>.
              </motion.p>
            </motion.div>
          ) : (
            <>
              <motion.div variants={fadeUp}>
                <span className="inline-flex items-center gap-2 rounded-xl bg-[#ede4ef] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#420060]">
                  <Sparkles className="h-3 w-3" /> Password Reset
                </span>
                <h1 className="mt-3 text-[1.7rem] font-bold tracking-tight text-[#420060]">Forgot Password?</h1>
                <p className="mt-1 text-[14px] text-[#634F40]/60">Enter your email and we'll send you a reset link.</p>
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
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#634F40]/35 pointer-events-none" />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com" autoComplete="email"
                      className="w-full rounded-xl border border-[#634F40]/15 bg-[#fafafa] py-3.5 pl-11 pr-4 text-[14px] text-[#420060] outline-none transition focus:border-[#420060]/40 focus:bg-white focus:ring-2 focus:ring-[#420060]/8 placeholder:text-[#634F40]/35"
                    />
                  </div>
                </motion.div>

                <motion.button variants={fadeUp} type="submit" disabled={loading}
                  className="w-full rounded-xl bg-[#420060] py-3.5 text-[14px] font-semibold text-white shadow-[0_8px_24px_rgba(66,0,96,0.20)] transition hover:-translate-y-0.5 hover:bg-[#2d003f] disabled:opacity-60"
                >
                  {loading ? <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>Sending…</span> : "Send Reset Link"}
                </motion.button>
              </motion.form>
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}
