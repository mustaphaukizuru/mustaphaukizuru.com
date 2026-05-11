import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import Seo from "../components/seo/Seo"
import { pageSeo } from "../seo/pageSeo"
import { siteNavigationSchema } from "../seo/schemas"
import PortfolioCard from "../components/PortfolioCard"
import {
  ArrowRight, ArrowLeft, Star, Inbox,
  Server, Globe, RefreshCcw, Cloud,
  Calendar, ShoppingBag,
} from "lucide-react"
import { fetchProducts } from "../services/productService"
import { fetchFeaturedServices } from "../services/serviceService"
import { fetchFeaturedPortfolio } from "../services/portfolioService"
import { useCart } from "../store/CartContext"
import { API_BASE_URL } from "../lib/api"
import { audiences, solutions, processSteps, testimonials } from "../data/homeData"
import ProductCard from "../components/ProductCard"
import HomeHero from "../components/heroes/HomeHero" // V2, universal hero
import FeaturedReviewsRibbon from "../components/FeaturedReviewsRibbon"

// Design-system primitives (Phase B · v1.0)
import { Card, EmptyState, Skeleton } from "../components/system"

// Phase 10b · motion primitives
import Marquee from "../components/motion/Marquee"

/* ──────────────────────────────────────────────────────────────────────────
 *  Home · F12 · Batch 4
 *  ──────────────────────────────────────────────────────────────────── */

/* Hero, social icons, and profile photo now live in HomeHero.jsx — see
   ../components/heroes/HomeHero. The local Hero() function previously
   defined here was dead code (HomeHero was always the rendered hero in
   Home() but the file didn't exist). */

const fadeUp = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.52, ease: "easeOut" } } }
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.09 } } }

function Container({ children, className = "" }) {
  return <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
}

function SectionHeading({ eyebrow, title, subtitle, align = "center", action = null }) {
  const c = align === "center"
  return (
    <div className={`mb-12 flex flex-col gap-4 ${action ? "lg:flex-row lg:items-end lg:justify-between" : ""}`}>
      <div className={`flex flex-col gap-3 ${c ? "items-center text-center" : "items-start"}`}>
        {eyebrow && <span className="inline-flex items-center rounded-full bg-violet-pale px-3 py-1 text-micro font-semibold uppercase tracking-[0.2em] text-violet">{eyebrow}</span>}
        <h2 className="text-section font-bold tracking-tight text-violet sm:text-page lg:text-page">{title}</h2>
        {subtitle && <p className={`max-w-2xl text-body leading-7 text-charcoal-80/70 ${c ? "mx-auto" : ""}`}>{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 *  RevealSection · scroll-reveal wrapper
 *  ──────────────────────────────────────────────────────────────────────── */
function RevealSection({ children, className = "" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ─────────────────── BUILT WITH · marquee strip ───────────────────────
 *  Phase 10b · infinite-scroll tech-stack ribbon sitting between the
 *  hero and the Audiences section. Acts as a credibility signal — "this
 *  isn't a typed-up CV, here's the stack actually used in production".
 *
 *  Items are text-only (no logo assets needed). Order is deliberate:
 *  language → framework → infra → tooling → AI, so a reader scanning
 *  left-to-right gets a coherent stack story rather than a random list.
 *  Replace with logo `<img>` tags later when brand-vetted SVGs land.
 *  ────────────────────────────────────────────────────────────────── */
const BUILT_WITH_ITEMS = [
  "React 19", "Vite 7", "Tailwind v4", "Framer Motion",
  "Node.js", "Express", "Prisma 6", "MySQL",
  "PayPal", "MercadoPago", "Stripe-ready",
  "Google Cloud", "Hostinger", "PM2",
  "PWA", "i18n EN · ES",
]

function BuiltWithStrip() {
  const { t } = useTranslation("home")
  return (
    <section
      aria-label={t("builtWith.sectionLabel", { defaultValue: "Stack used in production" })}
      className="border-y border-charcoal-80/8 bg-mist py-7 sm:py-9"
    >
      <div className="mx-auto mb-3 flex max-w-7xl items-center justify-center px-4">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.22em] text-charcoal-80/55">
          {t("builtWith.eyebrow", { defaultValue: "Built with · Production stack" })}
        </span>
      </div>
      <Marquee
        speed={42}
        ariaLabel={t("builtWith.marqueeAria", { defaultValue: "Production stack ticker" })}
      >
        {BUILT_WITH_ITEMS.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-2 font-mono text-[13px] font-semibold uppercase tracking-[0.14em] text-charcoal-80/70"
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-violet/50"
            />
            {item}
          </span>
        ))}
      </Marquee>
    </section>
  )
}

/* ─────────────────── WHO I WORK WITH ─────────────────── */
function Audiences() {
  const { t } = useTranslation("home")
  return (
    <section className="py-20 lg:py-24">
      <Container>
        <SectionHeading
          eyebrow={t("sections.audiences.eyebrow")}
          title={t("sections.audiences.title")}
          subtitle={t("sections.audiences.subtitle")}
        />
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {audiences.map(({ titleKey, descriptionKey, icon: Icon }) => (
            <motion.div key={titleKey} variants={fadeUp}>
              <Card variant="interactive" padding="lg" className="group h-full">
                <div className="flex h-14 w-14 items-center justify-center rounded-[14px] bg-[var(--color-violet-pale)] text-[var(--color-violet)] transition-colors duration-[var(--motion-base)] group-hover:bg-[var(--color-violet)] group-hover:text-white">
                  <Icon className="h-7 w-7" aria-hidden="true" />
                </div>
                <h3 className="mt-5 text-[18px] font-bold leading-[1.3] text-[var(--color-violet)]">
                  {t(titleKey)}
                </h3>
                <p className="mt-2 text-[14px] leading-[1.6] text-[var(--color-text-secondary)]">
                  {t(descriptionKey)}
                </p>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </Container>
    </section>
  )
}

/* ─────────────────── SOLUTIONS OVERVIEW ─────────────────── */
function Solutions() {
  const { t } = useTranslation("home")
  return (
    // Inline background guarantees the dark surface even if `bg-charcoal`
    // utility isn't generated (was the cause of invisible white-on-cream text).
    <section className="py-20 lg:py-28" style={{ backgroundColor: "#1A1B23" }}>
      <Container>
        <div className="mb-14 flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-20">
          <div className="lg:max-w-[380px]">
            {/* Eyebrow, standardized shape; tone="violet-inverse" pattern for dark surfaces */}
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em]"
              style={{ backgroundColor: "rgba(233, 196, 106, 0.14)", color: "#E9C46A", border: "1px solid rgba(233, 196, 106, 0.30)" }}
            >
              {t("sections.solutions.eyebrow")}
            </span>
            <h2
              className="mt-4 text-[32px] font-bold leading-[1.05] tracking-tight sm:text-[44px] lg:text-[48px]"
              style={{ color: "#FFFFFF" }}
            >
              {t("sections.solutions.title")}
            </h2>
            <p className="mt-4 text-[15px] leading-[1.65]" style={{ color: "rgba(255, 255, 255, 0.78)" }}>
              {t("sections.solutions.subtitle")}
            </p>
            {/* Secondary outline button — Terracotta (yellow) border,
                white text, Royal Violet arrow icon. Subtle terracotta wash on hover. */}
            <Link
              to="/solutions"
              className="group mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold transition-all duration-200 hover:-translate-y-0.5"
              style={{
                color: "#FFFFFF",
                backgroundColor: "transparent",
                border: "2px solid #E9C46A",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(233, 196, 106, 0.12)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              {t("sections.solutions.cta")}
              {/* Violet Light #8B6FE8 — required for WCAG on dark surfaces
                  per Brand v3 § 04 ⚠ rule. #5D3FD3 fails 1.1:1 on charcoal. */}
              <ArrowRight
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                style={{ color: "#8B6FE8" }}
                aria-hidden="true"
              />
            </Link>
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-3"
          >
            {solutions.map(({ titleKey, icon: Icon }) => (
              <motion.div
                key={titleKey}
                variants={fadeUp}
                className="group flex flex-col gap-4 rounded-xl p-5 transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: "rgba(255, 255, 255, 0.06)", border: "1px solid rgba(255, 255, 255, 0.10)" }}
              >
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ backgroundColor: "rgba(93, 63, 211, 0.40)", color: "#E9C46A" }}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="text-[14px] font-semibold leading-[1.4] text-white">{t(titleKey)}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </Container>
    </section>
  )
}

/* ─────────────────── FEATURED PRODUCTS ─────────────────── */
function FeaturedProducts() {
  const { t } = useTranslation("home")
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await fetchProducts("")
        const arr = Array.isArray(data) ? data : []
        if (cancelled) return
        if (arr.length > 0) {
          const catMap = new Map()
          const sorted = [...arr].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
          for (const p of sorted) {
            const cat = p.category || "General"
            if (!catMap.has(cat)) catMap.set(cat, p)
          }
          let featured = Array.from(catMap.values()).slice(0, 6)
          if (featured.length < 6) {
            const extras = sorted.filter((p) => !featured.find((f) => f.id === p.id))
            featured = [...featured, ...extras].slice(0, 6)
          }
          setProducts(featured)
        }
      } catch (err) {
        console.warn("Featured products fetch failed:", err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <section className="py-20 lg:py-28">
      <Container>
        <SectionHeading
          eyebrow={t("sections.featuredProducts.eyebrow")}
          title={t("sections.featuredProducts.title")}
          subtitle={t("sections.featuredProducts.subtitle")}
          action={
            <Link to="/store" className="inline-flex items-center gap-1.5 rounded-xl border border-violet/20 px-5 py-2.5 text-meta font-semibold text-violet transition hover:bg-violet-pale">
              {t("sections.featuredProducts.cta")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          }
          align="left"
        />

        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton.Card key={i} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={t("sections.featuredProducts.emptyTitle")}
            description={t("sections.featuredProducts.emptyBody")}
            action={
              <Link
                to="/contact"
                className="inline-flex items-center gap-1.5 rounded-xl border border-violet/20 bg-white px-5 py-2.5 text-meta font-semibold text-violet transition hover:bg-violet-pale"
              >
                {t("sections.featuredProducts.emptyCta")}
              </Link>
            }
          />
        ) : (
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-40px" }} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <motion.div key={product.id} variants={fadeUp}>
                <ProductCard product={product} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </Container>
    </section>
  )
}

/* ─────────────────── FEATURED SERVICES ─────────────────── */
function FeaturedServices() {
  const { t } = useTranslation("home")
  const [services, setServices] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const items = await fetchFeaturedServices()
        if (!cancelled) setServices(Array.isArray(items) ? items.slice(0, 4) : [])
      } catch {
        /* silent */
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (!loaded || services.length === 0) return null

  const serviceIcons = [Globe, RefreshCcw, Server, Cloud]

  return (
    <section className="bg-mist py-20 lg:py-28">
      <Container>
        <SectionHeading
          eyebrow={t("sections.featuredServices.eyebrow")}
          title={t("sections.featuredServices.title")}
          subtitle={t("sections.featuredServices.subtitle")}
          action={
            <Link to="/services" className="inline-flex items-center gap-1.5 rounded-xl border border-violet/20 bg-white px-5 py-2.5 text-meta font-semibold text-violet transition hover:bg-violet-pale">
              {t("sections.featuredServices.cta")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          }
          align="left"
        />

        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-40px" }} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((svc, i) => {
            const Icon = serviceIcons[i % serviceIcons.length]
            return (
              <motion.div
                key={svc.id || svc.slug}
                variants={fadeUp}
                className="group flex flex-col gap-5 rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_8px_24px_rgba(93,63,211,0.05)] transition-all hover:-translate-y-1 hover:border-violet/30 hover:shadow-[0_18px_44px_rgba(93,63,211,0.10)]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet/10 text-violet transition group-hover:bg-violet group-hover:text-white">
                  <Icon className="h-5.5 w-5.5" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <h3 className="text-body font-bold text-violet">{svc.title}</h3>
                  <p className="mt-2 text-meta leading-6 text-charcoal-80/65 line-clamp-3">
                    {svc.shortDescription}
                  </p>
                </div>
                <Link
                  to={`/services/${svc.slug}`}
                  className="inline-flex items-center gap-1 self-start rounded-md text-meta font-semibold text-violet transition hover:gap-2 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
                >
                  {t("sections.featuredServices.learnMore")} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </motion.div>
            )
          })}
        </motion.div>
      </Container>
    </section>
  )
}

/* ─────────────────── FEATURED PORTFOLIO ─────────────────── */
function FeaturedPortfolio() {
  const { t } = useTranslation("home")
  const [items, setItems] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchFeaturedPortfolio(3)
        if (!cancelled) setItems(Array.isArray(data) ? data.slice(0, 3) : [])
      } catch {
        /* silent */
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (!loaded || items.length === 0) return null

  return (
    <section className="py-20 lg:py-28">
      <Container>
        <SectionHeading
          eyebrow={t("sections.featuredPortfolio.eyebrow")}
          title={t("sections.featuredPortfolio.title")}
          subtitle={t("sections.featuredPortfolio.subtitle")}
          action={
            <Link to="/about" className="inline-flex items-center gap-1.5 rounded-xl border border-violet/20 px-5 py-2.5 text-meta font-semibold text-violet transition hover:bg-violet-pale">
              {t("sections.featuredPortfolio.cta")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          }
          align="left"
        />

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-40px" }}
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {items.map((p, idx) => (
            <PortfolioCard key={p.id || p.slug} project={p} cardIndex={idx} />
          ))}
        </motion.div>
      </Container>
    </section>
  )
}

/* ─────────────────── PROCESS ─────────────────── */
function Process() {
  const { t } = useTranslation("home")
  return (
    <section className="bg-slate-100 py-20 lg:py-28">
      <Container>
        <SectionHeading
          eyebrow={t("sections.process.eyebrow")}
          title={t("sections.process.title")}
          subtitle={t("sections.process.subtitle")}
        />
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {processSteps.map(({ titleKey, descriptionKey, icon: Icon }, i) => (
            <motion.div key={titleKey} variants={fadeUp} className="relative flex flex-col gap-4 rounded-xl bg-white p-6 shadow-[0_6px_20px_rgba(93,63,211,0.06)] transition hover:-translate-y-0.5">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-pale text-violet">
                  {Icon ? <Icon className="h-5.5 w-5.5" aria-hidden="true" /> : null}
                </div>
                <span className="font-mono text-page font-bold tabular-nums text-violet/8">
                  0{i + 1}
                </span>
              </div>
              <div>
                <h3 className="text-body font-bold text-violet">{t(titleKey)}</h3>
                <p className="mt-1.5 text-meta leading-5 text-charcoal-80/65">{t(descriptionKey)}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </Container>
    </section>
  )
}

/* ─────────────────── TESTIMONIALS ─────────────────── */
function Testimonials() {
  const { t } = useTranslation("home")
  const [current, setCurrent] = useState(0)
  const showMarquee = testimonials.length >= 6

  useEffect(() => {
    if (!showMarquee) return
    const id = "ukz-home-marquee-css"
    if (document.getElementById(id)) return
    const el = document.createElement("style")
    el.id = id
    el.textContent = `
      @keyframes ukzHomeMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      .ukz-home-marquee { animation: ukzHomeMarquee 35s linear infinite; }
      .ukz-home-marquee-pause:hover .ukz-home-marquee { animation-play-state: paused; }
      @media (prefers-reduced-motion: reduce) { .ukz-home-marquee { animation: none; } }
    `
    document.head.appendChild(el)
  }, [showMarquee])

  const prev = () => setCurrent((c) => (c - 1 + testimonials.length) % testimonials.length)
  const next = () => setCurrent((c) => (c + 1) % testimonials.length)

  const visible = Array.from({ length: Math.min(4, testimonials.length) }, (_, i) =>
    testimonials[(current + i) % testimonials.length]
  )

  return (
    <section className="py-20 lg:py-28">
      <Container>
        <div className="mb-10 flex items-end justify-between">
          <SectionHeading
            eyebrow={t("sections.testimonials.eyebrow")}
            title={t("sections.testimonials.title")}
            subtitle={t("sections.testimonials.subtitle")}
            align="left"
          />
          {!showMarquee && (
            <div className="hidden shrink-0 gap-3 lg:flex">
              {[prev, next].map((fn, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={fn}
                  aria-label={i === 0 ? t("sections.testimonials.prevAria") : t("sections.testimonials.nextAria")}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-charcoal-80/15 bg-white text-violet shadow-sm transition hover:bg-violet hover:text-white focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
                >
                  {i === 0 ? <ArrowLeft className="h-4 w-4" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {showMarquee ? (
          <div className="ukz-home-marquee-pause overflow-hidden">
            <div className="ukz-home-marquee flex w-max gap-5">
              {[...testimonials, ...testimonials].map((t, i) => (
                <div key={`${t.name}-${i}`} className="w-[300px] shrink-0">
                  <TestimonialCard t={t} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {visible.map((t, i) => <TestimonialCard key={`${t.name}-${i}`} t={t} />)}
            </div>

            <div className="mt-6 flex justify-center gap-3 lg:hidden">
              {[prev, next].map((fn, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={fn}
                  aria-label={i === 0 ? t("sections.testimonials.prevAria") : t("sections.testimonials.nextAria")}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-charcoal-80/15 bg-white text-violet shadow-sm transition hover:bg-violet hover:text-white"
                >
                  {i === 0 ? <ArrowLeft className="h-4 w-4" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                </button>
              ))}
            </div>
          </>
        )}
      </Container>
    </section>
  )
}

function TestimonialCard({ t }) {
  // Local i18n alias `tx` — the testimonial object uses the `t` prop name
  // so we can't shadow it with the i18n hook. roleKey routes through tx.
  const { t: tx } = useTranslation("home")
  return (
    <div className="flex h-full flex-col gap-4 rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_8px_24px_rgba(93,63,211,0.05)]">
      <div className="flex gap-0.5 text-terracotta">
        {Array.from({ length: t.rating }).map((_, j) => (
          <Star key={j} className="h-4 w-4 fill-current" aria-hidden="true" />
        ))}
      </div>
      <p className="flex-1 text-meta leading-6 text-charcoal-80/75">"{t.text}"</p>
      <div className="flex items-center gap-3 border-t border-charcoal-80/8 pt-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet text-meta font-bold text-white">
          {t.initials}
        </div>
        <div>
          <div className="text-meta font-semibold text-violet">{t.name}</div>
          <div className="text-micro text-charcoal-80/55">{tx(t.roleKey)}</div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────── CTA — V3 · animated pill design ─────────────────── */
function CTA() {
  const { t } = useTranslation("home")
  const cardIn = {
    hidden: { opacity: 0, y: 40, scale: 0.96 },
    show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
  }
  const contentStagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08, delayChildren: 0.25 } },
  }
  const itemUp = {
    hidden: { opacity: 0, y: 18 },
    show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
  }

  return (
    <section className="py-16 lg:py-24">
      <Container>
        {/* CTA keyframes (.ukz-cta-bg, .ukz-ring, .ukz-sun, .ukz-shine,
            .ukz-ball-pulse) are defined globally in index.css so they
            parse once on app load instead of on every Home mount. */}

        <motion.div
          variants={cardIn}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="ukz-cta-bg relative overflow-hidden rounded-[28px] text-white shadow-[0_30px_80px_-20px_rgba(93,63,211,0.50)]"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-[28%] sm:block"
          >
            <div className="relative h-[640px] w-[640px]">
              <span className="ukz-ring ukz-ring-1 absolute inset-0 rounded-full bg-white/[0.06]" />
              <span className="ukz-ring ukz-ring-2 absolute inset-[7%] rounded-full bg-white/[0.08]" />
              <span className="ukz-ring ukz-ring-3 absolute inset-[14%] rounded-full bg-white/[0.10]" />
              <span className="ukz-ring ukz-ring-4 absolute inset-[22%] rounded-full bg-white/[0.13]" />
              <span className="ukz-ring ukz-ring-5 absolute inset-[31%] rounded-full bg-white/[0.17]" />
              <span className="ukz-ring ukz-ring-6 absolute inset-[42%] rounded-full bg-white/[0.22]" />
              <span className="ukz-ring ukz-ring-7 absolute inset-[55%] rounded-full bg-white/[0.30]" />
              <span className="ukz-sun absolute inset-[70%] rounded-full bg-white" />
            </div>
          </div>

          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="ukz-shine absolute inset-y-0 -left-1/4 w-1/3" />
          </div>

          <motion.div
            variants={contentStagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="relative px-8 py-16 sm:px-12 lg:px-16 lg:py-24"
          >
            <div className="max-w-[40ch]">
              {/* Standardized eyebrow — same shape, padding, font-size, and
                  tracking as every other eyebrow on Home (Audiences, Services,
                  Portfolio, Process, Testimonials). Tone is the inverse variant
                  for legibility on the violet gradient. */}
              <motion.span
                variants={itemUp}
                className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em]"
                style={{
                  backgroundColor: "rgba(233, 196, 106, 0.16)",
                  color: "#E9C46A",
                  border: "1px solid rgba(233, 196, 106, 0.32)",
                }}
              >
                {t("cta.eyebrow")}
              </motion.span>

              <h2 className="mt-4 text-display !text-white">
                <motion.span variants={itemUp} className="block">{t("cta.titleLine1")}</motion.span>
                <motion.span variants={itemUp} className="block">{t("cta.titleLine2")}</motion.span>
              </h2>

              <motion.p
                variants={itemUp}
                className="mt-4 max-w-md text-[15px] leading-[1.65] text-white/75"
              >
                {t("cta.body")}
              </motion.p>

              <motion.div variants={itemUp} className="mt-8 flex flex-wrap items-center gap-3">
                <CtaPill to="/book" label={t("cta.ctaBook")} icon={Calendar} />
                <CtaPill to="/store" label={t("cta.ctaStore")} icon={ShoppingBag} />
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      </Container>
    </section>
  )
}

function CtaPill({ to, label, icon: Icon = ArrowRight }) {
  return (
    <Link
      to={to}
      className="group inline-flex items-center gap-3 rounded-full py-1.5 pl-6 pr-1.5 text-white shadow-[0_10px_28px_rgba(0,0,0,0.30)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(0,0,0,0.42)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-terracotta/40 focus-visible:ring-offset-2 focus-visible:ring-offset-violet"
      style={{ backgroundColor: "#1A1B23" }}
    >
      <span className="text-[14px] font-bold">{label}</span>
      {/* Icon plate, Royal Violet → Deep Azure mini Innovation Gradient */}
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-300 ease-out group-hover:scale-110"
        style={{
          background: "linear-gradient(135deg, #5D3FD3 0%, #0284C7 100%)",
          boxShadow: "inset 0 -2px 3px rgba(0,0,0,0.18)",
        }}
      >
        <Icon className="h-4 w-4 text-white transition-transform duration-300 group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}

/* ─────────────────── PAGE ─────────────────── */
export default function Home() {
  const { t } = useTranslation("home")
  return (
    <>
      <Seo
        {...pageSeo.home}
        includeLocalBusiness
        noBreadcrumbs
        jsonLd={[siteNavigationSchema()]}
      />
      <HomeHero />
      <BuiltWithStrip />
      <RevealSection><Audiences /></RevealSection>
      <RevealSection><Solutions /></RevealSection>
      <RevealSection><FeaturedProducts /></RevealSection>
      <RevealSection><FeaturedServices /></RevealSection>
      <RevealSection><FeaturedPortfolio /></RevealSection>
      <RevealSection><Process /></RevealSection>
      <RevealSection><Testimonials /></RevealSection>
      {/* Real customer reviews admin has pinned. Renders nothing if zero. */}
      <FeaturedReviewsRibbon limit={6} />
      <RevealSection><CTA /></RevealSection>
    </>
  )
}
