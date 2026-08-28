import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { m, useReducedMotion } from "framer-motion"
import {
  ClipboardCheck, ArrowRight, ShieldCheck, Clock, Layers,
  Sparkles, Building2, GraduationCap, User, CheckCircle2,
  Star, TrendingUp, Lock,
} from "lucide-react"
import Seo from "../components/seo/Seo"
import { trackEvent } from "../lib/analytics"
import AuditModal from "../components/audit/AuditModal"

const PAGE_TITLE = "Free Digital & Technology Self-Audit · 15 min"
const PAGE_DESC  = "A 15-minute capability assessment across six dimensions of your digital presence and technology operations. Score yourself, see your maturity tier, and walk away with a prioritized shortlist drawn from an 82-service catalog."

const TRUST_STATS = [
  { value: "82", label: "Capability items" },
  { value: "6",  label: "Dimensions assessed" },
  { value: "~15", label: "Minutes to complete" },
  { value: "4",  label: "Maturity tiers" },
]

const WHAT_YOU_GET = [
  {
    step: "01", eyebrow: "DIAGNOSE",
    title: "Score your current state",
    body: "Rate 82 capability statements across strategy, brand, infrastructure, web & AI, EdTech, and managed services. Sections adapt to your audience type.",
    icon: ClipboardCheck,
  },
  {
    step: "02", eyebrow: "MEASURE",
    title: "See where you really stand",
    body: "Get a normalized maturity score per category, a benchmark comparison against similar organisations, and a clear tier — Foundation, Stabilizing, Optimizing, or Mature.",
    icon: TrendingUp,
  },
  {
    step: "03", eyebrow: "ACT",
    title: "Walk away with a roadmap",
    body: "Your top 5 priorities mapped to specific services, with investment ranges, risk statements, and a recommended Solution bundle to start with.",
    icon: ArrowRight,
  },
]

const AUDIENCE_PREVIEWS = [
  { icon: GraduationCap, label: "Schools", items: "82 items · All 6 sections", color: "bg-violet/8 text-violet" },
  { icon: Building2,    label: "Businesses", items: "70 items · 5 sections", color: "bg-azure/8 text-azure" },
  { icon: User,         label: "Individuals", items: "12 items · Focused scan", color: "bg-mint/8 text-mint" },
]

export default function SelfAuditPage() {
  const { t } = useTranslation("audit")
  const reduce = useReducedMotion()
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    try { trackEvent("self_audit_page_viewed", { path: "/self-audit" }) } catch { /* best-effort */ }
  }, [])

  const openModal = () => {
    setModalOpen(true)
    try { trackEvent("self_audit_modal_opened", {}) } catch { /* best-effort */ }
  }

  const fade = reduce ? {} : {
    initial: { opacity: 0, y: 18 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-60px" },
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }

  return (
    <>
      <Seo
        title={PAGE_TITLE}
        description={PAGE_DESC}
        canonical="/self-audit"
        keywords={["free digital audit","technology self-audit","IT maturity assessment","school IT audit","SMB technology assessment","digital transformation roadmap"]}
      />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-mist">
        {/* Mesh background */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{
          background:
            "radial-gradient(at 14% 0%, rgb(var(--color-violet-rgb)/0.10) 0px, transparent 50%)," +
            "radial-gradient(at 90% 0%, rgb(var(--color-azure-rgb)/0.08) 0px, transparent 55%)," +
            "radial-gradient(at 50% 100%, rgb(var(--color-violet-rgb)/0.05) 0px, transparent 60%)",
        }} />

        <div className="relative mx-auto w-full max-w-5xl px-4 pb-12 pt-12 sm:px-6 sm:pb-20 sm:pt-24 lg:px-8">
          <m.div {...fade} className="max-w-3xl">
            {/* Eyebrow */}
            <span className="inline-flex items-center gap-2 rounded-full bg-violet-pale px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Free · 15 minutes · No sign-up needed
            </span>

            {/* Headline */}
            <h1 className="mt-5 text-[clamp(30px,4.8vw,52px)] font-extrabold leading-[1.08] tracking-tight text-charcoal text-balance">
              Find the technology gaps{" "}
              <span className="bg-[linear-gradient(135deg,var(--color-violet),var(--color-azure))] bg-clip-text text-transparent">
                holding your organisation back.
              </span>
            </h1>

            <p className="mt-5 max-w-2xl text-[15px] leading-7 text-charcoal/65 sm:text-[16.5px]">
              Score yourself across six dimensions of digital and technology maturity. Walk away with a maturity tier, a prioritised shortlist of services, and a benchmark against similar organisations.
            </p>

            {/* Feature pills */}
            <ul className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2.5 text-[13px] text-charcoal/65">
              {[
                { icon: Clock,       text: "~15 minutes" },
                { icon: Layers,      text: "6 dimensions · 82 services" },
                { icon: ShieldCheck, text: "No data stored without your consent" },
                { icon: Lock,        text: "Results visible instantly — email optional" },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="inline-flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-violet" aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>

            {/* CTA */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <m.button
                onClick={openModal}
                whileHover={reduce ? {} : { scale: 1.02, y: -1 }}
                whileTap={reduce ? {} : { scale: 0.98 }}
                className="inline-flex items-center gap-2.5 rounded-xl bg-[linear-gradient(135deg,var(--color-violet),var(--color-azure))] px-6 py-3.5 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgb(var(--color-violet-rgb)/0.35)] transition hover:shadow-[0_12px_32px_rgb(var(--color-violet-rgb)/0.45)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/40 focus-visible:ring-offset-2"
              >
                {t("page.ctaPrimary")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </m.button>
              <a
                href="#what-youll-get"
                className="text-[14px] font-medium text-charcoal/65 underline underline-offset-2 hover:text-violet transition"
              >
                {t("page.ctaSecondary")}
              </a>
            </div>
          </m.div>

          {/* Trust stats */}
          <m.div
            {...fade}
            transition={{ ...(fade.transition || {}), delay: 0.15 }}
            className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6"
          >
            {TRUST_STATS.map(({ value, label }) => (
              <div key={label} className="rounded-xl bg-white/70 border border-charcoal/6 px-4 py-4 text-center backdrop-blur-sm">
                <div className="font-mono text-[28px] font-bold text-violet leading-none">{value}</div>
                <div className="mt-1 text-[12px] text-charcoal/65">{label}</div>
              </div>
            ))}
          </m.div>
        </div>
      </section>

      {/* ── Audience preview ────────────────────────────────────────────── */}
      <section className="border-y border-charcoal/6 bg-white py-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            {AUDIENCE_PREVIEWS.map(({ icon: Icon, label, items, color }) => (
              <div key={label} className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${color}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <div className="text-[14px] font-semibold text-charcoal">{label}</div>
                  <div className="font-mono text-[11px] text-charcoal/65">{items}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What you'll get ─────────────────────────────────────────────── */}
      <section id="what-youll-get" className="py-16 sm:py-20 bg-mist">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <m.div {...fade} className="mb-12 text-center">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-violet mb-3">{t("page.whatYouGetEyebrow")}</p>
            <h2 className="text-[clamp(24px,3.5vw,38px)] font-extrabold tracking-tight text-charcoal">
              {t("page.whatYouGetHeading")}
            </h2>
          </m.div>

          <div className="grid gap-6 sm:grid-cols-3">
            {WHAT_YOU_GET.map(({ step, eyebrow, title, body, icon: Icon }, i) => (
              <m.div
                key={step}
                {...fade}
                transition={{ ...(fade.transition || {}), delay: i * 0.1 }}
                className="group rounded-2xl bg-white border border-charcoal/8 p-7 transition hover:border-violet/30 hover:shadow-[0_16px_48px_-16px_rgb(var(--color-violet-rgb)/0.18)]"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-pale text-violet">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-violet mb-2">{eyebrow}</p>
                <h3 className="text-[17px] font-bold text-charcoal mb-2">{title}</h3>
                <p className="text-[13.5px] leading-relaxed text-charcoal/65">{body}</p>
              </m.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sample results preview ──────────────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <m.div {...fade}>
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-violet mb-3">{t("page.resultsEyebrow")}</p>
              <h2 className="text-[clamp(22px,3vw,34px)] font-extrabold tracking-tight text-charcoal mb-4">
                A real picture of where you are. Not a sales deck.
              </h2>
              <p className="text-[15px] leading-7 text-charcoal/65 mb-6">
                Every score maps to a specific service, a realistic investment range, and what happens if the gap goes unfixed. No vague recommendations — just a prioritised list you can act on immediately.
              </p>
              <ul className="space-y-3">
                {[
                  "Maturity score per category, benchmarked against your peer organisations",
                  "Top 5 priorities with investment ranges and business risk if ignored",
                  "Recommended Solution bundle tailored to your tier and audience",
                  "Optional PDF report emailed to you — yours to share or print",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[14px] text-charcoal/70">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-mint" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </m.div>

            {/* Mock result card */}
            <m.div
              {...fade}
              transition={{ ...(fade.transition || {}), delay: 0.12 }}
              className="rounded-2xl border border-charcoal/8 bg-mist p-6 shadow-[0_24px_64px_-24px_rgb(var(--color-charcoal-rgb)/0.12)]"
            >
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-charcoal/40 mb-4">{t("page.sampleEyebrow")}</p>
              {/* Score ring mock */}
              <div className="flex items-center gap-5 mb-6 pb-6 border-b border-charcoal/8">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[conic-gradient(#0284C7_0%,#0284C7_58%,#EFF1F5_58%)] shadow-inner">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-mist">
                    <span className="font-mono text-[18px] font-bold text-charcoal">58</span>
                  </div>
                </div>
                <div>
                  <div className="text-[22px] font-bold text-charcoal leading-none">58 / 100</div>
                  <div className="mt-1 inline-block rounded-full bg-amber/15 px-2.5 py-0.5 text-[12px] font-bold text-amber-700">Stabilizing</div>
                  <div className="mt-1 text-[12px] text-charcoal/65">vs. avg 44 for businesses</div>
                </div>
              </div>
              {/* Sample bars */}
              {[
                { label: "Strategy", pct: 42, color: "var(--color-amber)" },
                { label: "Brand", pct: 71, color: "var(--color-azure)" },
                { label: "Infrastructure", pct: 38, color: "var(--color-amber)" },
                { label: "Web & AI", pct: 62, color: "var(--color-azure)" },
              ].map(({ label, pct, color }) => (
                <div key={label} className="flex items-center gap-3 mb-3">
                  <span className="w-24 text-[12px] font-medium text-charcoal/70 shrink-0">{label}</span>
                  <div className="flex-1 h-2 bg-charcoal/8 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <span className="font-mono text-[11px] font-bold text-charcoal/65 w-8 text-right">{pct}%</span>
                </div>
              ))}
              <p className="mt-4 text-center text-[11px] text-charcoal/35 italic">{t("page.sampleNote")}</p>
            </m.div>
          </div>
        </div>
      </section>

      {/* ── CTA banner ──────────────────────────────────────────────────── */}
      <section className="bg-[linear-gradient(135deg,var(--color-violet),var(--color-azure))] py-14 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <m.div {...fade}>
            <div className="flex justify-center mb-5">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-terracotta text-terracotta" aria-hidden="true" />)}
              </div>
            </div>
            <h2 className="text-[clamp(22px,3.5vw,36px)] font-extrabold text-white tracking-tight mb-4">
              15 minutes that could save you months of guessing.
            </h2>
            <p className="text-[15px] text-white/75 mb-8 max-w-xl mx-auto">
              Free. No account. No sales call unless you want one. Results visible immediately — email is optional.
            </p>
            <m.button
              onClick={openModal}
              whileHover={reduce ? {} : { scale: 1.03, y: -1 }}
              whileTap={reduce ? {} : { scale: 0.97 }}
              className="inline-flex items-center gap-2.5 rounded-xl bg-white px-7 py-3.5 text-[15px] font-bold text-violet shadow-[0_8px_24px_rgba(0,0,0,0.2)] transition hover:shadow-[0_12px_32px_rgba(0,0,0,0.3)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/50"
            >
              {t("page.ctaPrimary")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </m.button>
          </m.div>
        </div>
      </section>

      {/* ── Bottom exit CTAs ────────────────────────────────────────────── */}
      <section className="border-t border-charcoal/6 bg-mist py-12 sm:py-14">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:gap-6">
            <Link
              to="/services"
              onClick={() => trackEvent("self_audit_exit_clicked", { target: "services" })}
              className="group flex flex-col gap-2 rounded-2xl border border-charcoal/8 bg-white p-6 transition hover:-translate-y-0.5 hover:border-violet/30 hover:shadow-[0_16px_40px_-16px_rgb(var(--color-violet-rgb)/0.18)]"
            >
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-violet">{t("page.catalogueTitle")}</span>
              <h3 className="text-[17px] font-bold text-charcoal">{t("page.catalogueLead")}</h3>
              <p className="text-[13px] leading-relaxed text-charcoal/65">{t("page.catalogueBody")}</p>
              <span className="mt-auto pt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet transition group-hover:gap-2.5">
                {t("page.catalogueCta")} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </Link>
            <Link
              to="/contact"
              onClick={() => trackEvent("self_audit_exit_clicked", { target: "contact" })}
              className="group flex flex-col gap-2 rounded-2xl border border-violet/20 bg-violet/[0.04] p-6 transition hover:-translate-y-0.5 hover:border-violet/35 hover:shadow-[0_16px_40px_-16px_rgb(var(--color-violet-rgb)/0.20)]"
            >
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-violet">{t("page.talkTitle")}</span>
              <h3 className="text-[17px] font-bold text-charcoal">{t("page.talkCta")}</h3>
              <p className="text-[13px] leading-relaxed text-charcoal/65">Walk through your results with me — no sales pitch, just an honest read on what to prioritise.</p>
              <span className="mt-auto pt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet transition group-hover:gap-2.5">
                Book a call <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Audit Modal ──────────────────────────────────────────────────── */}
      <AuditModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  )
}
