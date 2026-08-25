/* ════════════════════════════════════════════════════════════════════════
   ServicesHero.jsx · F07.v6 · Live Delivery Pipeline hero
   ────────────────────────────────────────────────────────────────────────
   Two-column hero for the Services page:
     · Left  — eyebrow chip · bold display headline with mint underline on
                a key word · subhead · two CTAs (violet primary + ghost
                secondary) · stats row · star-rating row.
     · Right — Live Delivery Pipeline: a violet to terracotta hub orbited
                by six service-family nodes (IT Strategy, Brand & UX,
                Cloud, Web/AI, EdTech, Managed Ops), each rendered with
                its real Lucide icon and labelled. Animated dashed data
                threads connect the hub to every node. A live "Now
                shipping" chip in the top-right pulls the latest featured
                project from the portfolio API, with a graceful static
                fallback when offline.
   Brand-native palette only (violet, terracotta, mist, charcoal, mint).
   Respects `prefers-reduced-motion` for every animation primitive.
   Drops in via `<ServicesHero />` — ServicesPage.jsx already imports it.
   ════════════════════════════════════════════════════════════════════════ */

import { m, useReducedMotion } from "framer-motion"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import {
  ArrowRight, Sparkles, Calendar, ClipboardCheck, Star,
  Briefcase, PieChart, TrendingUp, Package, Check,
} from "lucide-react"
import KineticHeadline from "../motion/KineticHeadline"
// The service count is DERIVED, never typed. The hero used to hard-code "96"
// while the section directly below it read "Twenty-one services grouped into
// four lines" — a contradiction a visitor could spot on one screen. Reading
// the catalogue means the two can never disagree again.
import { CATALOG_STATS } from "../../data/servicesCatalogue"

/* ── Animation variants ─────────────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}

/* ── Container ──────────────────────────────────────────────────────────── */
function Container({ children, className = "" }) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  )
}

/* ── Eyebrow chip ───────────────────────────────────────────────────────── */
function EyebrowChip({ children }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-pale px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet">
      {children}
    </span>
  )
}

/* ── Hand-drawn underline · violet→terracotta gradient stroke ────────── */
function BrandUnderline() {
  return (
    <svg
      aria-hidden="true"
      className="absolute -bottom-1 left-0 right-0 h-2.5 w-full"
      viewBox="0 0 100 8"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="brand-underline-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="var(--color-violet)" />
          <stop offset="65%"  stopColor="var(--color-violet-mid)" />
          <stop offset="100%" stopColor="var(--color-coral)" />
        </linearGradient>
      </defs>
      <path
        d="M2 5 Q 25 1, 50 4 T 98 5"
        stroke="url(#brand-underline-grad)"
        strokeWidth="3.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

/* ── Hero customer photo ────────────────────────────────────────────────
   Free Unsplash portrait, served from Unsplash's CDN. Easy to swap by
   editing this constant. */
const CUSTOMER_PHOTO = "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=900&q=80"

/* ── Right-side illustration · Composed scene with floating stat cards ───
   A senior agency-grade hero composition:
   - Center: real customer photo (warm, human anchor)
   - Flanking: violet "Services" + dark "Engagements" stat cards
   - Floating top: "{t("hero.servicePlan")}" tag + "{t("hero.onTimeDelivery")}" stat
   - Floating bottom: "On duty" availability badge
   - Hand-drawn marker squiggles for editorial energy
   Each card has its own gentle floating motion at different phases.
   Fully responsive — composition contracts on small screens. */
function ServicesHeroIllustration({ reduce }) {
  const { t } = useTranslation("services")
  return (
    <m.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto w-full max-w-[420px] sm:max-w-[520px] md:max-w-[600px] lg:max-w-[660px]"
      role="img"
      aria-label={t("hero.compositionAria")}
    >
      {/* Wrapper with fixed aspect ratio so card positions stay locked */}
      <div className="relative w-full" style={{ aspectRatio: "5 / 5" }}>

        {/* ── Decorative marker squiggle (top-left) ─────────────────── */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute left-[8%] top-[2%] z-0 h-[10%] w-[14%]"
          viewBox="0 0 60 30"
        >
          <path d="M2 24 Q 14 6, 28 18 T 56 12" stroke="var(--color-violet)" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.8" />
          <circle cx="58" cy="9" r="2.4" fill="var(--color-violet)" opacity="0.7" />
        </svg>

        {/* ── Decorative marker (top-right) ─────────────────────────── */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute right-[2%] top-[2%] z-0 h-[8%] w-[10%]"
          viewBox="0 0 50 30"
        >
          <path d="M2 8 L 12 2 M 6 18 L 18 6 M 22 22 L 30 12" stroke="var(--color-coral)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>

        {/* ── Soft ambient violet bloom behind the photo ────────────── */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--color-violet) 0%, transparent 65%)" }}
        />

        {/* ═══════════════════════════════════════════════════════════
           CENTER PHOTO CARD
           ═══════════════════════════════════════════════════════════ */}
        <m.div
          initial={{ opacity: 0, scale: 0.92 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[28px] sm:rounded-[32px]"
          style={{
            width: "44%",
            aspectRatio: "3/4",
            boxShadow: "0 20px 50px -12px rgba(45,26,94,0.40), 0 8px 20px -6px rgba(0,0,0,0.18)",
          }}
        >
          <img
            src={CUSTOMER_PHOTO}
            alt={t("hero.happyClientAlt")}
            loading="eager"
            decoding="async"
            className="block h-full w-full object-cover"
          />
          {/* Soft top-bottom gradient overlay for depth */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ background: "linear-gradient(180deg, transparent 50%, rgba(45,26,94,0.18) 100%)" }}
          />
        </m.div>

        {/* ═══════════════════════════════════════════════════════════
           LEFT BIG CARD — Services (violet)
           ═══════════════════════════════════════════════════════════ */}
        <m.div
          initial={{ opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          animate={reduce ? undefined : { y: [0, -10, 0] }}
          {...(!reduce && { transition: { y: { duration: 6.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 } } })}
          className="absolute z-20 flex flex-col justify-between rounded-[24px] p-3 text-white sm:rounded-[28px] sm:p-4 lg:p-5"
          style={{
            left: "0%",
            top: "22%",
            width: "32%",
            aspectRatio: "3/4",
            background: "linear-gradient(155deg, var(--color-violet-mid) 0%, var(--color-violet-deep) 100%)",
            boxShadow: "0 18px 40px -10px rgb(var(--color-violet-rgb)/0.45), 0 6px 16px -4px rgba(45,26,94,0.30)",
          }}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 sm:h-10 sm:w-10 lg:h-11 lg:w-11">
            <PieChart className="h-4 w-4 text-white sm:h-5 sm:w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/70 sm:text-[12px]">
              {t("hero.servicesLabel")}
            </div>
            <div className="mt-1 text-3xl font-bold leading-none tracking-tight text-white sm:text-4xl lg:text-5xl">
              {CATALOG_STATS.totalServices}
            </div>
          </div>
        </m.div>

        {/* ═══════════════════════════════════════════════════════════
           RIGHT BIG CARD — Engagements (charcoal)
           ═══════════════════════════════════════════════════════════ */}
        <m.div
          initial={{ opacity: 0, x: 24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, delay: 0.30, ease: [0.22, 1, 0.36, 1] }}
          animate={reduce ? undefined : { y: [0, 10, 0] }}
          {...(!reduce && { transition: { y: { duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1.4 } } })}
          className="absolute z-20 flex flex-col justify-between rounded-[24px] p-3 text-white sm:rounded-[28px] sm:p-4 lg:p-5"
          style={{
            right: "0%",
            top: "22%",
            width: "32%",
            aspectRatio: "3/4",
            background: "linear-gradient(155deg, var(--color-charcoal-light) 0%, var(--color-charcoal) 100%)",
            boxShadow: "0 18px 40px -10px rgba(0,0,0,0.40), 0 6px 16px -4px rgba(0,0,0,0.25)",
          }}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 sm:h-10 sm:w-10 lg:h-11 lg:w-11">
            <Briefcase className="h-4 w-4 text-white sm:h-5 sm:w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/70 sm:text-[12px]">
              {t("hero.engagements")}
            </div>
            <div className="mt-1 text-3xl font-bold leading-none tracking-tight text-white sm:text-4xl lg:text-5xl">
              82+
            </div>
          </div>
        </m.div>

        {/* ═══════════════════════════════════════════════════════════
           TOP FLOAT — "{t("hero.servicePlan")}" tag (above center photo)
           ═══════════════════════════════════════════════════════════ */}
        <m.div
          initial={{ opacity: 0, y: -16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          animate={reduce ? undefined : { y: [0, -4, 0] }}
          {...(!reduce && { transition: { y: { duration: 5.5, repeat: Infinity, ease: "easeInOut" } } })}
          className="absolute left-1/2 top-[2%] z-30 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-charcoal-80 shadow-[0_8px_22px_rgba(45,26,94,0.16)] sm:gap-2 sm:px-4 sm:py-2 sm:text-[12px]"
        >
          <Package className="h-3.5 w-3.5 text-violet sm:h-4 sm:w-4" style={{ color: "var(--color-violet)" }} aria-hidden="true" />
          <span>{t("hero.servicePlan")}</span>
        </m.div>

        {/* ═══════════════════════════════════════════════════════════
           TOP-RIGHT FLOAT — "{t("hero.onTimeDelivery")}" stat (peach card)
           ═══════════════════════════════════════════════════════════ */}
        <m.div
          initial={{ opacity: 0, x: 16, y: -8 }}
          whileInView={{ opacity: 1, x: 0, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, delay: 0.45 }}
          animate={reduce ? undefined : { y: [0, -5, 0] }}
          {...(!reduce && { transition: { y: { duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.4 } } })}
          className="absolute right-[2%] top-[8%] z-30 rounded-2xl bg-[var(--color-coral-pale)] px-2.5 py-2 shadow-[0_10px_24px_rgb(var(--color-coral-rgb)/0.20)] sm:right-[4%] sm:px-3 sm:py-2.5"
        >
          <div className="font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-charcoal-80/65 sm:text-[9px]">
            {t("hero.onTimeDelivery")}
          </div>
          <div className="mt-1 flex items-center gap-1.5 sm:gap-2">
            <span className="text-base font-bold leading-none text-charcoal-80 sm:text-lg">94%</span>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-mint/15 px-1.5 py-0.5 text-[9px] font-semibold text-mint-700 sm:text-[10px]">
              <TrendingUp className="h-2.5 w-2.5" aria-hidden="true" />
              5.2%
            </span>
          </div>
        </m.div>

        {/* ═══════════════════════════════════════════════════════════
           BOTTOM-RIGHT FLOAT — "On duty" availability mini-card
           ═══════════════════════════════════════════════════════════ */}
        <m.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, delay: 0.55 }}
          animate={reduce ? undefined : { y: [0, 6, 0] }}
          {...(!reduce && { transition: { y: { duration: 6.5, repeat: Infinity, ease: "easeInOut", delay: 1.0 } } })}
          className="absolute bottom-[6%] right-[8%] z-30 rounded-2xl bg-[var(--color-charcoal)] px-3 py-2 text-white shadow-[0_12px_28px_rgba(0,0,0,0.35)] sm:px-3.5 sm:py-2.5"
        >
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5">
              <span className="block h-5 w-5 rounded-full border-2 border-[var(--color-charcoal)] bg-violet sm:h-6 sm:w-6" style={{ background: "linear-gradient(135deg, var(--color-violet-mid), var(--color-coral))" }} />
              <span className="block h-5 w-5 rounded-full border-2 border-[var(--color-charcoal)] bg-emerald-400 sm:h-6 sm:w-6" />
              <span className="block h-5 w-5 rounded-full border-2 border-[var(--color-charcoal)] bg-orange-300 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-white/55 sm:text-[9px]">
                {t("hero.nowBooking")}
              </div>
              <div className="text-[11px] font-semibold leading-tight text-white sm:text-[12px]">
                {t("hero.capacityOpen")}
              </div>
            </div>
            <span className="relative flex h-2 w-2 shrink-0">
              <span className={`absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 ${reduce ? "" : "animate-ping"}`} />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
          </div>
        </m.div>
      </div>
    </m.div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   COMPONENT
   ════════════════════════════════════════════════════════════════════════ */
export default function ServicesHero() {
  const { t } = useTranslation("services")
  const reduce = useReducedMotion()

  return (
    <section className="relative overflow-hidden bg-white pb-12 pt-4 sm:pb-16 sm:pt-6 lg:pb-20 lg:pt-8">

      {/* ── Soft ambient blobs · gentle motion ─────────────────────── */}
      <m.div
        aria-hidden="true"
        animate={reduce ? undefined : { x: [0, 22, 0], y: [0, 14, 0], scale: [1, 1.06, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet/[0.05] blur-3xl"
      />
      <m.div
        aria-hidden="true"
        animate={reduce ? undefined : { x: [0, -18, 0], y: [0, -10, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
        className="pointer-events-none absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-mint/[0.08] blur-3xl"
      />

      <Container>
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">

          {/* ── LEFT · narrative + CTAs + proof ─────────────────────── */}
          <m.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="max-w-xl"
          >
            {/* Eyebrow */}
            <m.div variants={fadeUp}>
              <EyebrowChip>
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                {t("hero.servicesEyebrow")}
              </EyebrowChip>
            </m.div>

            {/* Phase 10b · kinetic word-by-word reveal. The legacy
                gradient-clipped span (with its underline decoration) is
                preserved as a `gradient: true` part — the gradient
                sweep replaces the underline as the emphasis affordance.
                The trailing period is appended to the gradient text so
                it inherits the same tint. */}
            <KineticHeadline
              as="h1"
              className="mt-5 text-display !text-charcoal-80 text-balance"
              stagger={0.07}
              parts={[
                { text: t("hero.headlinePremium") },
                { text: `${t("hero.honestPrice")}.`, gradient: true },
              ]}
              gradientClassName="bg-gradient-to-r from-violet via-[var(--color-violet-mid)] to-terracotta bg-clip-text !text-transparent"
            />

            {/* Subhead · marketing voice — three-beat rhythm, plain words */}
            <m.p
              variants={fadeUp}
              className="mt-5 max-w-md text-[15px] leading-7 text-charcoal-80/65 sm:text-[16px]"
            >
              {t("hero.headlineWebsitesApps")} <span className="font-semibold text-charcoal-80">{t("hero.builtRight")}</span>, <span className="font-semibold text-charcoal-80">{t("hero.pricedFair")}</span>, <span className="font-semibold text-charcoal-80">{t("hero.deliveredFast")}</span>.
            </m.p>

            {/* CTAs */}
            <m.div
              variants={fadeUp}
              className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4"
            >
              {/* Primary conversion CTA — Innovation Gradient (Brand v3 sacred,
                  reserved for Book / Buy / Checkout / Contact CTAs). */}
              <Link
                to="/book"
                className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-grad-innovation px-6 py-3.5 text-[14px] font-bold !text-white shadow-[0_16px_36px_-10px_rgb(var(--color-violet-rgb)/0.55),0_4px_10px_-2px_rgb(var(--color-azure-rgb)/0.25)] ring-1 ring-inset ring-white/15 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_48px_-10px_rgb(var(--color-violet-rgb)/0.65),0_6px_14px_-2px_rgb(var(--color-azure-rgb)/0.32)] focus:outline-none focus-visible:ring-2 focus-visible:ring-azure/50 focus-visible:ring-offset-2"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent"
                />
                <Calendar className="relative h-4 w-4 !text-white" aria-hidden="true" />
                <span className="relative">{t("hero.bookCallCta")}</span>
                <ArrowRight className="relative h-4 w-4 !text-white transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
              {/* Secondary CTA · Self-audit tool — replaces the old
                  "Download diagnosis checklist" PDF with an interactive
                  15-minute capability assessment served at /diagnostic
                  (public/diagnostic/index.html). Opens in a new tab so the
                  user's place on the services page is preserved. */}
              {/* Self-audit CTA · same-window navigation to the new React
                  shell at /self-audit (the shell iframes /diagnostic and
                  forwards every audit event to trackEvent for analytics).
                  Pre-fix this targeted /diagnostic directly with
                  target="_blank", which (a) lost the SPA chrome, (b)
                  bypassed page-view tracking, and (c) made the iframe-based
                  analytics dead-on-arrival because the new tab had no GA
                  bootstrap. */}
              <Link
                to="/self-audit"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-charcoal-80/15 bg-white px-6 py-3.5 text-[14px] font-bold !text-charcoal-80 transition hover:-translate-y-0.5 hover:border-violet/30 hover:!text-violet focus:outline-none focus-visible:ring-2 focus-visible:ring-violet/30"
              >
                <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                {t("hero.selfAuditCta", "Take the free self-audit")}
              </Link>
            </m.div>

            {/* Stats row */}
            <m.div
              variants={fadeUp}
              className="mt-8 grid grid-cols-2 gap-6 sm:max-w-sm sm:gap-8"
            >
              <div>
                <div className="font-mono text-[28px] font-extrabold leading-none tabular-nums !text-charcoal-80 sm:text-[32px]">
                  94<span className="!text-mint">%</span>
                </div>
                <div className="mt-1.5 text-[11.5px] text-charcoal-80/65 sm:text-[12px]">
                  {t("hero.onTimeDelivery")}
                </div>
              </div>
              <div>
                <div className="font-mono text-[28px] font-extrabold leading-none tabular-nums !text-charcoal-80 sm:text-[32px]">
                  {CATALOG_STATS.totalServices}
                </div>
                <div className="mt-1.5 text-[11.5px] text-charcoal-80/65 sm:text-[12px]">
                  {t("hero.atomicServices")}
                </div>
              </div>
            </m.div>

            {/* Divider */}
            <m.div
              variants={fadeUp}
              aria-hidden="true"
              className="mt-7 h-px w-full max-w-sm bg-gradient-to-r from-charcoal-80/15 via-charcoal-80/10 to-transparent"
            />

            {/* Feature ticks — three concrete value points */}
            <m.ul
              variants={fadeUp}
              className="mt-5 grid grid-cols-1 gap-2.5 sm:max-w-md sm:grid-cols-1"
            >
              {[
                "Senior work, no juniors",
                "Fixed price, no surprises",
                "Direct line, no middlemen",
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2.5">
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={{ background: "linear-gradient(135deg, var(--color-violet), var(--color-violet-mid))" }}
                    aria-hidden="true"
                  >
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  </span>
                  <span className="text-[13px] font-medium text-charcoal-80 sm:text-[14px]">
                    {feature}
                  </span>
                </li>
              ))}
            </m.ul>
          </m.div>

          {/* ── RIGHT · Live Delivery Pipeline ──────────────────────── */}
          <ServicesHeroIllustration reduce={reduce} />
        </div>
      </Container>
    </section>
  )
}
