import { useState } from "react"
import { m, useReducedMotion } from "framer-motion"
import { Mail, ArrowRight, Sparkles, Check, AlertCircle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { apiRequest } from "../lib/api"
import Confetti from "./motion/Confetti"

/**
 * NewsletterSection · full-width email capture for the Home page
 * ─────────────────────────────────────────────────────────────────────────
 * Brand design language:
 *   · Midnight Charcoal (var(--color-charcoal)) dark canvas — matches Solutions section
 *   · Terracotta eyebrow pill — inverse variant for dark surfaces
 *   · Innovation Gradient on the submit button (single conversion CTA)
 *   · Animated floating orbs + subtle noise texture (Brand v3 §10)
 *   · Sora Extra-Bold headline, JetBrains Mono for the "free" callout
 *   · Animated particle dots (pure CSS, no canvas overhead)
 *
 * API: POST /api/v1/newsletter/subscribe  { email, source: "home" }
 */
export default function NewsletterSection() {
  const { t } = useTranslation("home")
  const reduced = useReducedMotion()

  const [email, setEmail]   = useState("")
  const [status, setStatus] = useState("idle") // idle | loading | success | error
  const [errMsg, setErrMsg] = useState("")

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrMsg(t("newsletter.validationError", { defaultValue: "Please enter a valid email address." }))
      setStatus("error")
      return
    }
    setStatus("loading")
    setErrMsg("")
    try {
      await apiRequest("/api/v1/newsletter/subscribe", {
        method: "POST",
        body: JSON.stringify({ email: trimmed, source: "home" }),
      })
      setStatus("success")
    } catch (err) {
      const msg = err?.message || ""
      if (msg.toLowerCase().includes("already")) {
        setStatus("success") // treat duplicate as success — user is already subscribed
      } else {
        setErrMsg(t("newsletter.serverError", { defaultValue: "Something went wrong. Please try again." }))
        setStatus("error")
      }
    }
  }

  /* ── Animation variants ────────────────────────────────────────────── */
  const fadeUp = {
    hidden: { opacity: 0, y: reduced ? 0 : 24 },
    show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
  }
  const stagger = {
    hidden: {},
    show:   { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
  }

  return (
    <section
      className="relative isolate overflow-hidden py-20 lg:py-28"
      style={{ backgroundColor: "var(--color-charcoal)" }}
      aria-labelledby="newsletter-heading"
    >
      {/* ── Ambient orbs ────────────────────────────────────────────── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgb(var(--color-violet-rgb)/0.22) 0%, transparent 70%)" }}
        />
        <div
          className="absolute -right-32 bottom-0 h-[400px] w-[400px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgb(var(--color-azure-rgb)/0.18) 0%, transparent 70%)" }}
        />
        <div
          className="absolute left-1/2 top-0 h-[300px] w-[300px] -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgb(var(--color-terracotta-rgb)/0.10) 0%, transparent 70%)" }}
        />
      </div>

      {/* ── Dot grid decoration ─────────────────────────────────────── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 50%, black 30%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 50%, black 30%, transparent 100%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Confetti fire={status === "success"} />
        <m.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="mx-auto max-w-2xl text-center"
        >
          {/* Eyebrow */}
          <m.span
            variants={fadeUp}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{
              backgroundColor: "rgb(var(--color-terracotta-rgb)/0.14)",
              color: "var(--color-terracotta)",
              border: "1px solid rgb(var(--color-terracotta-rgb)/0.30)",
            }}
          >
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            {t("newsletter.eyebrow", { defaultValue: "Weekly insights" })}
          </m.span>

          {/* Headline */}
          <m.h2
            id="newsletter-heading"
            variants={fadeUp}
            className="mt-5 text-[30px] font-extrabold leading-[1.05] tracking-tight text-white sm:text-[40px] lg:text-[48px]"
          >
            {t("newsletter.headlinePart1", { defaultValue: "Stay ahead" })}{" "}
            <span style={{ color: "var(--color-terracotta)" }}>
              {t("newsletter.headlinePart2", { defaultValue: "of the tech curve." })}
            </span>
          </m.h2>

          {/* Body */}
          <m.p
            variants={fadeUp}
            className="mt-4 text-[15px] leading-[1.7] text-white/70 sm:text-[16px]"
          >
            {t("newsletter.body", {
              defaultValue:
                "Every week: one actionable tech tip, one tool I'm actually using, and one insight from the classroom or the codebase. No filler.",
            })}
          </m.p>

          {/* Free callout */}
          <m.p
            variants={fadeUp}
            className="mt-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35"
          >
            {t("newsletter.freeCallout", { defaultValue: "Free · No spam · Unsubscribe any time" })}
          </m.p>

          {/* Form or success state */}
          <m.div variants={fadeUp} className="mt-8">
            {status === "success" ? (
              <div className="inline-flex items-center gap-3 rounded-2xl border border-mint/30 bg-mint/10 px-6 py-4 text-mint">
                <Check className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="text-[15px] font-semibold">
                  {t("newsletter.successMessage", { defaultValue: "Almost there — check your inbox to confirm your subscription." })}
                </span>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
                noValidate
              >
                {/* Email input */}
                <div className="relative w-full max-w-sm">
                  <Mail
                    className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
                    aria-hidden="true"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (status === "error") setStatus("idle") }}
                    placeholder={t("newsletter.placeholder", { defaultValue: "your@email.com" })}
                    required
                    aria-label={t("newsletter.inputAriaLabel", { defaultValue: "Your email address" })}
                    aria-describedby={status === "error" ? "newsletter-error" : undefined}
                    className="w-full rounded-xl border py-3 pl-10 pr-4 text-[14px] font-medium text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-azure/50 focus:ring-offset-1 focus:ring-offset-charcoal"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.07)",
                      borderColor: status === "error" ? "rgb(var(--color-rose-rgb)/0.5)" : "rgba(255,255,255,0.12)",
                    }}
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="group inline-flex shrink-0 items-center gap-2 rounded-xl px-6 py-3 text-[14px] font-bold text-white shadow-[0_8px_24px_rgb(var(--color-violet-rgb)/0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgb(var(--color-violet-rgb)/0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure/50 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal disabled:pointer-events-none disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, var(--color-violet), var(--color-azure))" }}
                >
                  {status === "loading"
                    ? t("newsletter.submitting", { defaultValue: "Subscribing…" })
                    : t("newsletter.cta", { defaultValue: "Subscribe free" })}
                  {status !== "loading" && (
                    <ArrowRight
                      className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  )}
                </button>
              </form>
            )}

            {/* Error message */}
            {status === "error" && errMsg && (
              <p
                id="newsletter-error"
                role="alert"
                className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-rose"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {errMsg}
              </p>
            )}
          </m.div>

          {/* Trust strip */}
          <m.div
            variants={fadeUp}
            className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
          >
            {[
              { icon: "🌍", label: t("newsletter.trust1", { defaultValue: "4 countries" }) },
              { icon: "🎓", label: t("newsletter.trust2", { defaultValue: "STEM educator" }) },
              { icon: "⚡", label: t("newsletter.trust3", { defaultValue: "8+ years shipping" }) },
            ].map(({ icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40"
              >
                <span>{icon}</span>
                {label}
              </span>
            ))}
          </m.div>
        </m.div>
      </div>
    </section>
  )
}
