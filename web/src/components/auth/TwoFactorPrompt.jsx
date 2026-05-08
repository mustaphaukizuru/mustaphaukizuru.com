import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { ShieldCheck, KeyRound, ArrowLeft } from "lucide-react"

import { useTranslation } from "react-i18next"
/**
 * TwoFactorPrompt (B09)
 *
 * Used by LoginPage. Two modes:
 *   - "totp"   : 6 digit boxes, auto-advance, paste-friendly
 *   - "backup" : single text field accepting "AAAA-BBBB" or "AAAABBBB"
 *
 * Props:
 *   onSubmit(code: string) → Promise<void>  // throws on invalid
 *   onCancel()                              // back to email/password
 *   loading: boolean                        // disables inputs
 *   error:   string | null
 *   email?:  string                         // shown for context
 */
export default function TwoFactorPrompt({ onSubmit, onCancel, loading, error, email }) {
  const { t } = useTranslation("common")
  const [mode, setMode] = useState("totp") // "totp" | "backup"
  const [digits, setDigits] = useState(["", "", "", "", "", ""])
  const [backupCode, setBackupCode] = useState("")
  const inputRefs = useRef([])

  // Focus first digit on mount / mode swap to TOTP
  useEffect(() => {
    if (mode === "totp") {
      const t = window.setTimeout(() => inputRefs.current[0]?.focus(), 50)
      return () => window.clearTimeout(t)
    }
  }, [mode])

  /* ── TOTP digit handlers ────────────────────────────────────────────── */

  function handleDigitChange(i, value) {
    // Only digits, single char
    const cleaned = value.replace(/\D/g, "").slice(0, 1)
    setDigits((prev) => {
      const next = [...prev]
      next[i] = cleaned
      return next
    })
    if (cleaned && i < 5) inputRefs.current[i + 1]?.focus()
  }

  function handleDigitKeyDown(i, e) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus()
      return
    }
    if (e.key === "ArrowLeft" && i > 0) { e.preventDefault(); inputRefs.current[i - 1]?.focus() }
    if (e.key === "ArrowRight" && i < 5) { e.preventDefault(); inputRefs.current[i + 1]?.focus() }
    if (e.key === "Enter") {
      const code = digits.join("")
      if (code.length === 6) handleSubmit()
    }
  }

  function handleDigitPaste(e) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    if (!pasted) return
    e.preventDefault()
    const next = ["", "", "", "", "", ""]
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]
    setDigits(next)
    inputRefs.current[Math.min(pasted.length, 5)]?.focus()
    if (pasted.length === 6) {
      // Auto-submit on full paste
      window.setTimeout(() => handleSubmit(pasted), 60)
    }
  }

  /* ── Submit ─────────────────────────────────────────────────────────── */

  async function handleSubmit(forced) {
    const code = forced
      ? forced
      : (mode === "totp" ? digits.join("") : backupCode.trim())
    if (!code) return
    if (mode === "totp" && code.length !== 6) return
    try {
      await onSubmit(code)
    } catch {
      // Error displayed by parent via `error` prop. Reset digits for retry.
      if (mode === "totp") {
        setDigits(["", "", "", "", "", ""])
        inputRefs.current[0]?.focus()
      }
    }
  }

  /* ── Render ─────────────────────────────────────────────────────────── */

  const totpComplete = digits.every((d) => d !== "")

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col gap-5"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet text-white shadow-[0_8px_20px_rgba(93,63,211,0.18)]">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-card font-bold text-violet">Two-Factor Verification</h2>
          <p className="mt-0.5 truncate text-micro text-charcoal-80/70">
            {mode === "totp"
              ? "Enter the 6-digit code from your authenticator app"
              : "Enter one of your saved backup codes"}
            {email ? <span className="ml-1 text-charcoal-80/45">· {email}</span> : null}
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-meta text-red-700">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {mode === "totp" ? (
        <div>
          <div className="flex gap-2 sm:gap-3" onPaste={handleDigitPaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (inputRefs.current[i] = el)}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={1}
                value={d}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleDigitKeyDown(i, e)}
                disabled={loading}
                aria-label={`Digit ${i + 1} of 6`}
                className="h-14 w-full rounded-xl border-2 border-charcoal-80/15 bg-[#fafafa] text-center text-section font-bold text-violet outline-none transition focus:border-violet focus:bg-white focus:ring-2 focus:ring-violet/15 disabled:opacity-50 sm:h-16 sm:text-section"
              />
            ))}
          </div>
          <p className="mt-2 text-center text-micro text-charcoal-80/55">
            {t("auth.twofa.tipPaste")}
          </p>
        </div>
      ) : (
        <div>
          <label className="mb-1.5 block text-micro font-semibold text-violet">{t("auth.twofa.backupCode")}</label>
          <input
            type="text"
            value={backupCode}
            onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit() }}
            placeholder="AAAA-BBBB"
            autoComplete="off"
            disabled={loading}
            autoFocus
            className="w-full rounded-xl border-2 border-charcoal-80/15 bg-[#fafafa] px-4 py-3.5 text-center text-body font-mono font-bold tracking-[0.2em] text-violet outline-none transition focus:border-violet focus:bg-white focus:ring-2 focus:ring-violet/15 disabled:opacity-50"
          />
          <p className="mt-2 text-micro text-charcoal-80/55">
            {t("auth.twofa.backupOnce")}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => handleSubmit()}
        disabled={loading || (mode === "totp" ? !totpComplete : !backupCode.trim())}
        className="w-full rounded-xl bg-violet py-3.5 text-meta font-semibold text-white shadow-[0_8px_24px_rgba(93,63,211,0.20)] transition hover:-translate-y-0.5 hover:bg-violet-deep disabled:translate-y-0 disabled:opacity-60"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            Verifying…
          </span>
        ) : "Verify and Sign In"}
      </button>

      <div className="flex items-center justify-between text-micro">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="inline-flex items-center gap-1.5 font-medium text-charcoal-80/70 hover:text-violet disabled:opacity-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("auth.twofa.useDifferent")}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "totp" ? "backup" : "totp"))
            setBackupCode("")
            setDigits(["", "", "", "", "", ""])
          }}
          disabled={loading}
          className="inline-flex items-center gap-1.5 font-semibold text-violet hover:underline disabled:opacity-50"
        >
          <KeyRound className="h-3.5 w-3.5" />
          {mode === "totp" ? "Use a backup code instead" : "Use authenticator code"}
        </button>
      </div>
    </motion.div>
  )
}
