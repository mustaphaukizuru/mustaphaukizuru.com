/* ════════════════════════════════════════════════════════════════════════
   ServicesHero.jsx · /services index hero · Instructions v4.0 § 07 step 1
   ────────────────────────────────────────────────────────────────────────
   Left  — eyebrow · kinetic headline · subhead naming the four lines · two
           CTAs (book / self-audit) · two DERIVED stats (lines, services)
           · three glyph chips.
   Right — CategoryObject: the four service categories as an isometric
           stack that separates into a 2×2 glyph grid as the visitor
           scrolls (Framer useScroll → useTransform). Every tile is built
           from CATEGORIES, so name, glyph, accent and offering count can
           never drift from the catalogue. prefers-reduced-motion renders
           the separated grid statically.

   Replaced (2026-09-03): a hot-linked stock portrait (§ 5.2i banned), a
   hard-coded "94 % on-time" figure and "82+ engagements" aria text with
   no recorded source (§ 6.1 CLAIMS, Description R6), three English-only
   feature ticks, and a stale six-family node diagram from the retired
   82-service taxonomy (§ 06 closed set).
   ════════════════════════════════════════════════════════════════════════ */

import { useRef } from "react"
import { m, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion"
import { LocalizedLink as Link } from "../LocalizedLink"
import { useTranslation } from "react-i18next"
import { ArrowRight, Calendar, ClipboardCheck, UserCheck, Receipt, MessagesSquare } from "lucide-react"
import KineticHeadline from "../motion/KineticHeadline"
import { CATALOG_STATS, CATEGORIES, bookHref } from "../../data/servicesCatalogue"
import { pick, useCatalogueLang } from "../services/localize"

/* ── Animation variants ─────────────────────────────────────────────────── */
const EASE = [0.22, 1, 0.36, 1]
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
}
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}

/* Glyph chips · the three commitments, as icon + label (never a <ul> of text) */
const TICKS = [
  { key: "senior",  Icon: UserCheck },
  { key: "fixed",   Icon: Receipt },
  { key: "direct",  Icon: MessagesSquare },
]

/* ── Container ──────────────────────────────────────────────────────────── */
function Container({ children, className = "" }) {
  return <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
}

/* ── Right-side object · four tiles, stacked → separated ────────────────
   Tile positions are expressed in percentages of the object frame so the
   composition holds at every breakpoint. STACK is the resting isometric
   pile; GRID is the 2×2 canonical order (S1 top-left → S4 bottom-right). */
const STACK = [
  { x: 22, y: 8 },  { x: 30, y: 20 },
  { x: 38, y: 32 }, { x: 46, y: 44 },
]
const GRID = [
  { x: 4,  y: 4 },  { x: 52, y: 4 },
  { x: 4,  y: 52 }, { x: 52, y: 52 },
]

function CategoryTile({ category, index, progress, reduce, lang, countLabel }) {
  const Icon = category.Icon
  const from = STACK[index]
  const to = GRID[index]
  /* Hooks are called unconditionally; with reduced motion the resting
     values are the separated grid, so the transforms are simply constant. */
  const x = useTransform(progress, [0, 1], [reduce ? to.x : from.x, to.x])
  const y = useTransform(progress, [0, 1], [reduce ? to.y : from.y, to.y])
  const left = useTransform(x, (v) => `${v}%`)
  const top = useTransform(y, (v) => `${v}%`)
  const rotate = useTransform(progress, [0, 1], [reduce ? 0 : -6 + index * 3, 0])

  return (
    <m.div
      style={{ left, top, rotate }}
      className="absolute h-[44%] w-[44%]"
    >
      <Link
        to={`/services/${category.slug}`}
        className={`group flex h-full w-full flex-col justify-between rounded-2xl p-4 text-white shadow-[var(--shadow-e4)] ring-1 ring-white/20 transition-transform duration-300 hover:-translate-y-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-violet/40 sm:p-5 ${category.tile}`}
        aria-label={pick(category, "name", lang)}
      >
        <div className="flex items-start justify-between">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
            {Icon && <Icon className="h-5 w-5" aria-hidden="true" />}
          </span>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-white/90">{category.code}</span>
        </div>
        <div>
          <div className="text-[13px] font-bold leading-tight sm:text-[14px]">{pick(category, "name", lang)}</div>
          <div className="mt-1 font-mono text-[11px] text-white/90 tabular-nums">{countLabel}</div>
        </div>
      </Link>
    </m.div>
  )
}

function CategoryObject({ reduce }) {
  const { t } = useTranslation("services")
  const lang = useCatalogueLang()
  const ref = useRef(null)
  /* 0 while the hero sits at the top of the page, 1 once it has scrolled
     ~55 % of its height out of view — the tiles finish separating while
     the visitor can still see them. */
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "55% start"] })
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.4 })

  return (
    <m.div
      ref={ref}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE }}
      className="relative mx-auto w-full max-w-[460px] lg:max-w-[520px]"
      role="group"
      aria-label={t("hero.objectAria")}
    >
      {/* Isometric field texture · § 5.2c */}
      <svg aria-hidden="true" className="pointer-events-none absolute -inset-6 h-[calc(100%+3rem)] w-[calc(100%+3rem)] text-violet/[0.08]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="services-iso" width="32" height="18.5" patternUnits="userSpaceOnUse">
            <path d="M16 0 L32 9.25 L16 18.5 L0 9.25 Z" fill="none" stroke="currentColor" strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#services-iso)" rx="28" />
      </svg>
      <div className="relative w-full" style={{ aspectRatio: "1 / 1" }}>
        {CATEGORIES.map((category, i) => (
          <CategoryTile
            key={category.slug}
            category={category}
            index={i}
            progress={progress}
            reduce={reduce}
            lang={lang}
            countLabel={t("hero.offeringCount", { count: category.offerings.length })}
          />
        ))}
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
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          {/* ── LEFT · copy ────────────────────────────────────────── */}
          <m.div variants={stagger} initial={reduce ? false : "hidden"} animate="show" className="max-w-xl">
            <m.div variants={fadeUp}>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-pale px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet">
                {t("hero.eyebrow")}
              </span>
            </m.div>

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

            <m.p variants={fadeUp} className="mt-5 max-w-md text-[15px] leading-7 text-charcoal-80/65 sm:text-[16px]">
              {t("hero.subtitle")}
            </m.p>

            {/* CTAs */}
            <m.div variants={fadeUp} className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
              <Link
                to={bookHref(null)}
                aria-label={t("hero.bookCallAria")}
                className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-violet px-6 py-3.5 text-[14px] font-bold !text-white shadow-[var(--shadow-lift-4)] transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet/40"
              >
                <Calendar className="relative h-4 w-4 !text-white" aria-hidden="true" />
                <span className="relative">{t("hero.bookCallCta")}</span>
                <ArrowRight className="relative h-4 w-4 !text-white transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
              <Link
                to="/self-audit"
                aria-label={t("hero.selfAuditAria")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-charcoal-80/15 bg-white px-6 py-3.5 text-[14px] font-bold !text-charcoal-80 transition hover:-translate-y-0.5 hover:border-violet/30 hover:!text-violet focus:outline-none focus-visible:ring-2 focus-visible:ring-violet/30"
              >
                <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                {t("hero.selfAuditCta")}
              </Link>
            </m.div>

            {/* Stats · both DERIVED from the catalogue (§ 6.1 CLAIMS) */}
            <m.div variants={fadeUp} className="mt-8 grid grid-cols-2 gap-6 sm:max-w-sm sm:gap-8">
              <div>
                <div className="font-mono text-[28px] font-extrabold leading-none tabular-nums !text-charcoal-80 sm:text-[32px]">
                  {CATALOG_STATS.categoryCount}
                </div>
                <div className="mt-1.5 text-[11.5px] text-charcoal-80/65 sm:text-[12px]">{t("hero.serviceLines")}</div>
              </div>
              <div>
                <div className="font-mono text-[28px] font-extrabold leading-none tabular-nums !text-charcoal-80 sm:text-[32px]">
                  {CATALOG_STATS.totalServices}
                </div>
                <div className="mt-1.5 text-[11.5px] text-charcoal-80/65 sm:text-[12px]">{t("hero.atomicServices")}</div>
              </div>
            </m.div>

            <m.div variants={fadeUp} aria-hidden="true" className="mt-7 h-px w-full max-w-sm bg-gradient-to-r from-charcoal-80/15 via-charcoal-80/10 to-transparent" />

            {/* Commitments · glyph chips */}
            <m.div variants={fadeUp} className="mt-5 flex flex-wrap gap-2.5" role="list">
              {TICKS.map(({ key, Icon }) => (
                <span key={key} role="listitem" className="inline-flex items-center gap-2 rounded-full border border-charcoal-80/10 bg-mist px-3 py-1.5 text-[13px] font-medium text-charcoal-80">
                  <Icon className="h-4 w-4 text-violet" aria-hidden="true" />
                  {t(`hero.ticks.${key}`)}
                </span>
              ))}
            </m.div>
          </m.div>

          {/* ── RIGHT · the four categories as one object ─────────── */}
          <CategoryObject reduce={reduce} />
        </div>
      </Container>
    </section>
  )
}
