import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ArrowRight, Check, FileText, Loader2, Mail } from "lucide-react"
import { apiRequest } from "../../lib/api"
import Confetti from "../motion/Confetti"
import { Container } from "./Primitives"

const CATALOGUE_URL = "/documents/Mustapha-Ukizuru-Service-Catalog-v1.0.pdf"

/**
 * ServicesLeadCapture · the second exit on the consulting funnel (G3).
 * ─────────────────────────────────────────────────────────────────────────
 * Every services page has ONE conversion CTA: book a 30-min call. A visitor
 * who is not ready to book had no other way to stay in touch, so the funnel
 * lost them. This card offers the service catalogue in exchange for an email
 * and drops the visitor into the existing double-opt-in newsletter — the
 * nurture side (campaignSenderJob) is already built.
 *
 * Contract: POST /api/v1/newsletter/subscribe { email, source } — the same one
 * NewsletterInline uses; duplicate emails count as success. `source` carries
 * the page slug (`services:<slug>`) so the admin export shows which category
 * captured the lead. The PDF link is revealed on success so the visitor gets
 * the value now, before the confirmation email lands.
 *
 *   <ServicesLeadCapture slug="ai-automation" />
 */
export default function ServicesLeadCapture({ slug = "index" }) {
  const { t } = useTranslation("services")
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState("idle") // idle | loading | success | error
  const [errMsg, setErrMsg] = useState("")

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrMsg(t("funnel.leadCapture.invalid"))
      setStatus("error")
      return
    }
    setStatus("loading")
    setErrMsg("")
    try {
      await apiRequest("/api/v1/newsletter/subscribe", {
        method: "POST",
        body: JSON.stringify({ email: trimmed, source: `services:${slug}` }),
      })
      setStatus("success")
    } catch (err) {
      if ((err?.message || "").toLowerCase().includes("already")) {
        setStatus("success")
      } else {
        setErrMsg(t("funnel.leadCapture.error"))
        setStatus("error")
      }
    }
  }

  return (
    <section className="bg-mist py-16 sm:py-20" aria-labelledby="services-lead-capture-title">
      <Container>
        <div
          className="relative isolate overflow-hidden rounded-2xl px-6 py-8 sm:px-10 sm:py-10"
          style={{ backgroundColor: "var(--color-charcoal)" }}
        >
          <Confetti fire={status === "success"} />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgb(var(--color-violet-rgb)/0.30) 0%, transparent 70%)" }}
          />

          <div className="relative grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em]"
                style={{ backgroundColor: "rgb(var(--color-terracotta-rgb)/0.16)", color: "var(--color-terracotta)", border: "1px solid rgb(var(--color-terracotta-rgb)/0.32)" }}
              >
                <FileText className="h-3 w-3" aria-hidden="true" />
                {t("funnel.leadCapture.eyebrow")}
              </span>
              <h2 id="services-lead-capture-title" className="mt-3 text-[22px] font-extrabold leading-tight tracking-tight text-white sm:text-[26px]">
                {t("funnel.leadCapture.title")}
              </h2>
              <p className="mt-2 max-w-xl text-[14px] leading-6 text-white/65 sm:text-[15px]">
                {t("funnel.leadCapture.body")}
              </p>
            </div>

            <div>
              {status === "success" ? (
                <div className="flex flex-col gap-3">
                  <div className="inline-flex items-center gap-2.5 rounded-xl border border-mint/30 bg-mint/10 px-5 py-3 text-white">
                    <Check className="h-5 w-5 shrink-0" style={{ color: "var(--color-mint)" }} aria-hidden="true" />
                    <span className="text-[14px] font-semibold">{t("funnel.leadCapture.success")}</span>
                  </div>
                  <a
                    href={CATALOGUE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-5 py-3 text-[14px] font-semibold text-white transition hover:bg-white/10"
                  >
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    {t("funnel.leadCapture.download")}
                  </a>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-2.5" noValidate>
                  <div className="relative w-full">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/55" aria-hidden="true" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); if (status === "error") setStatus("idle") }}
                      placeholder={t("funnel.leadCapture.placeholder")}
                      aria-label={t("funnel.leadCapture.placeholder")}
                      aria-invalid={status === "error"}
                      autoComplete="email"
                      className="w-full rounded-xl border bg-white/[0.06] py-3 pl-10 pr-3 text-[14px] text-white placeholder-white/55 outline-none transition focus:border-azure focus:ring-[3px] focus:ring-azure/25"
                      style={{ borderColor: status === "error" ? "rgb(var(--color-rose-rgb)/0.5)" : "rgba(255,255,255,0.12)" }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-[14px] font-semibold text-white shadow-[0_10px_28px_rgb(var(--color-violet-rgb)/0.35)] transition hover:-translate-y-0.5 disabled:opacity-70"
                    style={{ background: "linear-gradient(135deg, var(--color-violet), var(--color-azure))" }}
                  >
                    {status === "loading"
                      ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> …</>
                      : <>{t("funnel.leadCapture.button")} <ArrowRight className="h-4 w-4" aria-hidden="true" /></>}
                  </button>
                  {status === "error" && errMsg && (
                    <p className="text-[12.5px] text-rose-300" role="alert">{errMsg}</p>
                  )}
                  <p className="text-[12px] leading-5 text-white/70">{t("funnel.leadCapture.privacy")}</p>
                </form>
              )}
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
