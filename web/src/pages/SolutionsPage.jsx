/* ════════════════════════════════════════════════════════════════════════
   SolutionsPage.jsx · v8 · Industry-standard 8-section solutions page
   ────────────────────────────────────────────────────────────────────────
   Strict structure (per outcome-focused solutions-page convention):

     § 01 · Empathy Hero ··········· Outcome-focused headline
     § 02 · Pain Points ············ Call out the challenges
     § 03 · Solution Overview ······ How offerings address them
     § 04 · Segmented Solutions ···· By 3 audiences (EDU / SMB / IND) → 8 packages
     § 05 · Measurable Benefits ···· ROI-focused metrics
     § 06 · Case Studies ··········· Real-world proof
     § 07 · Implementation/Integration How it fits into the existing stack
     § 08 · Outcome-Driven CTA ····· "Get Your Custom Plan"

   Solutions page focuses on OUTCOMES, not capabilities (Services page does that).
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { Link } from "react-router-dom"
import {
  Sparkles, ArrowRight, Check, Star, Zap,
  TrendingUp, Clock, ShieldCheck, Award, Globe2,
  Users, Briefcase, GraduationCap, MessageCircle,
  AlertCircle, Activity, Database, Workflow,
} from "lucide-react"
import Seo from "../components/seo/Seo"
import SolutionsHero from "../components/heroes/SolutionsHero"
import { pageSeo } from "../seo/pageSeo"
import {
  SOLUTION_PACKAGES, SOLUTION_PLANS,
  RECENTLY_SHIPPED,
} from "../data/solutionsCatalogue"
import { AUDIENCE_LABELS } from "../data/servicesCatalogue"
import BentoCell from "../components/motion/BentoCell"
import Reveal    from "../components/motion/Reveal"

/* ── Local helpers ──────────────────────────────────────────────────────── */
const formatUsd = (n) => `$${Number(n).toLocaleString("en-US")}`
const formatShipMonth = (iso) =>
  new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(new Date(iso))

/* ── Motion variants ─────────────────────────────────────────────────────── */
const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } }
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } }

/* ── UI atoms ───────────────────────────────────────────────────────────── */
function Container({ children, className = "" }) {
  return <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
}

function EyebrowChip({ children, tone = "violet" }) {
  const tones = {
    violet: "bg-violet-pale text-violet",
    white: "bg-white/10 ring-1 ring-white/15 !text-terracotta",
    mint: "bg-mint/15 text-mint",
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

/* ── Audience segments configuration ────────────────────────────────────── */
const AUDIENCE_SEGMENTS = [
  { code: "EDU", label: "Schools & Education", short: "Schools", Icon: GraduationCap, accent: "mint", priority: "Primary" },
  { code: "SMB", label: "SMEs & Businesses", short: "Businesses", Icon: Briefcase, accent: "azure", priority: "Inbound" },
  { code: "IND", label: "Individuals & Pros", short: "Individuals", Icon: Users, accent: "terracotta", priority: "Secondary" },
]

const segmentMatch = (pkgAudience, code) => String(pkgAudience || "").split(",").includes(code)


/* ── Before & After illustration · self-contained inline SVG ────────────── */
function BeforeAfterIllustration({ reduce }) {
  const { t } = useTranslation("solutions")
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto w-full max-w-[680px] lg:max-w-none"
      role="img"
      aria-label={t("beforeAfter.compareAria")}
    >
      <motion.div
        animate={reduce ? undefined : { y: [0, -6, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg viewBox="0 0 580 480" className="block h-auto w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="ba-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="6" stdDeviation="9" floodOpacity="0.10" />
            </filter>
          </defs>

          {/* Curved arrow · Before → After */}
          <path d="M210 280 C 250 240, 285 215, 270 165" stroke="#1f2937" strokeWidth="1.6" fill="none" strokeDasharray="4 4" strokeLinecap="round" />
          <polygon points="262,168 274,158 276,172" fill="#1f2937" />

          {/* "Before" label + curl arrow */}
          <g transform="translate(56, 90)">
            <text x="0" y="0" fontFamily="'Caveat','Brush Script MT',cursive" fontSize="24" fontWeight="700" fill="#1f2937">Before</text>
            <path d="M30 12 C 38 30, 28 48, 18 56" stroke="#1f2937" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            <polygon points="14,52 22,50 18,62" fill="#1f2937" />
          </g>

          {/* PHONE wireframe · Before */}
          <g transform="translate(50, 152)" filter="url(#ba-shadow)">
            <rect x="0" y="0" width="150" height="252" rx="22" fill="white" stroke="#1f2937" strokeWidth="1.5" strokeDasharray="5 4" />
            <rect x="62" y="14" width="26" height="3.5" rx="1.5" fill="#1f2937" />
            <rect x="9" y="32" width="132" height="208" rx="9" fill="#fafafa" />
            <text x="75" y="56" fontFamily="'Caveat',cursive" fontSize="9.5" fill="#9ca3af" textAnchor="middle">your old site</text>
            <line x1="22" y1="74" x2="128" y2="74" stroke="#9ca3af" strokeWidth="0.7" strokeDasharray="2 2" />
            <line x1="22" y1="86" x2="108" y2="86" stroke="#9ca3af" strokeWidth="0.7" strokeDasharray="2 2" />
            <text x="75" y="130" fontFamily="'Caveat','Brush Script MT',cursive" fontSize="17" fontWeight="700" fill="#1f2937" textAnchor="middle">boring</text>
            <text x="75" y="150" fontFamily="'Caveat','Brush Script MT',cursive" fontSize="17" fontWeight="700" fill="#1f2937" textAnchor="middle">{t("beforeAfter.plainPage")}</text>
            <line x1="22" y1="172" x2="128" y2="172" stroke="#d1d5db" strokeWidth="0.6" />
            <text x="75" y="190" fontFamily="'Caveat',cursive" fontSize="9" fill="#9ca3af" textAnchor="middle">no design system</text>
            <rect x="40" y="208" width="70" height="20" rx="4" fill="none" stroke="#9ca3af" strokeWidth="0.8" />
            <text x="75" y="221" fontFamily="sans-serif" fontSize="7" fill="#9ca3af" textAnchor="middle" fontWeight="700">CONTINUE</text>
          </g>

          {/* "After" label + curl arrow */}
          <g transform="translate(380, 56)">
            <text x="0" y="0" fontFamily="'Caveat','Brush Script MT',cursive" fontSize="24" fontWeight="700" fill="#1f2937">After</text>
            <path d="M28 12 C 22 26, 30 40, 22 50" stroke="#1f2937" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            <polygon points="18,46 26,46 22,58" fill="#1f2937" />
          </g>

          {/* AFTER stack · 3 panels */}
          <g transform="translate(238, 76)">
            {/* Top panel · olive header mockup */}
            <g filter="url(#ba-shadow)">
              <rect x="0" y="0" width="290" height="84" rx="13" fill="#cfd966" />
              <circle cx="14" cy="14" r="3.6" fill="white" opacity="0.75" />
              <circle cx="26" cy="14" r="3.6" fill="white" opacity="0.75" />
              <circle cx="38" cy="14" r="3.6" fill="white" opacity="0.75" />
              <rect x="60" y="9" width="200" height="12" rx="6" fill="white" opacity="0.55" />
              <text x="160" y="19" fontFamily="sans-serif" fontSize="7" fill="#445214" textAnchor="middle" fontStyle="italic">your unique brand</text>
              <text x="14" y="50" fontFamily="sans-serif" fontSize="11" fontWeight="800" fill="#445214">YOURNAME.COM</text>
              <text x="125" y="50" fontFamily="sans-serif" fontSize="7" fontWeight="700" fill="#445214">HOME</text>
              <text x="155" y="50" fontFamily="sans-serif" fontSize="7" fontWeight="700" fill="#445214">SOLUTIONS</text>
              <text x="206" y="50" fontFamily="sans-serif" fontSize="7" fontWeight="700" fill="#445214">SERVICES</text>
              <text x="250" y="50" fontFamily="sans-serif" fontSize="7" fontWeight="700" fill="#445214">CONTACT</text>
              <line x1="14" y1="58" x2="276" y2="58" stroke="#445214" strokeWidth="0.8" opacity="0.25" />
              <text x="14" y="72" fontFamily="sans-serif" fontSize="6.5" fill="#445214" opacity="0.7">{t("beforeAfter.yourBrand")}</text>
            </g>

            {/* Middle panel · mint with promo chip */}
            <g transform="translate(0, 96)" filter="url(#ba-shadow)">
              <rect x="0" y="0" width="290" height="100" rx="13" fill="#82d96a" />
              <text x="14" y="32" fontFamily="sans-serif" fontSize="11" fontWeight="800" fill="#1f3508">YOU HAVE</text>
              <text x="14" y="54" fontFamily="sans-serif" fontSize="14" fontWeight="800" fill="#1f3508">NEW LEADS &amp; SIGNUPS</text>
              <text x="14" y="76" fontFamily="sans-serif" fontSize="8" fill="#1f3508" opacity="0.7">{t("beforeAfter.yourFunnel")}</text>
              <rect x="167" y="38" width="108" height="32" rx="16" fill="#fed978" />
              <text x="221" y="58" textAnchor="middle" fontFamily="sans-serif" fontSize="11" fontWeight="800" fill="#5a4506">CODE-2026</text>
              <path d="M276 36 q4 -3 8 0" stroke="#1f2937" strokeWidth="1.2" fill="none" />
            </g>

            {/* Bottom panel · violet with 3 product/service tiles */}
            <g transform="translate(0, 208)" filter="url(#ba-shadow)">
              <rect x="0" y="0" width="290" height="138" rx="13" fill="#b8a4dd" />
              <text x="14" y="22" fontFamily="sans-serif" fontSize="9" fontWeight="800" fill="#3c2b62">SUGGESTED · OUTCOMES YOU&apos;LL LOVE</text>
              <g transform="translate(14, 32)">
                <g>
                  <rect x="0" y="0" width="80" height="92" rx="9" fill="#f5b08e" />
                  <rect x="6" y="60" width="68" height="26" rx="6" fill="white" opacity="0.85" />
                  <text x="40" y="76" fontFamily="sans-serif" fontSize="6.5" fontWeight="800" fill="#3c2b62" textAnchor="middle">VIEW SOLUTION</text>
                </g>
                <g transform="translate(90, 0)">
                  <rect x="0" y="0" width="80" height="92" rx="9" fill="#ee8273" />
                  <rect x="6" y="60" width="68" height="26" rx="6" fill="white" opacity="0.85" />
                  <text x="40" y="76" fontFamily="sans-serif" fontSize="6.5" fontWeight="800" fill="#3c2b62" textAnchor="middle">VIEW SOLUTION</text>
                </g>
                <g transform="translate(180, 0)">
                  <rect x="0" y="0" width="80" height="92" rx="9" fill="#3a3a3a" />
                  <rect x="6" y="60" width="68" height="26" rx="6" fill="white" opacity="0.85" />
                  <text x="40" y="76" fontFamily="sans-serif" fontSize="6.5" fontWeight="800" fill="#3c2b62" textAnchor="middle">VIEW SOLUTION</text>
                </g>
              </g>
            </g>
          </g>

          {/* Doodles */}
          <g fill="#1f2937" stroke="none">
            <path d="M212 102 l3 -8 l3 8 l8 0 l-6 5 l3 8 l-8 -5 l-8 5 l3 -8 l-6 -5 z" />
            <path d="M520 60 l3 -8 l3 8 l8 0 l-6 5 l3 8 l-8 -5 l-8 5 l3 -8 l-6 -5 z" />
            <path d="M30 405 l2 -6 l2 6 l6 0 l-5 4 l2 6 l-5 -4 l-5 4 l2 -6 l-5 -4 z" opacity="0.7" />
          </g>
          <g stroke="#1f2937" strokeWidth="1.3" fill="none" strokeLinecap="round">
            <path d="M158 70 q12 -4 24 4" />
            <path d="M340 280 q14 6 26 0" />
            <g transform="translate(548 256)">
              <circle r="11" fill="white" stroke="#1f2937" strokeWidth="1.4" />
              <path d="M-5 0 L-1 4 L5 -4" strokeWidth="1.8" />
            </g>
            <g transform="translate(155 412)">
              <path d="M0 0 c -5 -6 -5 -14 0 -18 c 5 -4 10 0 10 5 c 0 -5 5 -9 10 -5 c 5 4 5 12 0 18 z" fill="#ee8273" stroke="#1f2937" strokeWidth="1.2" />
            </g>
            <g transform="translate(160 88)">
              <rect x="0" y="0" width="16" height="11" rx="1" fill="white" stroke="#1f2937" strokeWidth="1" />
              <path d="M0 0 L8 7 L16 0" />
            </g>
            <path d="M30 200 q -6 -2 -8 -8" />
            <path d="M22 196 l 0 -6 m 0 6 l -6 -2" />
          </g>
        </svg>
      </motion.div>
    </motion.div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   PackagesBento · Phase 10 · audience-filtered hover-expand bento grid

   Three audience tabs (EDU / SMB / IND) switch the visible packages with
   a layout transition. The first package in each set takes a 2-column
   span on lg+ so the grid reads as a real bento (asymmetric) rather than
   a uniform grid. Tones cycle through brand v3.1 status tints — violet
   for the lead tile, then azure / mint / amber / rose / slate.

   The grid uses `<AnimatePresence mode="popLayout">` so audience switches
   feel intentional (old tiles fade + lift out, new tiles drop in).
   ════════════════════════════════════════════════════════════════════════ */
const AUDIENCE_TONES = ["violet", "azure", "mint", "amber", "rose", "slate"]

function PackagesBento({ activeAudience, onAudienceChange, segmented }) {
  const { t } = useTranslation("solutions")
  const reduce = useReducedMotion()

  // Resolve audience labels — fall back to the AUDIENCE_LABELS `.label`
  // string when the i18n key isn't set yet, then to a hardcoded string
  // as a last resort. The pre-fix code used `AUDIENCE_LABELS?.EDU`
  // unindexed, which is the full {code,label,tone,priority} OBJECT —
  // i18next then handed that object back as the resolved value, and
  // rendering `{aud.label}` blew up with "Objects are not valid as a
  // React child (found: object with keys {code, label, tone, priority})".
  const audiences = [
    { code: "EDU", label: t("audiences.edu", { defaultValue: AUDIENCE_LABELS?.EDU?.label || "Schools" }) },
    { code: "SMB", label: t("audiences.smb", { defaultValue: AUDIENCE_LABELS?.SMB?.label || "SMBs & Startups" }) },
    { code: "IND", label: t("audiences.ind", { defaultValue: AUDIENCE_LABELS?.IND?.label || "Individuals" }) },
  ]

  return (
    <section
      aria-labelledby="packages-bento-title"
      className="py-14 sm:py-16 lg:py-20"
    >
      <Container>
        <Reveal>
          <div className="mx-auto mb-8 flex max-w-3xl flex-col items-center gap-3 text-center sm:mb-10">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-violet">
              {t("packages.eyebrow", { defaultValue: "Solution packages" })}
            </span>
            <h2
              id="packages-bento-title"
              className="text-[clamp(24px,3vw,38px)] font-bold tracking-tight text-violet text-balance"
            >
              {t("packages.title", { defaultValue: "Outcomes by audience — pick what fits" })}
            </h2>
            <p className="max-w-xl text-[15px] leading-relaxed text-charcoal-80/70">
              {t("packages.subtitle", {
                defaultValue: "Tap an audience to surface the engagements built for it. Every package is scoped, priced, and outcome-anchored.",
              })}
            </p>
          </div>
        </Reveal>

        {/* Audience toggle */}
        <Reveal>
          <div
            role="tablist"
            aria-label={t("packages.tablistAria", { defaultValue: "Audience filter" })}
            className="mx-auto mb-8 flex w-fit gap-1 rounded-full bg-slate-100 p-1 sm:mb-10"
          >
            {audiences.map((aud) => {
              const active = activeAudience === aud.code
              return (
                <button
                  key={aud.code}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onAudienceChange(aud.code)}
                  className={`relative rounded-full px-4 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet/30 ${
                    active ? "text-white" : "text-charcoal-80/70 hover:text-charcoal"
                  }`}
                >
                  {active && !reduce && (
                    <motion.span
                      layoutId="packages-bento-tab-pill"
                      className="absolute inset-0 rounded-full bg-violet shadow-[0_4px_14px_rgba(93,63,211,0.25)]"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  {active && reduce && (
                    <span className="absolute inset-0 rounded-full bg-violet" />
                  )}
                  <span className="relative z-10">{aud.label}</span>
                </button>
              )
            })}
          </div>
        </Reveal>

        {/* Bento grid */}
        <AnimatePresence mode="popLayout">
          <motion.div
            key={activeAudience}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[minmax(180px,auto)]"
          >
            {segmented.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-[14px] text-charcoal-80/60">
                {t("packages.empty", {
                  defaultValue: "No packages yet for this audience — check back soon.",
                })}
              </div>
            )}
            {segmented.map((pkg, idx) => {
              const tone = AUDIENCE_TONES[idx % AUDIENCE_TONES.length]
              // First tile spans 2 cols on lg+ to create a proper bento
              // asymmetry; remaining tiles are 1x1.
              const span = idx === 0 ? "lg:col-span-2 lg:row-span-2" : ""
              return (
                <BentoCell
                  key={pkg.id || pkg.slug}
                  to={`/services/${pkg.slug}`}
                  eyebrow={pkg.audience.split(",").join(" · ")}
                  title={pkg.name}
                  description={pkg.tagline}
                  tone={tone}
                  span={span}
                />
              )
            })}
          </motion.div>
        </AnimatePresence>
      </Container>
    </section>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   PAGE
   ════════════════════════════════════════════════════════════════════════ */
export default function SolutionsPage() {
  const { t } = useTranslation("solutions")
  const reduce = useReducedMotion()
  const [activeAudience, setActiveAudience] = useState("EDU")

  const segmented = SOLUTION_PACKAGES.filter((p) => segmentMatch(p.audience, activeAudience))

  return (
    <>
      <Seo {...(pageSeo.SolutionsPage || pageSeo.solutions || {})} />

      {/* ╔════════════════════════════════════════════════════════════════
           § 01 · HERO · doodle illustration · audience-fanned cards
           ════════════════════════════════════════════════════════════════ */}
      <SolutionsHero />

      {/* ╔════════════════════════════════════════════════════════════════
           § 01b · PACKAGES BENTO · Phase 10 · audience-filtered hover-
           expand grid that surfaces the SOLUTION_PACKAGES catalogue.
           Previously declared but never rendered — moved into view so
           visitors can see concrete offerings immediately after the hero
           instead of three sections later.
           ════════════════════════════════════════════════════════════════ */}
      <PackagesBento
        activeAudience={activeAudience}
        onAudienceChange={setActiveAudience}
        segmented={segmented}
      />

            {/* ╔════════════════════════════════════════════════════════════════
           § 02 · PAIN POINT IDENTIFICATION · "are you struggling with..."
           ════════════════════════════════════════════════════════════════ */}
      <section className="py-14 sm:py-16 lg:py-20">
        <Container>
          <SectionHeader
            eyebrow={t("pain.eyebrow")}
            title={t("pain.title")}
            subtitle={t("pain.subtitle")}
          />

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-4"
          >
            {[
              { keyId: "schoolTechHeldTogether", Icon: AlertCircle },
              { keyId: "shipMvpBeforeSeed",      Icon: Zap },
              { keyId: "facultyAiNoPolicy",      Icon: ShieldCheck },
              { keyId: "onlyOneWhoKnows",        Icon: AlertCircle },
              { keyId: "websiteDoesntReflect",   Icon: Sparkles },
              { keyId: "aiToolsLooseInOrg",      Icon: ShieldCheck },
              { keyId: "saasNobodyUses",         Icon: Database },
              { keyId: "reportsTakeDays",        Icon: Clock },
            ].map((p) => (
              <motion.div
                key={p.keyId}
                variants={fadeUp}
                className="flex h-full flex-col rounded-2xl border border-charcoal-80/10 bg-white p-5 shadow-[0_6px_20px_rgba(93,63,211,0.05)] transition hover:-translate-y-0.5 sm:p-6"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-terracotta/15 text-terracotta-deep">
                  <p.Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="mt-4 flex-1 text-[14px] font-semibold leading-snug !text-violet sm:text-[15px]">
                  &ldquo;{t(`pain.items.${p.keyId}.quote`)}&rdquo;
                </p>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-charcoal-80/55 sm:text-[11.5px]">
                  {t(`pain.items.${p.keyId}.audience`)}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </Container>
      </section>

      {/* ╔════════════════════════════════════════════════════════════════
           § 03 · SOLUTION OVERVIEW · how offerings address those challenges
           ════════════════════════════════════════════════════════════════ */}
      <section className="bg-mist py-14 sm:py-16 lg:py-20">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <EyebrowChip>{t("approach.eyebrow")}</EyebrowChip>
            <h2 className="mt-3 text-[24px] font-bold tracking-tight !text-violet sm:text-[32px] md:text-[38px]">
              {t("approach.title")}
            </h2>
            <p className="mt-4 text-[13.5px] leading-7 text-charcoal-80/75 sm:text-[15.5px]">
              {t("approach.subtitle")}
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3 sm:gap-5">
              {[
                { Icon: Workflow, keyId: "composed" },
                { Icon: Clock,    keyId: "timelined" },
                { Icon: Activity, keyId: "outcomeLed" },
              ].map(({ Icon, keyId }) => (
                <div key={keyId} className="rounded-2xl border border-charcoal-80/10 bg-white p-5 text-left shadow-[0_4px_14px_rgba(93,63,211,0.04)]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet/10 text-violet">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-3 text-[14px] font-bold !text-violet sm:text-[15px]">{t(`approach.pillars.${keyId}.title`)}</h3>
                  <p className="mt-1 text-[12px] leading-5 text-charcoal-80/70 sm:text-[12.5px]">{t(`approach.pillars.${keyId}.desc`)}</p>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* ╔════════════════════════════════════════════════════════════════
           § 04 · BEFORE & AFTER · transformation showcase
           ════════════════════════════════════════════════════════════════ */}
      <section id="before-after" className="scroll-mt-12 bg-mist py-16 sm:py-20 lg:py-24">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.3fr] lg:gap-12 xl:gap-16">

            {/* LEFT · empathy heading + body + CTAs */}
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              variants={stagger}
              className="max-w-xl"
            >
              <motion.div variants={fadeUp} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-charcoal-80/80 ring-1 ring-charcoal-80/10 shadow-[0_4px_14px_rgba(93,63,211,0.04)]">
                <Sparkles className="h-3 w-3 text-mint" aria-hidden="true" />
                {t("beforeAfter.badge")}
              </motion.div>

              <motion.h2
                variants={fadeUp}
                className="mt-5 text-[28px] font-bold leading-[1.08] tracking-tight text-charcoal-80 sm:text-[36px] md:text-[42px] lg:text-[48px]"
              >
                {t("beforeAfter.headingLeft")}{" "}
                <span className="!text-violet">{t("beforeAfter.headingMiddle")}</span>{" "}
                {t("beforeAfter.headingRight")}
              </motion.h2>

              <motion.p
                variants={fadeUp}
                className="mt-5 text-[14px] leading-7 text-charcoal-80/70 sm:text-[15px]"
              >
                {t("beforeAfter.body")}
              </motion.p>

              <motion.div variants={fadeUp} className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  to="/contact?intent=proposal"
                  className="group inline-flex items-center justify-center gap-2 rounded-xl bg-violet px-6 py-3.5 text-[13px] font-semibold !text-white shadow-[0_12px_32px_rgba(93,63,211,0.25)] transition hover:-translate-y-0.5 hover:bg-violet-deep focus:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 sm:text-[14px]"
                >
                  {t("beforeAfter.ctaPrimary")}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
                <a
                  href="#segmented-anchor"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-charcoal-80/15 bg-white px-6 py-3.5 text-[13px] font-semibold !text-violet transition hover:bg-violet-pale/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet/30 sm:text-[14px]"
                >
                  {t("beforeAfter.ctaSecondary")}
                </a>
              </motion.div>

              <motion.p
                variants={fadeUp}
                className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-charcoal-80/55"
              >
                <span className="inline-flex items-center gap-1">
                  <Check className="h-3 w-3 text-mint" aria-hidden="true" />
                  {t("beforeAfter.trust1")}
                </span>
                <span aria-hidden="true">&middot;</span>
                <span className="inline-flex items-center gap-1">
                  <Check className="h-3 w-3 text-mint" aria-hidden="true" />
                  {t("beforeAfter.trust2")}
                </span>
                <span aria-hidden="true">&middot;</span>
                <span className="inline-flex items-center gap-1">
                  <Check className="h-3 w-3 text-mint" aria-hidden="true" />
                  {t("beforeAfter.trust3")}
                </span>
              </motion.p>
            </motion.div>

            {/* RIGHT · before/after illustration */}
            <div className="relative flex items-center justify-center">
              <BeforeAfterIllustration reduce={reduce} />
            </div>
          </div>
        </Container>
      </section>

            {/* ╔════════════════════════════════════════════════════════════════
           § 05 · MEASURABLE BENEFITS · ROI metrics
           ════════════════════════════════════════════════════════════════ */}
      <section id="segmented-anchor" className="scroll-mt-12 py-14 sm:py-16 lg:py-20" style={{ backgroundColor: "#1A1B23" }}>
        <Container>
          <SectionHeader
            eyebrow={t("metrics.eyebrow")}
            title={t("metrics.title")}
            subtitle={t("metrics.subtitle")}
            invert
          />

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-4"
          >
            {[
              { value: "−60 %", labelKey: "adminTime",   Icon: Clock },
              { value: "+30 %", labelKey: "leadGrowth",  Icon: TrendingUp },
              { value: "99 %",  labelKey: "uptime",      Icon: ShieldCheck },
              { value: "240ms", labelKey: "apiResponse", Icon: Zap },
            ].map(({ value, labelKey, Icon }) => (
              <motion.div
                key={labelKey}
                variants={fadeUp}
                className="rounded-2xl border border-white/[0.10] bg-white/[0.04] p-5 backdrop-blur-md transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07] sm:p-6"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-terracotta/15 text-terracotta">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="mt-4 font-mono text-[26px] font-bold tabular-nums !text-white sm:text-[32px]">{value}</div>
                <p className="mt-1 text-[11.5px] leading-5 !text-white/65 sm:text-[12.5px]">{t(`metrics.items.${labelKey}`)}</p>
              </motion.div>
            ))}
          </motion.div>
        </Container>
      </section>

      {/* ╔════════════════════════════════════════════════════════════════
           § 06 · SOCIAL PROOF / CASE STUDIES · real-world examples
           ════════════════════════════════════════════════════════════════ */}
      <section className="py-14 sm:py-16 lg:py-20">
        <Container>
          <SectionHeader
            eyebrow={t("shipped.eyebrow")}
            title={t("shipped.title")}
            subtitle={t("shipped.subtitle")}
          />

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="grid gap-5 sm:gap-6 md:grid-cols-3"
          >
            {RECENTLY_SHIPPED.map((rs) => (
              <motion.article
                key={rs.id}
                variants={fadeUp}
                whileHover={{ y: -2 }}
                className="flex h-full flex-col rounded-2xl border border-charcoal-80/10 bg-white p-5 shadow-[0_8px_24px_rgba(93,63,211,0.05)] transition hover:shadow-[0_18px_44px_rgba(93,63,211,0.10)] sm:p-6"
              >
                <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] sm:text-[11px]">
                  <motion.span
                    aria-hidden="true"
                    className="relative inline-flex h-2 w-2 items-center justify-center"
                    animate={rs.isLive && !reduce ? { scale: [1, 1.15, 1] } : undefined}
                    transition={{ duration: 1.6, repeat: rs.isLive && !reduce ? Infinity : 0, ease: "easeInOut" }}
                  >
                    <span className="absolute inline-flex h-full w-full rounded-full bg-mint opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint" />
                  </motion.span>
                  <span className="text-mint">{t("shipped.liveLabel")}</span>
                  <span className="text-charcoal-80/40">·</span>
                  <span className="font-mono tabular-nums text-charcoal-80/55">{formatShipMonth(rs.shippedAt)}</span>
                </div>

                <h3 className="mt-3 text-[14px] font-bold leading-tight !text-violet sm:text-[15.5px]">
                  {rs.clientType}
                </h3>
                <p className="mt-1 text-[12px] !text-violet/80 sm:text-[12.5px]">
                  {rs.solutionLabel}
                </p>
                <p className="mt-3 flex-1 text-[12.5px] leading-5 text-charcoal-80/75 sm:text-[13px]">
                  <span className="font-semibold !text-violet">{t("shipped.outcomePrefix")} </span>
                  {rs.outcome}
                </p>
              </motion.article>
            ))}
          </motion.div>
        </Container>
      </section>

      {/* ╔════════════════════════════════════════════════════════════════
           § 07 · IMPLEMENTATION / INTEGRATION · how it fits
           ════════════════════════════════════════════════════════════════ */}
      <section className="bg-mist py-14 sm:py-16 lg:py-20">
        <Container>
          <SectionHeader
            eyebrow={t("fit.eyebrow")}
            title={t("fit.title")}
            subtitle={t("fit.subtitle")}
          />

          <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
            {[
              {
                Icon: Database,
                pillarKey: "data",
                itemKeys: ["googleM365", "shopifyWoo", "payments", "sisLmsCrm"],
              },
              {
                Icon: Workflow,
                pillarKey: "deploy",
                itemKeys: ["stranglerFig", "parallelRun", "cutoverPlan", "rollback"],
              },
              {
                Icon: ShieldCheck,
                pillarKey: "deliverables",
                itemKeys: ["adrs", "runbooks", "training", "support30"],
              },
            ].map(({ Icon, pillarKey, itemKeys }) => (
              <motion.div
                key={pillarKey}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="flex h-full flex-col rounded-2xl border border-charcoal-80/10 bg-white p-5 shadow-[0_6px_20px_rgba(93,63,211,0.05)] sm:p-6"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet/10 text-violet">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-[15px] font-bold !text-violet sm:text-[16.5px]">{t(`fit.pillars.${pillarKey}.title`)}</h3>
                <p className="mt-2 text-[12.5px] leading-5 text-charcoal-80/70 sm:text-[13px]">{t(`fit.pillars.${pillarKey}.desc`)}</p>
                <ul className="mt-4 flex flex-col gap-1.5 border-t border-charcoal-80/8 pt-3">
                  {itemKeys.map((itKey) => (
                    <li key={itKey} className="flex items-start gap-2 text-[12px] leading-5 text-charcoal-80/80 sm:text-[12.5px]">
                      <span className="mt-0.5 flex h-3.5 w-3.5 flex-none items-center justify-center rounded-full bg-mint/15 text-mint">
                        <Check className="h-2 w-2" strokeWidth={3} aria-hidden="true" />
                      </span>
                      {t(`fit.pillars.${pillarKey}.items.${itKey}`)}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </Container>
      </section>

      {/* ╔════════════════════════════════════════════════════════════════
           § 08 · OUTCOME-DRIVEN CTA
           ════════════════════════════════════════════════════════════════ */}
      <section className="pb-14 sm:pb-20 lg:pb-24">
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-3xl px-6 py-12 sm:px-12 sm:py-14 lg:px-16 lg:py-16"
            style={{ backgroundImage: "radial-gradient(120% 120% at 0% 0%, #5D3FD3 0%, #4A2EAB 55%, #3B2487 100%)" }}
          >
            <span aria-hidden="true" className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-white/[0.06] blur-3xl sm:h-72 sm:w-72" />
            <span aria-hidden="true" className="pointer-events-none absolute -right-16 -bottom-24 h-64 w-64 rounded-full bg-terracotta/15 blur-3xl sm:h-80 sm:w-80" />

            <div className="relative grid items-center gap-8 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
              <div>
                <EyebrowChip tone="white">
                  <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
                  {t("cta.eyebrow")}
                </EyebrowChip>

                <h2 className="mt-4 text-[22px] font-bold leading-[1.1] tracking-tight !text-white sm:mt-5 sm:text-[32px] md:text-[40px]">
                  {t("cta.headingPart1")}{" "}
                  <span style={{ background: "linear-gradient(180deg,#FFD9BB 0%,#E9C46A 50%,#F0B58C 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                    {t("cta.headingPart2")}
                  </span>{t("cta.headingDot")}
                </h2>

                <p className="mt-3 max-w-xl text-[13.5px] leading-6 !text-white/75 sm:mt-4 sm:text-[15px] sm:leading-7">
                  {t("cta.body")}
                </p>

                <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row">
                  <Link
                    to="/book"
                    className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-[13.5px] font-semibold !text-violet shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 sm:px-7 sm:py-3.5 sm:text-[14.5px]"
                  >
                    {t("cta.ctaPrimary")}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </Link>
                  <Link
                    to="/services"
                    className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/40 px-6 py-3 text-[13.5px] font-semibold !text-white transition hover:-translate-y-0.5 hover:border-white/70 hover:bg-white/[0.10] sm:px-7 sm:py-3.5 sm:text-[14.5px]"
                  >
                    {t("cta.ctaSecondary")}
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {[
                  { Icon: Clock,       value: "30 min",  labelKey: "firstCall" },
                  { Icon: ShieldCheck, value: "0 risk",  labelKey: "noCommitment" },
                  { Icon: Activity,    value: "48–72h",  labelKey: "customPlanSent" },
                  { Icon: Award,       value: "8+ yrs",  labelKey: "experience" },
                ].map(({ Icon, value, labelKey }) => (
                  <div key={labelKey} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-md transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08]">
                    <Icon className="h-4 w-4 text-terracotta" aria-hidden="true" />
                    <div className="mt-2 font-mono text-[18px] font-bold tabular-nums !text-white sm:text-[22px]">{value}</div>
                    <div className="mt-1 text-[10px] !text-white/55 sm:text-[11.5px]">{t(`cta.stats.${labelKey}`)}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </Container>
      </section>
    </>
  )
}
