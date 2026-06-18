/* ════════════════════════════════════════════════════════════════════════
   ServicesPage.jsx · v9 · Industry-standard 9-section service page
   ────────────────────────────────────────────────────────────────────────
   Visual refresh focused on §§ 02, 03, and 08 while preserving the rest of
   the proven 9-section architecture:

     § 01 · Hero ··········································· (preserved)
     § 02 · Technology Services · 6-card grid ············· (REDESIGNED)
     § 03 · Value · With/Without comparison ··············· (NEW)
     § 04 · Why Choose Us · 4 differentiation pillars ····· (preserved)
     § 05 · Testimonials & credentials ···················· (preserved)
     § 06 · Process · 6-step delivery ····················· (preserved)
     § 07 · Pricing matrix · 6 categories × 3 tiers ······· (preserved)
     § 08 · FAQs · search + category filter + JSON-LD ····· (UPGRADED)
     § 09 · Final CTA ····································· (preserved)
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { Link } from "react-router-dom"
import {
  ArrowRight, ArrowDown, Sparkles, Calendar, Plus, Minus, Check, X, Star, Zap,
  Search as SearchIcon, SearchX, Lightbulb, Settings2, LineChart, Headphones,
  Trophy, Layers, Globe, Globe2, Languages, UserCheck, BookMarked,
  Award, ShieldCheck, MessageCircle, Mail, Phone, Download, FileText, ClipboardCheck,
  CheckCircle2, XCircle,
  User, Briefcase, GraduationCap,
} from "lucide-react"
import Seo from "../components/seo/Seo"
import ServicesHero from "../components/heroes/ServicesHero"
import { pageSeo } from "../seo/pageSeo"
import { seamlessProcess } from "../data/sitePagesData"
import {
  CATEGORIES, CATEGORY_PLANS, PLAN_TIERS,
  servicesByCategory, CREDENTIALS, SERVICES_FAQ_ITEMS,
  CATALOG_STATS, BENEFITS_COMPARISON, CATEGORY_TILE_TONES,
  AUDIENCE_PRICING_PLANS as STATIC_AUDIENCE_PRICING_PLANS,
  AUDIENCE_PRICING_ORDER as STATIC_AUDIENCE_PRICING_ORDER,
  DIFFERENTIATION_PILLARS,
} from "../data/servicesCatalogue"
import { fetchAudiencePlans } from "../services/serviceService"
import SpotlightCard from "../components/motion/SpotlightCard"
import Meteors from "../components/motion/Meteors"
import MagneticButton from "../components/motion/MagneticButton"

// Audience-icon map — the API doesn't return React components, so we resolve
// the icon locally per audience code. Falls back to User for unknown codes.
const AUDIENCE_ICONS = {
  professional: User,
  business: Briefcase,
  schools: GraduationCap,
}

/**
 * Merge live API data over the static catalogue. The API source is the source
 * of truth for editable bits (features, prices, tier metadata); the static
 * catalogue contributes its decorative bits (Icon, accent, short, description
 * fallback) so the page never goes blank if the API has fewer details.
 *
 * Pricing is in MXN. The page reads `tier.priceMxn` for display, so we
 * normalise the API's currency-agnostic `price` field down to that name.
 */
function normalizeTier(liveTier, staticTier) {
  if (!liveTier && !staticTier) return null
  const t = { ...(staticTier || {}), ...(liveTier || {}) }
  // Live API returns `price` (currency-agnostic). Static catalogue has
  // `priceMxn` and `priceUsd`. Prefer live → priceMxn → priceUsd × 20 fallback.
  const priceMxn =
    (liveTier && Number.isFinite(Number(liveTier.price))) ? Number(liveTier.price)
    : (staticTier && Number.isFinite(Number(staticTier.priceMxn))) ? Number(staticTier.priceMxn)
    : (staticTier && Number.isFinite(Number(staticTier.priceUsd))) ? Number(staticTier.priceUsd) * 20
    : 0
  return { ...t, priceMxn, currency: t.currency || "MXN" }
}

function mergeAudiencePlans(staticPlans, livePlans) {
  if (!livePlans) {
    // Even with no live data, normalise tiers so display logic uses priceMxn.
    const out = {}
    for (const code of Object.keys(staticPlans || {})) {
      const stat = staticPlans[code]
      const tiers = {}
      for (const tk of Object.keys(stat?.tiers || {})) {
        tiers[tk] = normalizeTier(null, stat.tiers[tk])
      }
      out[code] = { ...stat, tiers }
    }
    return out
  }

  const merged = {}
  const allCodes = new Set([
    ...Object.keys(staticPlans || {}),
    ...Object.keys(livePlans || {}),
  ])
  for (const code of allCodes) {
    const stat = staticPlans?.[code] || {}
    const live = livePlans[code] || {}

    const tierKeys = new Set([
      ...Object.keys(stat.tiers || {}),
      ...Object.keys(live.tiers || {}),
    ])
    const tiers = {}
    for (const tk of tierKeys) {
      tiers[tk] = normalizeTier(live.tiers?.[tk], stat.tiers?.[tk])
    }

    merged[code] = {
      ...stat,
      ...live,
      Icon: AUDIENCE_ICONS[code] || stat.Icon || User,
      accent: stat.accent || "violet",
      tiers,
      features: Array.isArray(live.features) && live.features.length > 0
                     ? live.features
                     : (stat.features || []),
      description: live.description || stat.description || "",
      name: live.name || stat.name || code,
      code,
    }
  }
  return merged
}

/* ── Local helpers ──────────────────────────────────────────────────────── */
// MXN is the platform's local currency. Pricing throughout the public site
// is denominated in Mexican Pesos so customers can pay in their own currency.
const formatMxn = (n) => `$${Number(n).toLocaleString("es-MX")} MXN`
// Kept for any legacy callsite that still pipes USD through (none should remain).
const formatUsd = (n) => `$${Number(n).toLocaleString("en-US")} USD`

/* ── Motion variants ─────────────────────────────────────────────────────── */
const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } }
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } }

const processIcons = [SearchIcon, Lightbulb, Zap, Settings2, LineChart, Headphones]

/* ── UI atoms ───────────────────────────────────────────────────────────── */
function Container({ children, className = "" }) {
  return <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
}

function EyebrowChip({ children, tone = "violet" }) {
  const tones = {
    violet: "bg-violet-pale text-violet",
    white: "bg-white/10 ring-1 ring-white/15 !text-terracotta",
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] sm:px-3 sm:text-[11px] ${tones[tone] || tones.violet}`}>
      {children}
    </span>
  )
}

function SectionHeader({ eyebrow, title, subtitle, align = "center", invert }) {
  const center = align === "center"
  const titleColor = invert ? "!text-white" : "!text-violet"
  const subColor = invert ? "!text-white/65" : "text-charcoal-80/70"
  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      className={`mb-10 flex flex-col gap-3 sm:mb-12 ${center ? "items-center text-center" : "items-start"}`}
    >
      {eyebrow ? (<motion.div variants={fadeUp}><EyebrowChip tone={invert ? "white" : "violet"}>{eyebrow}</EyebrowChip></motion.div>) : null}
      <motion.h2 variants={fadeUp} className={`max-w-3xl text-[24px] font-bold leading-[1.14] tracking-tight ${titleColor} sm:text-[32px] md:text-[40px]`}>
        {title}
      </motion.h2>
      {subtitle ? (
        <motion.p variants={fadeUp} className={`max-w-2xl text-[13.5px] leading-6 sm:text-[15px] sm:leading-7 ${subColor} ${center ? "mx-auto" : ""}`}>
          {subtitle}
        </motion.p>
      ) : null}
    </motion.div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   PAGE
   ════════════════════════════════════════════════════════════════════════ */
export default function ServicesPage() {
  const { t } = useTranslation("services")
  const reduce = useReducedMotion()

  /* §§ 03 · benefits toggle state */
  const [benefitView, setBenefitView] = useState("with")

  /* §§ 07 · live audience-plans state — DB-backed with static fallback so the
     page renders instantly even if the API is slow / missing. */
  const [livePlans, setLivePlans] = useState(null)
  const [liveOrder, setLiveOrder] = useState(null)

  useEffect(() => {
    let aborted = false
    ;(async () => {
      const result = await fetchAudiencePlans()
      if (aborted || !result) return
      setLivePlans(result.plans)
      if (Array.isArray(result.order)) setLiveOrder(result.order)
    })()
    return () => { aborted = true }
  }, [])

  const AUDIENCE_PRICING_PLANS = useMemo(
    () => mergeAudiencePlans(STATIC_AUDIENCE_PRICING_PLANS, livePlans),
    [livePlans]
  )
  const AUDIENCE_PRICING_ORDER = useMemo(
    () => liveOrder || STATIC_AUDIENCE_PRICING_ORDER,
    [liveOrder]
  )

  /* §§ 08 · FAQ state */
  const [pricingAudience, setPricingAudience] = useState("professional")
  const [openFAQ, setOpenFAQ] = useState(null)
  const [faqQuery, setFaqQuery] = useState("")
  const [faqCategory, setFaqCategory] = useState("All")
  const faqRefs = useRef({})

  const FAQ_CATEGORIES = useMemo(() => {
    const cats = SERVICES_FAQ_ITEMS.map((f) => f.category).filter(Boolean)
    return ["All", ...Array.from(new Set(cats))]
  }, [])

  const filteredFAQs = useMemo(() => {
    const q = faqQuery.trim().toLowerCase()
    return SERVICES_FAQ_ITEMS.filter((f) => {
      if (faqCategory !== "All" && f.category && f.category !== faqCategory) return false
      if (!q) return true
      return (
        f.question?.toLowerCase().includes(q) ||
        f.answer?.toLowerCase().includes(q)
      )
    })
  }, [faqQuery, faqCategory])

  /* JSON-LD FAQPage schema (full set, regardless of filters) */
  useEffect(() => {
    const id = "services-faq-jsonld"
    document.getElementById(id)?.remove()
    const script = document.createElement("script")
    script.type = "application/ld+json"
    script.id = id
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: SERVICES_FAQ_ITEMS.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    })
    document.head.appendChild(script)
    return () => { document.getElementById(id)?.remove() }
  }, [])

  function handleFAQKeyNav(e, faqId) {
    const ids = filteredFAQs.map((f) => f.id)
    const i = ids.indexOf(faqId)
    if (e.key === "Escape" && openFAQ !== null) { e.preventDefault(); setOpenFAQ(null); return }
    if (e.key === "ArrowDown" && i < ids.length - 1) { e.preventDefault(); faqRefs.current[ids[i + 1]]?.focus(); return }
    if (e.key === "ArrowUp" && i > 0) { e.preventDefault(); faqRefs.current[ids[i - 1]]?.focus(); return }
    if (e.key === "Home") { e.preventDefault(); faqRefs.current[ids[0]]?.focus(); return }
    if (e.key === "End") { e.preventDefault(); faqRefs.current[ids[ids.length - 1]]?.focus() }
  }

  return (
    <>
      <Seo {...(pageSeo.ServicesPage || pageSeo.services || {})} includeLocalBusiness />

      {/* ╔════════════════════════════════════════════════════════════════
           § 01 · HERO · doodle illustration · service-catalog cover
           ════════════════════════════════════════════════════════════════ */}
      <ServicesHero />

            {/* ╔════════════════════════════════════════════════════════════════
           § 02 · TECHNOLOGY SERVICES · calm 6-card numbered grid
           ════════════════════════════════════════════════════════════════ */}
      <section id="overview" className="bg-mist py-16 sm:py-20 lg:py-24">
        <Container>
          {/* Header · centered */}
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="mx-auto mb-12 flex max-w-2xl flex-col items-center gap-4 text-center sm:mb-14"
          >
            <motion.div variants={fadeUp}>
              <EyebrowChip>{t("overview.eyebrow")}</EyebrowChip>
            </motion.div>
            <motion.h2
              variants={fadeUp}
              className="text-[28px] font-bold tracking-tight !text-violet sm:text-[36px] md:text-[44px]"
            >
              {t("overview.title")}
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-[14px] leading-relaxed text-charcoal-80/65 sm:text-[15.5px]"
            >
              {t("overview.subtitle")}
            </motion.p>
          </motion.div>

          {/* 6-card grid · numbered · calm */}
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="grid gap-5 sm:gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {CATEGORIES.map((cat, idx) => (
              <motion.article key={cat.code} variants={fadeUp}>
              <SpotlightCard className="relative overflow-hidden rounded-2xl border border-charcoal-80/[0.06] bg-white p-6 shadow-[0_8px_28px_rgba(93,63,211,0.04)] sm:p-7 h-full transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(93,63,211,0.10)]">
                {/* Faded number · top-right */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-6 top-5 select-none font-mono text-[28px] font-bold tabular-nums text-violet/[0.12] sm:right-7 sm:top-6 sm:text-[32px]"
                >
                  {String(idx + 1).padStart(2, "0")}
                </span>

                {/* Icon tile · top-left */}
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-pale text-violet sm:h-12 sm:w-12">
                  <cat.Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                </div>

                {/* Title */}
                <h3 className="mt-5 text-[16px] font-bold leading-tight !text-violet sm:mt-6 sm:text-[17px]">
                  {cat.name}
                </h3>

                {/* Description */}
                <p className="mt-2 text-[13px] leading-relaxed text-charcoal-80/65 sm:text-[14px]">
                  {cat.tagline}
                </p>
              </SpotlightCard>
              </motion.article>
            ))}
          </motion.div>
        </Container>
      </section>

            {/* ╔════════════════════════════════════════════════════════════════
           § 03 · VALUE · How services benefit your organization
           ════════════════════════════════════════════════════════════════ */}
      <section id="value" className="py-16 sm:py-20 lg:py-24">
        <Container>
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="mx-auto max-w-3xl text-center"
          >
            <motion.div variants={fadeUp}>
              <EyebrowChip>{t("value.eyebrow")}</EyebrowChip>
            </motion.div>
            <motion.h2
              variants={fadeUp}
              className="mt-5 text-[28px] font-bold tracking-tight !text-violet sm:text-[36px] md:text-[44px]"
            >
              {t("value.title")}
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="mt-4 text-[14px] leading-relaxed text-charcoal-80/70 sm:text-[15.5px]"
            >
              {t("value.subtitle")}
            </motion.p>
          </motion.div>

          {/* Toggle, animated pill */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mt-10 flex justify-center"
          >
            <div
              role="tablist"
              aria-label={t("value.toggle.ariaLabel")}
              className="inline-flex items-center rounded-full bg-white p-1 shadow-[0_8px_24px_rgba(93,63,211,0.06)] ring-1 ring-charcoal-80/10"
            >
              {[
                { key: "with", label: t("value.toggle.with") },
                { key: "without", label: t("value.toggle.without") },
              ].map((tab) => {
                const active = benefitView === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setBenefitView(tab.key)}
                    className="relative rounded-full px-5 py-2.5 text-[13px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 sm:text-[14px]"
                  >
                    {active && (
                      <motion.span
                        layoutId="benefits-toggle-pill"
                        className="absolute inset-0 rounded-full bg-violet"
                        transition={{ type: "spring", stiffness: 320, damping: 28 }}
                      />
                    )}
                    <span className={`relative ${active ? "!text-white" : "text-charcoal-80/55"}`}>
                      {tab.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </motion.div>

          {/* Cards grid · animated swap */}
          <div className="mt-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={benefitView}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                {BENEFITS_COMPARISON.map((b, idx) => {
                  const isWith = benefitView === "with"
                  const Icon = isWith ? CheckCircle2 : XCircle
                  const tileClass = isWith
                    ? "bg-mint/10 text-emerald-700"
                    : "bg-rose-50 text-rose-500"
                  const text = isWith ? b.with : b.without

                  return (
                    <motion.div
                      key={`${benefitView}-${b.id}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04, duration: 0.3 }}
                      className="flex items-start gap-4 rounded-2xl bg-white p-5 ring-1 ring-charcoal-80/[0.06] shadow-[0_8px_28px_rgba(93,63,211,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_44px_rgba(93,63,211,0.1)] sm:p-6"
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tileClass}`}
                        aria-hidden="true"
                      >
                        <Icon className="h-5 w-5" strokeWidth={2.2} />
                      </span>
                      <p className="pt-1 text-[13.5px] font-semibold leading-snug text-charcoal-80 sm:text-[14.5px]">
                        {text}
                      </p>
                    </motion.div>
                  )
                })}
              </motion.div>
            </AnimatePresence>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mt-10 text-center text-[11.5px] text-charcoal-80/50"
          >
            {t("value.footer")}
          </motion.p>
        </Container>
      </section>

      {/* ╔════════════════════════════════════════════════════════════════
           § 04 · WHY CHOOSE US · 5 reason cards + 1 summary tile
           ════════════════════════════════════════════════════════════════ */}
      <section className="py-16 sm:py-20 lg:py-24">
        <Container>
          {/* Header · centered · big bold heading */}
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="mx-auto mb-12 flex max-w-3xl flex-col items-center gap-5 text-center sm:mb-14"
          >
            <motion.div variants={fadeUp}>
              <EyebrowChip>{t("why.eyebrow")}</EyebrowChip>
            </motion.div>
            <motion.h2
              variants={fadeUp}
              className="text-page !text-violet"
            >
              {t("why.titlePart1")}{" "}
              <span className="block sm:inline">{t("why.titlePart2")}</span>
            </motion.h2>
          </motion.div>

          {/* Grid · 5 reason cards + 1 summary tile · 3-col × 2-row */}
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="grid gap-x-6 gap-y-10 md:grid-cols-2 md:gap-y-12 lg:grid-cols-3 lg:gap-x-8"
          >
            {DIFFERENTIATION_PILLARS.map((pillar) => (
              <motion.article
                key={pillar.id}
                variants={fadeUp}
                className="flex flex-col"
              >
                {/* Icon tile · square · pale violet · clean */}
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-pale text-violet">
                  <pillar.Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                </div>

                {/* Title · short, bold */}
                <h3 className="mt-5 text-[17px] font-bold leading-tight !text-violet sm:text-[18px]">
                  {pillar.title}
                </h3>

                {/* Description · 3 lines, muted */}
                <p className="mt-2 text-[13.5px] leading-relaxed text-charcoal-80/65 sm:text-[14px]">
                  {pillar.support}
                </p>
              </motion.article>
            ))}

            {/* 6th cell · summary tile · cluster of all icons */}
            <motion.div
              variants={fadeUp}
              className="flex items-center justify-center rounded-2xl bg-violet-pale/55 p-6 sm:p-7 lg:p-8"
              aria-hidden="true"
            >
              <div className="grid w-full max-w-[260px] grid-cols-3 gap-3 sm:gap-4">
                {DIFFERENTIATION_PILLARS.map((pillar, idx) => (
                  <div
                    key={pillar.id}
                    className={`flex h-12 w-12 items-center justify-center rounded-xl shadow-[0_4px_14px_rgba(93,63,211,0.05)] sm:h-14 sm:w-14 ${
                      idx === 4
                        ? "bg-transparent text-violet"
                        : "bg-white text-violet"
                    }`}
                  >
                    <pillar.Icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.8} />
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </Container>
      </section>

            {/* ╔════════════════════════════════════════════════════════════════
           § 05 · TESTIMONIALS / SOCIAL PROOF · credentials + institutions
           ════════════════════════════════════════════════════════════════ */}
      <section className="py-14 sm:py-16 lg:py-20" style={{ backgroundColor: "#1A1B23" }}>
        <Container>
          <SectionHeader
            eyebrow={t("social.eyebrow")}
            title={t("social.title")}
            subtitle={t("social.subtitle")}
            invert
          />

          <ul className="mx-auto grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-4" aria-label={t("social.credentialsAria")}>
            {CREDENTIALS.map(({ id, label, issuer, Icon }) => (
              <li
                key={id}
                title={`${label} · ${issuer}`}
                className="flex flex-col items-start gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07] sm:p-5"
              >
                <Icon className="h-4 w-4 text-terracotta sm:h-5 sm:w-5" aria-hidden="true" />
                <div className="text-[12.5px] font-semibold leading-tight !text-white sm:text-[13.5px]">{label}</div>
                <div className="text-[10.5px] !text-white/55 sm:text-[11.5px]">{issuer}</div>
              </li>
            ))}
          </ul>

          <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-md sm:p-8">
            <p className="text-[14px] !text-white/85 sm:text-[16px] sm:leading-7">
              "{t("social.testimonialQuote")}"
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet text-[12px] font-bold !text-white">TM</div>
              <div>
                <div className="text-[13px] font-semibold !text-white sm:text-[14px]">{t("social.testimonialName")}</div>
                <div className="text-[11px] !text-white/55 sm:text-[12px]">{t("social.testimonialRole")}</div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ╔════════════════════════════════════════════════════════════════
           § 06 · PROCESS / HOW IT WORKS · 6-step delivery sequence
           ════════════════════════════════════════════════════════════════ */}
      <section className="py-14 sm:py-16 lg:py-20">
        <Container>
          <SectionHeader
            eyebrow={t("process.eyebrow")}
            title={t("process.title")}
            subtitle={t("process.subtitle")}
          />

          {/* Desktop horizontal */}
          <div className="hidden lg:block">
            <div className="relative">
              <motion.div
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 1.0, ease: "easeOut" }}
                style={{ transformOrigin: "left" }}
                className="absolute left-[5%] right-[5%] top-7 h-[3px] rounded-full bg-gradient-to-r from-violet via-violet to-terracotta"
                aria-hidden="true"
              />
              <ol className="relative grid grid-cols-6 gap-4">
                {seamlessProcess.slice(0, 6).map(({ title, description }, i) => {
                  const Icon = processIcons[i] || Zap
                  return (
                    <motion.li
                      key={title}
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-40px" }}
                      transition={{ duration: 0.45, delay: i * 0.08, ease: "easeOut" }}
                      className="relative flex flex-col items-center text-center"
                    >
                      <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-white text-violet shadow-[0_8px_24px_rgba(93,63,211,0.20)] ring-4 ring-mist">
                        <span className="font-mono text-[13px] font-bold tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                      </div>
                      <div className="mt-5 flex h-9 w-9 items-center justify-center rounded-lg bg-violet/10 text-violet">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <h3 className="mt-3 text-[13px] font-bold !text-violet">{title}</h3>
                      <p className="mt-1.5 text-[11.5px] leading-5 text-charcoal-80/65">{description}</p>
                    </motion.li>
                  )
                })}
              </ol>
            </div>
          </div>

          {/* Mobile vertical */}
          <div className="lg:hidden">
            <ol className="relative space-y-5 pl-12">
              <span aria-hidden="true" className="absolute left-[27px] top-0 h-full w-px bg-gradient-to-b from-violet via-violet/40 to-transparent" />
              {seamlessProcess.slice(0, 6).map(({ title, description }, i) => {
                const Icon = processIcons[i] || Zap
                return (
                  <motion.li
                    key={title}
                    initial={{ opacity: 0, x: -16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.45, delay: i * 0.08 }}
                    className="relative"
                  >
                    <div className="absolute -left-12 flex h-12 w-12 items-center justify-center rounded-full bg-white text-violet shadow-[0_8px_24px_rgba(93,63,211,0.18)] ring-4 ring-white">
                      <span className="font-mono text-[12px] font-bold tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                    </div>
                    <div className="rounded-xl border border-charcoal-80/10 bg-white p-4 shadow-[0_4px_16px_rgba(93,63,211,0.05)] sm:p-5">
                      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-violet/10 text-violet">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <h3 className="text-[14.5px] font-bold !text-violet sm:text-[15px]">{title}</h3>
                      <p className="mt-1 text-[12.5px] leading-5 text-charcoal-80/65 sm:text-[13px]">{description}</p>
                    </div>
                  </motion.li>
                )
              })}
            </ol>
          </div>
        </Container>
      </section>

      {/* ╔════════════════════════════════════════════════════════════════
           § 07 · PRICING · 3 audiences × 3 tiers × feature matrix
           ════════════════════════════════════════════════════════════════ */}
      <section id="pricing" className="scroll-mt-12 bg-mist py-14 sm:py-16 lg:py-20">
        <Container>
          {/* Header row · headline left + audience toggle right */}
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end sm:gap-10">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              variants={stagger}
              className="max-w-xl"
            >
              <motion.div variants={fadeUp}>
                <EyebrowChip>{t("pricing.eyebrow")}</EyebrowChip>
              </motion.div>
              <motion.h2
                variants={fadeUp}
                className="mt-4 text-[28px] font-bold tracking-tight !text-violet sm:text-[36px] md:text-[44px]"
              >
                {t("pricing.title")}
              </motion.h2>
              <motion.p
                variants={fadeUp}
                className="mt-3 text-[14px] text-charcoal-80/70 sm:text-[15.5px]"
              >
                {t("pricing.subtitle")}
              </motion.p>
            </motion.div>

            {/* 3-segment audience toggle */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.15 }}
              role="tablist"
              aria-label={t("pricing.audienceAria")}
              className="inline-flex w-full items-center rounded-full bg-white p-1 shadow-[0_8px_24px_rgba(93,63,211,0.06)] ring-1 ring-charcoal-80/10 sm:w-auto"
            >
              {AUDIENCE_PRICING_ORDER.map((code) => {
                const audience = AUDIENCE_PRICING_PLANS[code]
                const Icon = audience.Icon
                const active = pricingAudience === code
                return (
                  <button
                    key={code}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setPricingAudience(code)}
                    className="relative flex-1 rounded-full px-3 py-2.5 text-[12px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 sm:px-5 sm:py-3 sm:text-[13.5px]"
                  >
                    {active && (
                      <motion.span
                        layoutId="audience-pricing-pill"
                        className="absolute inset-0 rounded-full bg-violet"
                        transition={{ type: "spring", stiffness: 320, damping: 28 }}
                      />
                    )}
                    <span className={`relative inline-flex items-center justify-center gap-1.5 ${active ? "!text-white" : "text-charcoal-80/55"}`}>
                      <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                      {audience.name}
                    </span>
                  </button>
                )
              })}
            </motion.div>
          </div>

          {/* Audience description */}
          <motion.p
            key={`desc-${pricingAudience}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-6 max-w-3xl text-[13px] leading-6 text-charcoal-80/70 sm:text-[14px]"
          >
            {AUDIENCE_PRICING_PLANS[pricingAudience].description}
          </motion.p>

          {/* PRICING MATRIX */}
          <AnimatePresence mode="wait">
            <motion.div
              key={pricingAudience}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              {(() => {
                const audience = AUDIENCE_PRICING_PLANS[pricingAudience]
                const tierKeys = Object.keys(audience.tiers)
                return (
                  <>
                    {/* Desktop matrix · 4 columns */}
                    <div className="mt-10 hidden lg:grid lg:grid-cols-[1.25fr_1fr_1fr_1fr] lg:gap-4">
                      {/* Service Details · purple feature panel */}
                      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet via-violet to-violet-deep p-7 text-white shadow-[0_18px_50px_rgba(93,63,211,0.20)]">
                        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
                        <div className="relative flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 ring-2 ring-white/25">
                            <ArrowDown className="h-5 w-5 !text-white" aria-hidden="true" />
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] !text-white/65">{t("pricing.getStarted")}</p>
                            <h3 className="mt-0.5 text-[18px] font-bold !text-white">{t("pricing.serviceDetails")}</h3>
                          </div>
                        </div>
                        <ul className="relative mt-7 flex flex-col">
                          {audience.features.map((f, i) => (
                            <li
                              key={i}
                              className="flex min-h-[44px] items-center border-t border-white/15 py-2.5 text-[12px] leading-snug !text-white/90 first:border-t-0 sm:text-[12.5px]"
                            >
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Tier columns */}
                      {tierKeys.map((tierKey) => {
                        const tier = audience.tiers[tierKey]
                        return (
                          <div
                            key={tierKey}
                            className={`relative flex flex-col rounded-2xl bg-white p-6 transition ${
                              tier.popular
                                ? "border-2 border-violet shadow-[0_22px_60px_rgba(93,63,211,0.18)]"
                                : "border border-charcoal-80/10 shadow-[0_8px_24px_rgba(93,63,211,0.05)]"
                            }`}
                          >
                            {tier.popular && (
                              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-violet px-3 py-1 text-[9.5px] font-bold uppercase tracking-[0.14em] !text-white shadow-md">
                                {t("pricing.mostPopular")}
                              </span>
                            )}

                            <div>
                              <h3 className="text-[15px] font-bold !text-violet sm:text-[16.5px]">{tier.name}</h3>
                              <div className="mt-1 flex items-baseline gap-1">
                                <span className="font-mono text-[26px] font-extrabold tabular-nums !text-violet sm:text-[30px]">
                                  ${Number(tier.priceMxn).toLocaleString("es-MX")}
                                </span>
                                <span className="text-[11.5px] font-semibold text-charcoal-80/55">{t("pricing.currency")}</span>
                              </div>
                              {tier.saveLabel && (
                                <span className="mt-2 inline-block rounded-full bg-violet-pale/80 px-2.5 py-0.5 text-[10px] font-semibold !text-violet">
                                  {tier.saveLabel}
                                </span>
                              )}
                            </div>

                            {/* Check / X column · aligned with feature rows */}
                            <ul className="mt-7 flex flex-col">
                              {tier.includes.map((included, i) => (
                                <li
                                  key={i}
                                  className="flex min-h-[44px] items-center justify-center border-t border-charcoal-80/8 first:border-t-0"
                                  aria-label={`${audience.features[i]}: ${included ? "included" : "not included"}`}
                                >
                                  {included ? (
                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet !text-white shadow-sm">
                                      <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                                    </span>
                                  ) : (
                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-charcoal-80/8 text-charcoal-80/40">
                                      <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>

                            <div className="mt-6 pt-5">
                              <Link
                                to={`/checkout/service?audience=${pricingAudience}&tier=${tierKey}`}
                                className={`group flex items-center justify-center gap-1.5 rounded-full px-4 py-3 text-[12.5px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 sm:text-[13px] ${
                                  tier.popular
                                    ? "bg-violet !text-white shadow-[0_10px_28px_rgba(93,63,211,0.30)] hover:-translate-y-0.5 hover:bg-violet-deep"
                                    : "bg-violet-pale !text-violet hover:bg-violet hover:!text-white"
                                }`}
                              >
                                {tier.cta}
                                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                              </Link>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Mobile · stacked tier cards with embedded feature lists */}
                    <div className="mt-8 flex flex-col gap-4 lg:hidden">
                      {tierKeys.map((tierKey) => {
                        const tier = audience.tiers[tierKey]
                        const includedFeatures = audience.features.filter((_, i) => tier.includes[i])
                        const excludedCount = tier.includes.filter((v) => !v).length
                        return (
                          <div
                            key={tierKey}
                            className={`relative rounded-2xl bg-white p-6 ${
                              tier.popular
                                ? "border-2 border-violet shadow-[0_22px_60px_rgba(93,63,211,0.18)]"
                                : "border border-charcoal-80/10 shadow-[0_8px_24px_rgba(93,63,211,0.05)]"
                            }`}
                          >
                            {tier.popular && (
                              <span className="absolute -top-3 left-5 rounded-full bg-violet px-3 py-1 text-[9.5px] font-bold uppercase tracking-[0.14em] !text-white shadow-md">{t("detail.mostPopular")}</span>
                            )}

                            <div className="flex items-baseline justify-between gap-3">
                              <h3 className="text-[16px] font-bold !text-violet">{tier.name}</h3>
                              {tier.saveLabel && (
                                <span className="rounded-full bg-violet-pale/80 px-2.5 py-0.5 text-[10px] font-semibold !text-violet">
                                  {tier.saveLabel}
                                </span>
                              )}
                            </div>

                            <div className="mt-2 flex items-baseline gap-1">
                              <span className="font-mono text-[26px] font-extrabold tabular-nums !text-violet">
                                ${Number(tier.priceMxn).toLocaleString("es-MX")}
                              </span>
                              <span className="text-[11.5px] font-semibold text-charcoal-80/55">MXN</span>
                            </div>

                            <ul className="mt-5 flex flex-col gap-2.5">
                              {includedFeatures.map((f, i) => (
                                <li key={i} className="flex items-start gap-2.5">
                                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-violet !text-white">
                                    <Check className="h-2.5 w-2.5" strokeWidth={3.5} aria-hidden="true" />
                                  </span>
                                  <span className="text-[12.5px] leading-snug text-charcoal-80/85">{f}</span>
                                </li>
                              ))}
                            </ul>

                            {excludedCount > 0 && (
                              <p className="mt-3 text-[11px] italic text-charcoal-80/50">
                                + {excludedCount} more in higher tiers
                              </p>
                            )}

                            <Link
                              to={`/checkout/service?audience=${pricingAudience}&tier=${tierKey}`}
                              className={`mt-6 flex items-center justify-center gap-1.5 rounded-full px-4 py-3 text-[13px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 ${
                                tier.popular
                                  ? "bg-violet !text-white shadow-[0_10px_28px_rgba(93,63,211,0.30)] hover:bg-violet-deep"
                                  : "bg-violet-pale !text-violet hover:bg-violet hover:!text-white"
                              }`}
                            >
                              {tier.cta}
                              <ArrowRight className="h-4 w-4" aria-hidden="true" />
                            </Link>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )
              })()}
            </motion.div>
          </AnimatePresence>

          {/* Decision-support band — primary CTA is the interactive
              self-audit at /self-audit (a React shell that iframes the
              static /diagnostic document and forwards every audit event
              to analytics so the business can see which gaps visitors
              are surfacing and which services they're matched to).
              The PDF catalog stays as a secondary reference download. */}
          <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl border border-violet/15 bg-white p-6 text-center shadow-[0_8px_24px_rgba(93,63,211,0.05)] sm:flex-row sm:justify-between sm:gap-6 sm:p-7 sm:text-left">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-violet/10 text-violet sm:h-14 sm:w-14">
                <ClipboardCheck className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-[15px] font-bold !text-violet sm:text-[17px]">
                  {t("pricing.selfAudit.title", "Not sure which plan fits?")}
                </h3>
                <p className="mt-1 text-[12.5px] leading-5 text-charcoal-80/70 sm:text-[13px]">
                  {t("pricing.selfAudit.subtitle", "Take the 15-minute self-audit and walk away with a prioritized shortlist drawn from our")} <span className="font-mono tabular-nums !text-violet">{CATALOG_STATS.totalServices}</span> {t("pricing.selfAudit.subtitleSuffix", "atomic services.")}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:gap-2">
              <Link
                to="/self-audit"
                aria-label={t("pricing.selfAudit.ctaAria", "Open the digital and technology self-audit (15 minutes)")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet px-5 py-3 text-[12.5px] font-semibold !text-white shadow-[0_8px_22px_rgba(93,63,211,0.20)] transition hover:-translate-y-0.5 sm:text-[13px]"
              >
                <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                {t("pricing.selfAudit.cta", "Take the self-audit")}
              </Link>
              <a
                href="/documents/Mustapha-Ukizuru-Service-Catalog-v1.0.pdf"
                download
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet/30 bg-white px-5 py-3 text-[12.5px] font-semibold !text-violet transition hover:bg-violet-pale/40 sm:text-[13px]"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                {t("pricing.catalog.pdfLabel")}
              </a>
            </div>
          </div>
        </Container>
      </section>

            {/* ╔════════════════════════════════════════════════════════════════
           § 08 · FAQs · Compact 2-col · sticky controls + accordion
           ════════════════════════════════════════════════════════════════ */}
      <section className="py-14 sm:py-16 lg:py-20">
        <Container>
          <SectionHeader
            eyebrow={t("faq.eyebrow")}
            title={t("faq.title")}
            subtitle={t("faq.subtitle")}
          />

          <div className="grid gap-6 lg:grid-cols-[300px_1fr] lg:gap-10">
            {/* LEFT · sticky controls (search + chip row) */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-xl border border-charcoal-80/10 bg-white p-5 shadow-[0_12px_40px_rgba(93,63,211,0.06)]">
                {/* Search */}
                <label className="relative block">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-80/40" aria-hidden="true" />
                  <input
                    type="search"
                    value={faqQuery}
                    onChange={(e) => setFaqQuery(e.target.value)}
                    placeholder={t("faq.searchPlaceholder")}
                    className="w-full rounded-lg border border-charcoal-80/15 bg-white py-2.5 pl-10 pr-4 text-[13px] text-charcoal-80 placeholder:text-charcoal-80/40 transition focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/20 sm:text-[14px]"
                    aria-label={t("faq.searchAria")}
                  />
                </label>

                {/* Horizontal chip row */}
                {FAQ_CATEGORIES.length > 1 && (
                  <div className="mt-4 border-t border-charcoal-80/10 pt-4">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-charcoal-80/55">
                      {t("faq.filterByTopic")}
                    </p>
                    <div className="flex flex-col items-start gap-1.5" role="tablist" aria-label={t("faq.filterAria")}>
                      {FAQ_CATEGORIES.map((cat) => {
                        const active = faqCategory === cat
                        return (
                          <button
                            key={cat}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => setFaqCategory(cat)}
                            className={`rounded-full px-3 py-1 text-[11.5px] font-semibold transition ${
                              active
                                ? "bg-violet !text-white shadow-sm"
                                : "bg-violet-pale/60 !text-violet hover:bg-violet-pale"
                            }`}
                          >
                            {cat}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <p className="mt-4 border-t border-charcoal-80/10 pt-4 text-[10.5px] uppercase tracking-[0.18em] text-charcoal-80/50">
                  {t("faq.countFormat", { count: filteredFAQs.length, total: SERVICES_FAQ_ITEMS.length })}
                </p>
              </div>
            </aside>

            {/* RIGHT · accordion */}
            <div className="overflow-hidden rounded-xl border border-charcoal-80/10 bg-white shadow-[0_12px_40px_rgba(93,63,211,0.06)]">
              {filteredFAQs.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                  <SearchX className="h-8 w-8 text-charcoal-80/30" aria-hidden="true" />
                  <p className="text-[13px] font-semibold text-charcoal-80">{t("faq.emptyTitle")}</p>
                  <p className="text-[11.5px] text-charcoal-80/60">{t("faq.emptyBody")}</p>
                  <button
                    type="button"
                    onClick={() => { setFaqQuery(""); setFaqCategory("All") }}
                    className="mt-2 rounded-full bg-violet-pale px-3 py-1 text-[11.5px] font-semibold !text-violet transition hover:bg-violet hover:!text-white"
                  >
                    {t("faq.emptyReset")}
                  </button>
                </div>
              ) : (
                filteredFAQs.map((faq, idx) => {
                  const isOpen = openFAQ === faq.id
                  return (
                    <div
                      key={faq.id}
                      className={idx > 0 ? "border-t border-charcoal-80/10" : ""}
                    >
                      <button
                        ref={(el) => { faqRefs.current[faq.id] = el }}
                        type="button"
                        onClick={() => setOpenFAQ(isOpen ? null : faq.id)}
                        onKeyDown={(e) => handleFAQKeyNav(e, faq.id)}
                        aria-expanded={isOpen}
                        aria-controls={`faq-panel-${faq.id}`}
                        id={`faq-trigger-${faq.id}`}
                        className={`flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition hover:bg-violet-pale/30 focus:bg-violet-pale/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet/30 sm:px-6 sm:py-5 ${isOpen ? "bg-violet-pale/20" : ""}`}
                      >
                        <span className="flex-1">
                          {faq.category && (
                            <span className="mb-1 inline-block text-[10px] font-semibold uppercase tracking-[0.18em] text-violet/70">
                              {faq.category}
                            </span>
                          )}
                          <span className={`block text-[13px] font-semibold leading-snug sm:text-[14.5px] ${isOpen ? "!text-violet" : "text-charcoal-80"}`}>
                            {faq.question}
                          </span>
                        </span>
                        <span
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition ${
                            isOpen ? "bg-violet !text-white" : "bg-violet-pale !text-violet"
                          }`}
                          aria-hidden="true"
                        >
                          {isOpen ? <Minus className="h-3.5 w-3.5" strokeWidth={2.5} /> : <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />}
                        </span>
                      </button>

                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            key="content"
                            id={`faq-panel-${faq.id}`}
                            role="region"
                            aria-labelledby={`faq-trigger-${faq.id}`}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ height: { duration: 0.28, ease: "easeOut" }, opacity: { duration: 0.18 } }}
                            className="overflow-hidden"
                          >
                            <div className="px-5 pb-5 pt-1 text-[12.5px] leading-7 text-charcoal-80/80 sm:px-6 sm:text-[14px]">
                              {faq.answer}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Full-width CTA bar, Still have questions? */}
          <div className="mt-8 flex flex-col items-start gap-4 rounded-2xl border border-violet/20 bg-gradient-to-r from-violet-pale/60 via-violet-pale/40 to-violet-pale/60 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6 lg:p-7">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet !text-white sm:h-12 sm:w-12">
              <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-bold !text-violet sm:text-[16px]">{t("faq.stillHaveQuestions")}</p>
              <p className="mt-0.5 text-[12px] text-charcoal-80/70 sm:text-[13px]">
                {t("faq.stillHaveBody")}
              </p>
            </div>
            <Link
              to="/book"
              className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet px-5 py-3 text-[13px] font-semibold !text-white shadow-[0_10px_28px_rgba(93,63,211,0.25)] transition hover:-translate-y-0.5 hover:bg-violet-deep focus:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 sm:text-[14px]"
            >
              <Calendar className="h-4 w-4" aria-hidden="true" />
              {t("faq.bookConsult")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
        </Container>
      </section>

            {/* ╔════════════════════════════════════════════════════════════════
           § 09 · FINAL CTA · Clear directive
           ════════════════════════════════════════════════════════════════ */}
      <section className="pb-14 sm:pb-20 lg:pb-24">
        <Container>
          <div className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-violet via-violet-deep to-charcoal-80">
            <Meteors number={14} />
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-terracotta/15 blur-3xl sm:h-[280px] sm:w-[280px]" aria-hidden="true" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-52 w-52 rounded-full bg-azure/15 blur-3xl sm:h-[220px] sm:w-[220px]" aria-hidden="true" />

            <div className="relative grid items-center gap-8 px-6 py-12 sm:gap-10 sm:px-10 sm:py-14 lg:grid-cols-[1fr_auto] lg:gap-14 lg:px-14 lg:py-16">
              <div className="flex flex-col items-start gap-4 sm:gap-5">
                <EyebrowChip tone="white">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  {t("finalCta.eyebrow")}
                </EyebrowChip>
                <h2 className="text-[22px] font-bold leading-tight !text-white sm:text-[30px] md:text-[38px]">
                  {t("finalCta.titlePart1")}{" "}
                  <span className="!text-terracotta">{t("finalCta.titlePart2")}</span>
                </h2>
                <p className="max-w-xl text-[13.5px] leading-7 !text-white/75 sm:text-[15px]">
                  {t("finalCta.body")}
                </p>
                <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <MagneticButton className="w-full sm:w-auto">
                    <Link
                      to="/book"
                      className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-[13.5px] font-semibold !text-violet shadow-[0_12px_28px_rgba(255,255,255,0.15)] transition hover:-translate-y-0.5 sm:w-auto sm:px-7 sm:py-3.5 sm:text-[14.5px]"
                    >
                      <Calendar className="h-4 w-4" aria-hidden="true" />
                      {t("finalCta.ctaPrimary")}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </Link>
                  </MagneticButton>
                  <MagneticButton className="w-full sm:w-auto">
                    <Link
                      to="/solutions"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-white/30 bg-transparent px-6 py-3 text-[13.5px] font-semibold !text-white transition hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/10 sm:w-auto sm:px-7 sm:py-3.5 sm:text-[14.5px]"
                    >
                      {t("finalCta.ctaSecondary")}
                    </Link>
                  </MagneticButton>
                </div>
              </div>

              <div className="hidden lg:grid grid-cols-2 gap-4">
                {[
                  { value: "8+",  labelKey: "yearsExperience", Icon: Trophy },
                  { value: "82",  labelKey: "catalogServices", Icon: Layers },
                  { value: "4",   labelKey: "countriesServed", Icon: Globe },
                  { value: "24h", labelKey: "avgResponse",     Icon: Zap },
                ].map(({ value, labelKey, Icon }) => (
                  <div key={labelKey} className="rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur">
                    <Icon className="h-4 w-4 text-terracotta" aria-hidden="true" />
                    <div className="mt-2 font-mono text-[26px] font-extrabold tabular-nums !text-white sm:text-[30px]">{value}</div>
                    <div className="text-[11px] font-medium !text-white/55">{t(`finalCta.stats.${labelKey}`)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  )
}
