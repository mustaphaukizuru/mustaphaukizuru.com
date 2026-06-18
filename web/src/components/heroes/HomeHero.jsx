import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { motion, useReducedMotion } from "framer-motion"
import {
  ArrowRight,
  ArrowUpRight,
  MapPin,
  Calendar,
  Zap,
  Globe2,
  TrendingUp,
  Sparkles,
} from "lucide-react"

import mMarkViolet from "../../assets/logo-mark/m-mark-violet.svg"
import Particles from "../motion/Particles"
import WordRotate from "../motion/WordRotate"
import { products as STORE_PRODUCTS } from "../../data/storeData"
import { fetchFeaturedProducts } from "../../services/productService"
import { formatPrice } from "../../lib/format"
import KineticHeadline from "../motion/KineticHeadline"

/**
 * HomeHero · V10 — "Floating cluster" composition
 * ─────────────────────────────────────────────────────────────────────────
 * Inspiration: modern fintech-style hero (one centerpiece + 6 satellite
 * proof elements) — adapted to mustaphaukizuru.com's three pillars:
 *   Products · Services · Expertise.
 *
 * Centerpiece  · Phone mockup of the signed-in member dashboard
 *                showing a real client-project view (proves the platform
 *                is a live SaaS, not a portfolio).
 *
 * Satellite cluster (6 elements):
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  ◉ {t("hero.openToWork")}          ┌───── PHONE ─────┐    📍 LATAM     │
 *   │  ★ STEM Pack · $48       │   Project       │    Stack ⓘ      │
 *   │                          │   Raindrop      │    Django/React │
 *   │  📅 Consulting · 3 slots │   76% complete  │    8yrs · 47 ↑  │
 *   │                          └─────────────────┘                  │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Layout strategy:
 *   • Desktop (lg+): floating cluster — cards absolutely positioned
 *     around the phone, anchored to a max-width container so the
 *     composition stays intentional at any monitor width.
 *   • Tablet/mobile: phone centered, cards in a horizontal scroll-rail
 *     beneath it (snap-x mandatory) — preserves the "floating" feel on
 *     small viewports without forcing a flat 2x2 grid.
 *
 * Brand tokens (Brand Identity v3.0, defined in web/src/index.css @theme):
 *   bg-mist · bg-violet · bg-violet-pale · bg-violet-deep · bg-violet-ghost
 *   text-charcoal · text-violet · text-violet-deep · text-mint · text-terracotta
 *   bg-grad-innovation · font-display · font-mono
 *
 * Accessibility (WCAG 2.1 AA):
 *   • prefers-reduced-motion respected on every animation surface.
 *   • Phone screen has role="img" + aria-label (decorative dashboard).
 *   • All interactive elements have visible focus rings.
 *   • Color contrast verified against Brand v3 §05 contrast matrix.
 *   • Live status pulse uses both color + animation, never color alone.
 */

/* ────────────────────────────── content ──────────────────────────────── */

/* Demo project shown inside the phone — anchored to a real engagement
   so the dashboard reads as authentic rather than fabricated.
   Dates are computed dynamically at module-load time so the milestones
   always reflect the current month: Discovery = 3 months ago, Build = 1
   month ago, QA = now, Launch = 2 months from now. No stale dates. */
function buildDemoProject() {
  const now = new Date()
  const fmt = (d) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" })

  const discovery = new Date(now)
  discovery.setMonth(discovery.getMonth() - 3)

  const build = new Date(now)
  build.setMonth(build.getMonth() - 1)

  const launch = new Date(now)
  launch.setMonth(launch.getMonth() + 2)

  return {
    client: "Colegio Raindrop",
    name: "Internal Platform",
    phaseLabel: "Phase 3 of 4 · QA in progress",
    progress: 76,
    milestones: [
      { label: "Discovery", state: "done", meta: fmt(discovery) },
      { label: "Build",     state: "done", meta: fmt(build) },
      { label: "QA & UAT", state: "now",  meta: "In progress" },
      { label: "Launch",   state: "todo", meta: fmt(launch) },
    ],
  }
}

const DEMO_PROJECT = buildDemoProject()

const TECH_STACK = ["Django", "React", "GCP"]

/* Defensive featured-product picker. Falls back to a static placeholder
   if the data shape changes or the store is empty — the hero must never
   render a blank card.
   Normalises both shapes (live API + static storeData) so downstream
   rendering can treat them identically. */
function pickFeaturedProduct(products) {
  if (!Array.isArray(products) || products.length === 0) return null
  const fiveStarFeatured = products.find(
    (p) => (p?.featured === true || p?.isFeatured === true) && (p?.rating ?? 0) >= 5,
  )
  return (
    fiveStarFeatured ||
    products.find((p) => p?.featured === true || p?.isFeatured === true) ||
    products[0]
  )
}

/* Normalise a product (either shape) into the minimal contract the
   FeaturedProductCard needs: { id (slug for routing), title, price, currency }. */
function normaliseFeaturedProduct(p) {
  if (!p) return null
  return {
    id: p.slug || p.id,  // route param — prefer slug since that's what /store/:slug expects
    title: p.title,
    price: Number(p.price ?? 0),
    currency: p.currency || "MXN",
  }
}

/* ────────────────────────── component ────────────────────────────────── */

export default function HomeHero() {
  const { t } = useTranslation("home")
  const reduced = useReducedMotion()

  /* Featured product — live from the API, with a defensive fall-back to
     static data so the hero never renders blank. The API call is non-
     blocking; first paint shows the static pick, then swaps to the live
     "latest featured" once the request resolves (PDF #9). */
  const [liveFeatured, setLiveFeatured] = useState(null)
  useEffect(() => {
    let cancelled = false
    fetchFeaturedProducts(1)
      .then((rows) => {
        if (cancelled) return
        const first = Array.isArray(rows) && rows.length > 0 ? rows[0] : null
        if (first) setLiveFeatured(first)
      })
      .catch(() => { /* keep static fallback */ })
    return () => { cancelled = true }
  }, [])

  const featuredProduct = useMemo(
    () => normaliseFeaturedProduct(liveFeatured || pickFeaturedProduct(STORE_PRODUCTS)),
    [liveFeatured],
  )

  /* Framer Motion variants — match existing fadeUp/stagger conventions
     used across the codebase (see Audiences, Solutions, FeaturedProducts). */
  const stagger = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduced ? 0 : 0.07,
        delayChildren: 0.05,
      },
    },
  }
  const fadeUp = {
    hidden: { opacity: 0, y: reduced ? 0 : 18 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
    },
  }
  const floatIn = (delay = 0) => ({
    hidden: { opacity: 0, scale: reduced ? 1 : 0.92, y: reduced ? 0 : 12 },
    show: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] },
    },
  })

  return (
    <section
      className="relative isolate overflow-hidden bg-mist"
      aria-label={t("hero.ariaLabel")}
    >
      {/* ── Mesh aurora background (Brand v3 §06) ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(at 8% 12%, rgba(93,63,211,0.18) 0px, transparent 50%), " +
            "radial-gradient(at 92% 0%, rgba(2,132,199,0.14) 0px, transparent 50%), " +
            "radial-gradient(at 100% 78%, rgba(125,211,252,0.16) 0px, transparent 55%), " +
            "radial-gradient(at 0% 100%, rgba(233,196,106,0.14) 0px, transparent 50%)",
        }}
      />

      {/* ── Particle field — brand violet, low opacity, mouse-reactive ── */}
      <Particles
        quantity={60}
        color="#5D3FD3"
        size={1.2}
        speed={0.3}
        interactRadius={100}
        interactStrength={2.5}
        style={{ opacity: 0.45 }}
      />

      {/* ── 3 % SVG noise overlay to defeat banding (Brand v3 §10) ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.55] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8," +
            encodeURIComponent(
              "<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.04 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>",
            ) +
            "\")",
        }}
      />

      {/* ── Decorative concentric arcs (echo the reference's hand-drawn lines) ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden lg:block"
        style={{
          backgroundImage:
            "radial-gradient(1200px 1200px at 50% 110%, transparent 64%, rgba(93,63,211,0.08) 64.3%, transparent 64.6%)," +
            "radial-gradient(1000px 1000px at 50% 108%, transparent 64%, rgba(93,63,211,0.06) 64.3%, transparent 64.6%)," +
            "radial-gradient(800px 800px at 50% 106%, transparent 64%, rgba(93,63,211,0.05) 64.3%, transparent 64.6%)",
        }}
      />

      <motion.div
        className="relative z-10 mx-auto max-w-7xl px-4 pt-16 pb-24 sm:px-6 sm:pt-20 lg:px-8 lg:pt-24 lg:pb-32"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {/* ── Headline block ─────────────────────────────────────────── */}
        <motion.div className="mx-auto max-w-3xl text-center" variants={fadeUp}>
          <span className="inline-flex items-center gap-2 rounded-full bg-violet-pale px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-violet-deep">
            <span
              className="h-1.5 w-1.5 rounded-full bg-violet"
              aria-hidden="true"
            />
            {t("hero.eyebrow")}
          </span>

          {/* Phase 10 · kinetic headline — word-by-word reveal with
              gradient-swept emphasis. Falls back to a static H1 when the
              user prefers reduced motion (handled inside KineticHeadline). */}
          <KineticHeadline
            as="h1"
            stagger={0.07}
            className="mt-5 font-display text-[length:var(--text-hero)] font-extrabold leading-[1.04] tracking-[-0.02em] text-charcoal text-balance"
            parts={[
              { text: t("hero.headlineBuilt") },
              { text: t("hero.headlineShipped"), highlight: true },
              { text: t("hero.headlineForYou"),  gradient: true },
            ]}
            highlightClassName="text-terracotta"
          />

          <motion.p
            variants={fadeUp}
            className="mx-auto mt-5 max-w-xl text-[15px] leading-[1.7] text-charcoal-80 sm:text-[17px]"
          >
            {t("hero.subtitlePre", { defaultValue: "Full-stack engineering, consulting, and STEM education for" })}{" "}
            <WordRotate
              words={[
                t("hero.rotateSchools",    { defaultValue: "schools" }),
                t("hero.rotateBusinesses", { defaultValue: "businesses" }),
                t("hero.rotateSmes",       { defaultValue: "SMEs" }),
                t("hero.rotateCreators",   { defaultValue: "creators" }),
              ]}
              className="text-violet font-semibold"
              interval={2200}
            />
            {t("hero.subtitlePost", { defaultValue: " — from LATAM, for the world." })}
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <Link
              to="/services"
              className="ukz-shimmer group inline-flex items-center gap-2 rounded-full bg-grad-innovation px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet/20 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
            >
              {t("hero.exploreServices")}
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-full border border-charcoal/15 bg-white/70 px-6 py-3 text-sm font-semibold text-charcoal backdrop-blur transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
            >
              {t("hero.bookCall")}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </motion.div>
        </motion.div>

        {/* ── Cluster stage ─────────────────────────────────────────── */}
        <div className="relative mt-12 lg:mt-16">
          {/* Desktop floating cluster — absolute positioning on lg+ */}
          <div className="relative mx-auto hidden h-[640px] w-full max-w-5xl lg:block">
            {/* Floating: {t("hero.openToWork")} pill */}
            <motion.div
              variants={floatIn(0.15)}
              className="absolute left-[4%] top-[8%] z-30"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-charcoal/5 bg-white px-4 py-2 text-[13px] font-semibold text-violet-deep shadow-[0_8px_24px_-12px_rgba(93,63,211,0.25)]">
                <span className="relative flex h-2 w-2">
                  <span
                    className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-75"
                    aria-hidden="true"
                  />
                  <span
                    className="relative inline-flex h-2 w-2 rounded-full bg-mint"
                    aria-hidden="true"
                  />
                </span>
                {t("hero.openToWork")}
              </div>
            </motion.div>

            {/* Accent bubble near the Open-to-Work pill */}
            <motion.div
              variants={floatIn(0.25)}
              aria-hidden="true"
              className="absolute left-[19%] top-[3%] z-20 flex h-12 w-12 items-center justify-center rounded-full bg-terracotta/40 backdrop-blur"
            >
              <Zap className="h-5 w-5 text-violet-deep" />
            </motion.div>

            {/* Floating: {t("hero.builtInLatam")} pill */}
            <motion.div
              variants={floatIn(0.18)}
              className="absolute right-[4%] top-[10%] z-30"
            >
              <div className="inline-flex items-center gap-2 rounded-full bg-violet px-4 py-2 text-[13px] font-semibold text-white shadow-[0_8px_24px_-12px_rgba(93,63,211,0.45)]">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {t("hero.builtInLatam")}
              </div>
            </motion.div>

            {/* Accent bubble near the LATAM pill */}
            <motion.div
              variants={floatIn(0.28)}
              aria-hidden="true"
              className="absolute right-[19%] top-[5%] z-20 flex h-12 w-12 items-center justify-center rounded-full bg-violet shadow-lg shadow-violet/30"
            >
              <Globe2 className="h-5 w-5 text-terracotta" />
            </motion.div>

            {/* Phone centerpiece — absolutely centered */}
            <motion.div
              variants={floatIn(0.05)}
              className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
            >
              <PhoneMockup project={DEMO_PROJECT} reduced={reduced} />
            </motion.div>

            {/* Left-upper · {t("hero.featuredProduct")} card */}
            <motion.div
              variants={floatIn(0.4)}
              className="absolute bottom-[34%] left-[2%] z-20"
            >
              <FeaturedProductCard product={featuredProduct} />
            </motion.div>

            {/* Left-lower · Consulting availability card */}
            <motion.div
              variants={floatIn(0.5)}
              className="absolute bottom-[6%] left-[6%] z-20"
            >
              <ConsultingCard />
            </motion.div>

            {/* Right-upper · Tech stack card */}
            <motion.div
              variants={floatIn(0.4)}
              className="absolute bottom-[34%] right-[2%] z-20"
            >
              <StackCard />
            </motion.div>

            {/* Right-lower · Years card */}
            <motion.div
              variants={floatIn(0.5)}
              className="absolute bottom-[6%] right-[6%] z-20"
            >
              <YearsCard />
            </motion.div>
          </div>

          {/* Mobile + tablet — phone centered, pills above, cards in scroll-rail */}
          <div className="lg:hidden">
            {/* Pills row */}
            <motion.div
              variants={fadeUp}
              className="mb-8 flex flex-wrap items-center justify-center gap-2"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-charcoal/5 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-violet-deep shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span
                    className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-75"
                    aria-hidden="true"
                  />
                  <span
                    className="relative inline-flex h-2 w-2 rounded-full bg-mint"
                    aria-hidden="true"
                  />
                </span>
                {t("hero.openToWork")}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-violet px-3.5 py-1.5 text-[12px] font-semibold text-white">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                {t("hero.builtInLatam")}
              </div>
            </motion.div>

            {/* Phone */}
            <motion.div variants={floatIn(0.1)} className="flex justify-center">
              <PhoneMockup project={DEMO_PROJECT} reduced={reduced} compact />
            </motion.div>

            {/* Horizontal scroll-rail of the 4 proof cards */}
            <motion.div
              variants={fadeUp}
              className="mt-8 -mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <div className="flex gap-3 snap-x snap-mandatory">
                <div className="snap-start shrink-0">
                  <FeaturedProductCard product={featuredProduct} />
                </div>
                <div className="snap-start shrink-0">
                  <ConsultingCard />
                </div>
                <div className="snap-start shrink-0">
                  <StackCard />
                </div>
                <div className="snap-start shrink-0">
                  <YearsCard />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}

/* ────────────────────────── helpers ──────────────────────────────────── */

/* Phone mockup — synthetic dashboard view of a member's active project.
   Marked as decorative imagery for AT users via aria-label on the
   wrapping figure. The visual content is an illustration of the
   platform's UX, not actionable. */
function PhoneMockup({ project, reduced, compact = false }) {
  const { t } = useTranslation("home")
  const width = compact ? 240 : 280
  const height = compact ? 500 : 580
  return (
    <figure
      role="img"
      aria-label={`Member dashboard preview — ${project.client} ${project.name}, ${project.progress}% complete`}
      className="relative"
      style={{ width, height }}
    >
      {/* Phone outer body */}
      <div
        className="relative h-full w-full rounded-[44px] bg-charcoal p-2 shadow-[0_30px_60px_-20px_rgba(93,63,211,0.35),0_18px_36px_-18px_rgba(99,79,64,0.30)]"
        aria-hidden="true"
      >
        {/* Screen */}
        <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[36px] bg-white">
          {/* Notch */}
          <div className="absolute left-1/2 top-2 z-30 h-6 w-24 -translate-x-1/2 rounded-full bg-charcoal" />

          {/* Status bar */}
          <div className="flex items-center justify-between px-5 pb-2 pt-3 text-[10px] font-semibold text-charcoal">
            <span>9:41</span>
            <div className="flex items-center gap-1">
              <span aria-hidden="true">•••</span>
              <span aria-hidden="true">•</span>
            </div>
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 pb-3 pt-2">
            <div>
              <p className="text-[10px] text-charcoal-80/70">{t("hero.welcomeBack")}</p>
              <p className="text-[14px] font-semibold text-charcoal">Mustapha</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-violet-pale">
              <img
                src={mMarkViolet}
                alt=""
                className="h-4 w-4"
                aria-hidden="true"
              />
            </div>
          </div>

          {/* Project card — Dawn gradient (Brand v3 §06: hero/premium
              surfaces). Sacred Innovation Gradient is reserved for the
              single conversion CTA above (line ~256, "Explore services"). */}
          <div className="relative mx-4 overflow-hidden rounded-2xl bg-grad-dawn p-4 text-white">
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-terracotta/30 blur-2xl" />
            <p className="text-[9px] font-semibold uppercase tracking-[0.08em] opacity-70">
              {t("hero.activeProject")}
            </p>
            <p className="mt-0.5 text-[14px] font-semibold leading-tight">
              {project.client} · {project.name}
            </p>
            <p className="mt-0.5 text-[10px] opacity-70">
              {project.phaseLabel}
            </p>

            <div className="mt-3 flex items-center gap-3">
              <ProgressRing
                value={project.progress}
                size={52}
                stroke={5}
                track="rgba(255,255,255,0.18)"
                fill="#E9C46A"
                reduced={reduced}
              />
              <div className="text-[10px]">
                <p className="text-[12px] font-semibold leading-none">
                  {t("hero.milestoneThree")}
                </p>
                <p className="mt-1 opacity-70">{t("hero.paidQa")}</p>
              </div>
            </div>
          </div>

          {/* Milestones */}
          <div className="mx-4 mt-3 rounded-xl bg-mist px-3 py-2">
            {project.milestones.map((m, i) => (
              <div
                key={m.label}
                className={
                  "flex items-center gap-2 py-1.5 text-[11px] " +
                  (i > 0 ? "border-t border-charcoal/5" : "")
                }
              >
                <MilestoneDot state={m.state} />
                <span className="flex-1 text-charcoal">{m.label}</span>
                <span className="text-[10px] text-charcoal-80/60">
                  {m.meta}
                </span>
              </div>
            ))}
          </div>

          {/* Tab bar */}
          <div className="mt-auto flex items-center justify-between border-t border-charcoal/5 px-5 pb-4 pt-3">
            {["Home", "Projects", "Store", "Profile"].map((label, i) => (
              <div
                key={label}
                className={
                  "flex flex-col items-center gap-0.5 text-[9px] " +
                  (i === 0 ? "text-violet" : "text-charcoal-80/50")
                }
              >
                <div
                  className={
                    "h-1.5 w-1.5 rounded-full " +
                    (i === 0 ? "bg-violet" : "bg-charcoal-80/30")
                  }
                />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </figure>
  )
}

/* Tiny progress ring — pure CSS conic-gradient, no SVG, no JS animation
   (respects reduced-motion automatically — there's nothing animated). */
function ProgressRing({ value, size = 52, fill = "#E9C46A", track = "rgba(255,255,255,0.18)" }) {
  const safe = Math.max(0, Math.min(100, value))
  return (
    <div
      className="relative flex items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${fill} ${safe}%, ${track} 0)`,
      }}
      role="progressbar"
      aria-valuenow={safe}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {/* Inner mask — matches the project card surface (bg-grad-dawn) so
          the conic-gradient ring above reads as a ring, not a filled disc. */}
      <div
        className="absolute rounded-full bg-grad-dawn"
        style={{ inset: 5 }}
      />
      <span
        className="relative z-10 text-[11px] font-bold"
        style={{ color: fill }}
      >
        {safe}%
      </span>
    </div>
  )
}

function MilestoneDot({ state }) {
  if (state === "done") {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-mint/20 text-[8px] font-bold text-mint">
        ✓
      </span>
    )
  }
  if (state === "now") {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-terracotta/20 text-[8px] font-bold text-terracotta-deep">
        ●
      </span>
    )
  }
  return (
    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-charcoal/10 text-[8px] text-charcoal-80/50">
      ·
    </span>
  )
}

/* {t("hero.featuredProduct")} card — pulls live from data/storeData.js with safe
   fallback to a synthetic placeholder. Links to the product page when
   real data is available. */
function FeaturedProductCard({ product }) {
  const { t } = useTranslation("home")
  const safe = product || {
    id: null,
    title: "STEM Curriculum Pack",
    price: 48,
    currency: "MXN",
  }
  const priceLabel = formatPrice(safe.price, safe.currency || "MXN")
  const inner = (
    <div className="flex w-[224px] items-center gap-3 rounded-2xl border border-charcoal/5 bg-white p-3 shadow-[0_12px_28px_-10px_rgba(93,63,211,0.15)] transition-transform hover:-translate-y-0.5">
      {/* Icon plate — solid Royal Violet (Brand v3 §08: icon fills must
          never be the Innovation Gradient, which is sacred to conversion). */}
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-violet">
        <Sparkles className="h-5 w-5 text-white" aria-hidden="true" />
        <div className="absolute -right-2 -top-2 h-8 w-8 rounded-full bg-terracotta/40" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-charcoal-80/60">
          {t("hero.featuredProduct")}
        </p>
        <p className="mt-0.5 truncate text-[13px] font-semibold text-charcoal">
          {safe.title}
        </p>
        <p className="mt-1 font-mono text-[12px] font-semibold tabular-nums text-violet">
          {priceLabel}
        </p>
      </div>
    </div>
  )
  return safe.id ? (
    <Link
      to={`/store/${safe.id}`}
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-mist rounded-2xl"
      aria-label={`Featured product — ${safe.title}, ${priceLabel}`}
    >
      {inner}
    </Link>
  ) : (
    inner
  )
}

/* Consulting availability card. Soft CTA toward /contact (booking flow). */
function ConsultingCard() {
  const { t } = useTranslation("home")
  return (
    <Link
      to="/contact"
      className="block w-[208px] rounded-2xl border border-charcoal/5 bg-white p-4 shadow-[0_12px_28px_-10px_rgba(93,63,211,0.15)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2 focus-visible:ring-offset-mist"
      aria-label={t("hero.consultingAria")}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-pale text-violet-deep">
          <Calendar className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-charcoal-80/60">
            {t("hero.cardConsulting")}
          </p>
          <p className="text-[13px] font-semibold text-charcoal">
            {t("hero.availableNow")}
          </p>
        </div>
      </div>
      <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-mint/15 px-2.5 py-1 text-[11px] font-semibold text-mint">
        <span
          className="h-1.5 w-1.5 rounded-full bg-mint"
          aria-hidden="true"
        />
        {t("hero.slotsOpen")}
      </div>
    </Link>
  )
}

/* Tech stack card — three brand-spec stack chips. */
function StackCard() {
  const { t } = useTranslation("home")
  return (
    <div className="w-[208px] rounded-2xl border border-charcoal/5 bg-white p-4 shadow-[0_12px_28px_-10px_rgba(93,63,211,0.15)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-charcoal-80/60">
        {t("hero.cardStack")}
      </p>
      <p className="mt-0.5 text-[13px] font-semibold text-charcoal">
        {t("hero.engineeredWith")}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {TECH_STACK.map((tech, i) => (
          <span
            key={tech}
            className={
              "rounded-full px-2.5 py-1 text-[11px] font-semibold " +
              (i === TECH_STACK.length - 1
                ? "bg-terracotta/20 text-terracotta-deep"
                : "bg-violet-pale text-violet-deep")
            }
          >
            {tech}
          </span>
        ))}
      </div>
    </div>
  )
}

/* Years-shipping card. Maps the "Balance" stat-card slot from the
   reference design to credibility instead of money. */
function YearsCard() {
  const { t } = useTranslation("home")
  return (
    <div className="w-[224px] rounded-2xl border border-charcoal/5 bg-white p-4 shadow-[0_12px_28px_-10px_rgba(93,63,211,0.15)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-charcoal-80/60">
        {t("hero.buildingSince")}
      </p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-[28px] font-extrabold leading-none tracking-[-0.02em] text-violet-deep">
          8
        </span>
        <span className="text-[13px] font-medium text-charcoal">
          {t("hero.yearsShipping")}
        </span>
      </div>
      <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-mint">
        <TrendingUp className="h-3 w-3" aria-hidden="true" />
        {t("hero.trending")}
      </div>
    </div>
  )
}
