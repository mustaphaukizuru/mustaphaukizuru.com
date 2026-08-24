import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Mail, ArrowRight, Check, Loader2 } from "lucide-react"
import { apiRequest } from "../lib/api"
import Confetti from "./motion/Confetti"

/**
 * NewsletterInline · compact subscribe card for end-of-article placement.
 * ─────────────────────────────────────────────────────────────────────────
 * A reader who finishes a post is the warmest subscriber lead, so we ask
 * right there. Reuses the same POST /api/v1/newsletter/subscribe contract as
 * the home-page NewsletterSection (duplicate emails count as success), fires
 * the shared Confetti burst on success, and is fully bilingual via the blog
 * namespace. Brand: violet anchor card, terracotta eyebrow, single CTA.
 *
 *   <NewsletterInline source="blog-post" />
 */
export default function NewsletterInline({ source = "blog-post", className = "" }) {
  const { t } = useTranslation("blog")
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState("idle") // idle | loading | success | error
  const [errMsg, setErrMsg] = useState("")

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrMsg(t("newsletterCta.invalid"))
      setStatus("error")
      return
    }
    setStatus("loading")
    setErrMsg("")
    try {
      await apiRequest("/api/v1/newsletter/subscribe", {
        method: "POST",
        body: JSON.stringify({ email: trimmed, source }),
      })
      setStatus("success")
    } catch (err) {
      if ((err?.message || "").toLowerCase().includes("already")) {
        setStatus("success") // already subscribed → still a win
      } else {
        setErrMsg(t("newsletterCta.error"))
        setStatus("error")
      }
    }
  }

  return (
    <aside
      className={`relative isolate overflow-hidden rounded-2xl px-6 py-7 sm:px-8 sm:py-8 ${className}`}
      style={{ backgroundColor: "var(--color-charcoal)" }}
      aria-label={t("newsletterCta.title")}
    >
      <Confetti fire={status === "success"} />
      {/* Ambient brand glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgb(var(--color-violet-rgb)/0.30) 0%, transparent 70%)" }}
      />

      <div className="relative">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em]"
          style={{ backgroundColor: "rgb(var(--color-terracotta-rgb)/0.16)", color: "var(--color-terracotta)", border: "1px solid rgb(var(--color-terracotta-rgb)/0.32)" }}
        >
          <Mail className="h-3 w-3" aria-hidden="true" />
          {t("newsletterCta.eyebrow")}
        </span>

        <h3 className="mt-3 text-[20px] font-extrabold leading-tight tracking-tight text-white sm:text-[24px]">
          {t("newsletterCta.title")}
        </h3>
        <p className="mt-2 max-w-xl text-[13.5px] leading-6 text-white/65 sm:text-[14.5px]">
          {t("newsletterCta.body")}
        </p>

        {status === "success" ? (
          <div className="mt-5 inline-flex items-center gap-2.5 rounded-xl border border-mint/30 bg-mint/10 px-5 py-3 text-mint">
            <Check className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="text-[14px] font-semibold">{t("newsletterCta.success")}</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-2.5 sm:flex-row" noValidate>
            <div className="relative w-full sm:max-w-xs">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" aria-hidden="true" />
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (status === "error") setStatus("idle") }}
                placeholder={t("newsletterCta.placeholder")}
                aria-label={t("newsletterCta.placeholder")}
                aria-invalid={status === "error"}
                className="w-full rounded-xl border bg-white/[0.06] py-3 pl-10 pr-3 text-[14px] text-white placeholder-white/35 outline-none transition focus:border-azure focus:ring-[3px] focus:ring-azure/25"
                style={{ borderColor: status === "error" ? "rgb(var(--color-rose-rgb)/0.5)" : "rgba(255,255,255,0.12)" }}
              />
            </div>
            <button
              type="submit"
              disabled={status === "loading"}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-6 py-3 text-[14px] font-semibold text-white shadow-[0_10px_28px_rgb(var(--color-violet-rgb)/0.35)] transition hover:-translate-y-0.5 disabled:opacity-70"
              style={{ background: "linear-gradient(135deg, var(--color-violet), var(--color-azure))" }}
            >
              {status === "loading"
                ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> …</>
                : <>{t("newsletterCta.button")} <ArrowRight className="h-4 w-4" aria-hidden="true" /></>}
            </button>
          </form>
        )}

        {status === "error" && errMsg && (
          <p className="mt-2 text-[12.5px] text-rose-300" role="alert">{errMsg}</p>
        )}
      </div>
    </aside>
  )
}
