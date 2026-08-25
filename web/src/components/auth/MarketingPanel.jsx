/* ════════════════════════════════════════════════════════════════════════
   MarketingPanel.jsx · v3 · slide carousel
   ────────────────────────────────────────────────────────────────────────
   Right-hero of AuthShell. Three focused slides, auto-advancing every
   7 seconds with full keyboard + dot-click control, pausing on hover.

     Slide 1 — Trusted by three kinds of teams · animated donut chart
     Slide 2 — Three services. One trusted partner · three pillar cards
     Slide 3 — Clear, precise, reliably on time · testimonial + CTA

   Constant chrome (across slides):
     · Avatar + name + role  (top-left)
     · Dot indicator (bottom-left)
     · Slide counter "01 / 03" (bottom-right)

   v3 changes:
     · All slide eyebrows removed — titles carry the section identity
     · "NEW · MEMBER HUB" top-right pill removed
     · Copy de-jargoned: no "ship", "codes", "operator", "lanes", "UX",
       "architecture" — replaced with plain language non-technical
       buyers parse in one read
     · Grammar fix on Slide 1 ("each get" → restructured)

   All animation uses transform / opacity only and shuts off when
   prefers-reduced-motion is set.
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { AnimatePresence, m } from "framer-motion"
import {
  ArrowUpRight,
  Briefcase,
  GraduationCap,
  Package,
  Quote,
  ShieldCheck,
  Globe2,
} from "lucide-react"

import avatar from "../../assets/avatar/avatar-master.png"

import { useTranslation } from "react-i18next"
const SLIDE_COUNT = 3
const AUTO_ADVANCE_MS = 7000

/* ─────────────────────────── primitives ─────────────────────────────── */

const slideVariants = {
  enter: { opacity: 0, y: 18 },
  center: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -18, transition: { duration: 0.35, ease: "easeIn" } },
}

function Headline({ children }) {
  return (
    <h2 className="font-display text-[1.95rem] font-bold leading-[1.15] tracking-tight text-white xl:text-[2.15rem]">
      {children}
    </h2>
  )
}

function SubCopy({ children }) {
  return (
    <p className="max-w-md text-[14px] leading-7 text-white/60">{children}</p>
  )
}

/* ─────────────────────────── slide 1 · audience ─────────────────────── */

const AUDIENCES = [
  { color: "var(--color-violet)", labelKey: "auth.marketing.audienceProsLabel", pct: 0.58, count: "1,650", noteKey: "auth.marketing.audienceProsNote" },
  { color: "var(--color-terracotta)", labelKey: "auth.marketing.audienceInstitutionsLabel", pct: 0.29, count: "458", noteKey: "auth.marketing.audienceInstitutionsNote" },
  { color: "var(--color-violet-light)", labelKey: "auth.marketing.audienceSmesLabel", pct: 0.13, count: "350", noteKey: "auth.marketing.audienceSmesNote" },
]

function AudienceDonut({ reduce }) {
  const { t } = useTranslation("common")
  const radius = 38
  const circumference = 2 * Math.PI * radius
  const starts = AUDIENCES.reduce((acc, s, i) => { acc.push(i === 0 ? 0 : acc[i - 1] + AUDIENCES[i - 1].pct); return acc }, [])

  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth="9" fill="none" />
        {AUDIENCES.map((s, i) => {
          const dash = s.pct * circumference
          const gap = circumference - dash
          const offset = -starts[i] * circumference
          return (
            <m.circle
              key={s.labelKey}
              cx="50"
              cy="50"
              r={radius}
              stroke={s.color}
              strokeWidth="9"
              fill="none"
              strokeLinecap="butt"
              strokeDasharray={`${dash} ${gap}`}
              initial={reduce ? { strokeDashoffset: offset } : { strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 0.9, delay: 0.2 + i * 0.18, ease: "easeOut" }}
            />
          )
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[9px] uppercase tracking-wider text-white/45">{t("auth.marketing.donutTotal")}</span>
        <span className="font-display text-[20px] font-bold leading-none text-white">2,458</span>
        <span className="mt-0.5 text-[9.5px] text-white/45">{t("auth.marketing.donutSince")}</span>
      </div>
    </div>
  )
}

function SlideAudience({ reduce }) {
  const { t } = useTranslation("common")
  return (
    <m.div
      key="slide-audience"
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      className="flex flex-col gap-7"
    >
      <Headline>{t("auth.marketing.trustedTitle")}</Headline>
      <SubCopy>
        {t("auth.marketing.trustedBody2")}
      </SubCopy>

      <div className="flex items-center gap-7 rounded-2xl border border-white/8 bg-white/[0.03] p-5 backdrop-blur-sm">
        <AudienceDonut reduce={reduce} />
        <ul className="flex-1 space-y-3 text-[12.5px]">
          {AUDIENCES.map((a) => (
            <li key={a.labelKey} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-white/75">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: a.color }}
                  aria-hidden="true"
                />
                <span className="font-semibold text-white">{t(a.labelKey)}</span>
              </span>
              <span className="font-mono text-white/55">{a.count}</span>
            </li>
          ))}
          <li className="border-t border-white/8 pt-3 text-[10.5px] leading-5 text-white/40">
            {t("auth.marketing.geoBody")}
          </li>
        </ul>
      </div>
    </m.div>
  )
}

/* ─────────────────────────── slide 2 · pillars ──────────────────────── */

const PILLARS = [
  {
    icon: Package,
    titleKey: "auth.marketing.pillarsServiceProductsTitle",
    bodyKey: "auth.marketing.pillarsServiceProductsBody",
    accent: "text-violet-light",
  },
  {
    icon: Briefcase,
    titleKey: "auth.marketing.pillarsServiceConsultingTitle",
    bodyKey: "auth.marketing.pillarsServiceConsultingBody",
    accent: "text-terracotta",
  },
  {
    icon: GraduationCap,
    titleKey: "auth.marketing.pillarsServiceStemTitle",
    bodyKey: "auth.marketing.pillarsServiceStemBody",
    accent: "text-cyan",
  },
]

function SlidePillars() {
  const { t } = useTranslation("common")
  return (
    <m.div
      key="slide-pillars"
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      className="flex flex-col gap-7"
    >
      <Headline>{t("auth.marketing.pillarsHeadline1")}<br />{t("auth.marketing.partnerTitle")}</Headline>
      <SubCopy>
        {t("auth.marketing.partnerBody2")}
      </SubCopy>

      <div className="grid gap-3">
        {PILLARS.map(({ icon: Icon, titleKey, bodyKey, accent }) => (
          <div
            key={titleKey}
            className="group flex items-start gap-3.5 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 backdrop-blur-sm transition hover:border-white/15 hover:bg-white/[0.06]"
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10 ${accent}`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold text-white">{t(titleKey)}</div>
              <div className="mt-0.5 text-[12px] leading-5 text-white/55">{t(bodyKey)}</div>
            </div>
            <ArrowUpRight className="mt-1 h-3.5 w-3.5 shrink-0 text-white/30 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white/65" />
          </div>
        ))}
      </div>
    </m.div>
  )
}

/* ─────────────────────────── slide 3 · testimonial + cta ────────────── */

function SlideTestimonial() {
  const { t } = useTranslation("common")
  return (
    <m.div
      key="slide-testimonial"
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      className="flex flex-col gap-7"
    >
      <Headline>{t("auth.marketing.deliveryTitle")}</Headline>
      <SubCopy>
        {t("auth.marketing.deliveryBody2")}
      </SubCopy>

      <figure className="relative rounded-2xl border border-white/8 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-5">
        <Quote
          aria-hidden="true"
          className="absolute -top-2.5 left-5 h-5 w-5 rounded-full bg-violet p-1 text-white shadow-[0_8px_20px_rgb(var(--color-violet-rgb)/0.4)]"
        />
        <blockquote className="text-[13.5px] leading-6 text-white/85">
          {t("auth.marketing.testimonialQuote")}
        </blockquote>
        <figcaption className="mt-3 flex items-center gap-2 text-[11.5px] text-white/45">
          <span className="h-1 w-4 rounded-full bg-terracotta" />
          {t("auth.marketing.testimonialFigcaption")}
        </figcaption>
      </figure>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-white/55">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3 w-3 text-emerald-400" />
          {t("auth.marketing.owasp")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Globe2 className="h-3 w-3 text-cyan" />
          {t("auth.marketing.langs")}
        </span>
      </div>

      <Link
        to="/store"
        className="group inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-[12.5px] font-semibold text-charcoal shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition hover:-translate-y-0.5 hover:bg-white/95"
      >
        {t("auth.marketing.exploreStore")}
        <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </Link>
    </m.div>
  )
}

/* ────────────────────────────── shell ──────────────────────────────── */

export default function MarketingPanel({ reduce }) {
  const { t } = useTranslation("common")
  const [active, setActive] = useState(0)
  const hoveredRef = useRef(false)

  // Auto-advance · disabled when reduced-motion is set or while hovered.
  useEffect(() => {
    if (reduce) return undefined
    const id = window.setInterval(() => {
      if (hoveredRef.current) return
      setActive((prev) => (prev + 1) % SLIDE_COUNT)
    }, AUTO_ADVANCE_MS)
    return () => window.clearInterval(id)
  }, [reduce])

  // Arrow-key navigation — only when this region is focused.
  function handleKey(e) {
    if (e.key === "ArrowRight") {
      e.preventDefault()
      setActive((prev) => (prev + 1) % SLIDE_COUNT)
    } else if (e.key === "ArrowLeft") {
      e.preventDefault()
      setActive((prev) => (prev - 1 + SLIDE_COUNT) % SLIDE_COUNT)
    }
  }

  return (
    <div
      className="flex h-full flex-col"
      onMouseEnter={() => { hoveredRef.current = true }}
      onMouseLeave={() => { hoveredRef.current = false }}
      onKeyDown={handleKey}
      tabIndex={-1}
    >
      {/* ── Top: avatar + name (left) ──────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-3">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl ring-2 ring-white/15 shadow-[0_10px_24px_rgba(0,0,0,0.3)]">
            <img
              src={avatar}
              alt={t("auth.marketing.brandAlt")}
              className="h-full w-full object-cover"
              loading="eager"
            />
          </div>
          <div className="min-w-0">
            <div className="text-[13.5px] font-bold leading-tight text-white">
              {t("auth.marketing.brandName")}
            </div>
            <div className="mt-0.5 text-[11px] text-white/50">
              {t("auth.marketing.studioName")} {"·"} {t("auth.marketing.studioRole")}
            </div>
          </div>
        </div>
      </div>

      {/* ── Middle: rotating slide ────────────────────────────────── */}
      <div className="my-auto py-10">
        <AnimatePresence mode="wait">
          {active === 0 && <SlideAudience key="s0" reduce={reduce} />}
          {active === 1 && <SlidePillars key="s1" />}
          {active === 2 && <SlideTestimonial key="s2" />}
        </AnimatePresence>
      </div>

      {/* ── Bottom: dot nav + counter ─────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div role="tablist" aria-label={t("auth.marketing.slidesAria")} className="-mx-1.5 flex items-center">
          {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={active === i}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setActive(i)}
              className="flex h-6 w-6 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <span
                aria-hidden="true"
                className={`block h-1.5 rounded-full transition-all duration-300 ${
                  active === i ? "w-4 bg-white/85" : "w-1.5 bg-white/25"
                }`}
              />
            </button>
          ))}
        </div>

        <span className="font-mono text-[10.5px] tracking-wider text-white/40">
          {String(active + 1).padStart(2, "0")} / {String(SLIDE_COUNT).padStart(2, "0")}
        </span>
      </div>
    </div>
  )
}
