import { useEffect, useRef, useState } from "react"
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
  Calendar, ShoppingBag, Clock, BookOpen,
} from "lucide-react"
import { fetchProducts } from "../services/productService"
import { fetchFeaturedServices } from "../services/serviceService"
import { fetchFeaturedPortfolio } from "../services/portfolioService"
import { API_BASE_URL, apiRequest } from "../lib/api"
import { audiences, processSteps, testimonials } from "../data/homeData"
import ProductCard from "../components/ProductCard"
import HomeHero from "../components/heroes/HomeHero" // V2, universal hero
import { getAllPosts, BLOG_CATEGORIES } from "../data/blogPostsData"
import TestimonialsMarquee from "../components/TestimonialsMarquee"
import BlogCoverGradient from "../components/BlogCoverGradient"
import HomeStatsStrip from "../components/HomeStatsStrip"
import TechStackShowcase from "../components/TechStackShowcase"
import SpotlightCard from "../components/motion/SpotlightCard"
import MagneticButton from "../components/motion/MagneticButton"
import Meteors from "../components/motion/Meteors"
import AnimatedBeam from "../components/motion/AnimatedBeam"

// Design-system primitives (Phase B · v1.0)
import { Card, EmptyState, Skeleton } from "../components/system"

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

/* ─────────────────── WHO I WORK WITH ─────────────────── */
/* Pastel sibling tints (reference audit 2026-07): uniform white card grids
   read flat; the reference sites differentiate siblings with soft brand
   washes. Three tints = the three permitted hues per viewport (Brand v3
   §08): violet ghost, azure pale, terracotta wash. Inline style because
   the Card primitive hard-codes bg via CSS var — inline always wins. */
const AUDIENCE_TINTS = ["#F5F2FE", "rgba(224,242,254,0.55)", "rgba(233,196,106,0.12)"]

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
          {audiences.map(({ titleKey, descriptionKey, icon: Icon }, i) => (
            <motion.div key={titleKey} variants={fadeUp}>
              <Card
                variant="interactive"
                padding="lg"
                className="group h-full"
                style={{ backgroundColor: AUDIENCE_TINTS[i % AUDIENCE_TINTS.length] }}
              >
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
              <motion.div key={svc.id || svc.slug} variants={fadeUp}>
              <SpotlightCard
                className="group flex flex-col gap-5 rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_8px_24px_rgba(93,63,211,0.05)] transition-all hover:-translate-y-1 hover:border-violet/30 hover:shadow-[0_18px_44px_rgba(93,63,211,0.10)] h-full"
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
              </SpotlightCard>
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
/* Same pastel-sibling treatment as Audiences — four steps cycle through
   the three permitted hues (violet twice, at two densities). */
const PROCESS_TINTS = ["bg-violet-ghost", "bg-azure-pale/50", "bg-terracotta/10", "bg-violet-pale/40"]

function Process() {
  const { t } = useTranslation("home")
  const containerRef = useRef(null)
  const step1Ref = useRef(null)
  const step2Ref = useRef(null)
  const step3Ref = useRef(null)
  const step4Ref = useRef(null)
  const stepRefs = [step1Ref, step2Ref, step3Ref, step4Ref]

  return (
    <section className="bg-mist py-20 lg:py-28">
      <Container>
        <SectionHeading
          eyebrow={t("sections.process.eyebrow")}
          title={t("sections.process.title")}
          subtitle={t("sections.process.subtitle")}
        />
        <motion.div
          ref={containerRef}
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="relative grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {processSteps.map(({ titleKey, descriptionKey, icon: Icon }, i) => (
            <motion.div key={titleKey} ref={stepRefs[i]} variants={fadeUp} className={`relative flex flex-col gap-4 rounded-xl ${PROCESS_TINTS[i % PROCESS_TINTS.length]} ring-1 ring-charcoal-80/8 p-6 shadow-[0_6px_20px_rgba(93,63,211,0.06)] transition hover:-translate-y-0.5`}>
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

          {/* Animated gradient connectors flowing through the gaps between steps — lg+ only */}
          <AnimatedBeam
            className="hidden lg:block"
            containerRef={containerRef}
            fromRef={step1Ref}
            toRef={step2Ref}
            fromAnchor="right"
            toAnchor="left"
            duration={4}
            delay={0}
            pathWidth={3}
            pathOpacity={0.1}
          />
          <AnimatedBeam
            className="hidden lg:block"
            containerRef={containerRef}
            fromRef={step2Ref}
            toRef={step3Ref}
            fromAnchor="right"
            toAnchor="left"
            duration={4}
            delay={0.3}
            pathWidth={3}
            pathOpacity={0.1}
          />
          <AnimatedBeam
            className="hidden lg:block"
            containerRef={containerRef}
            fromRef={step3Ref}
            toRef={step4Ref}
            fromAnchor="right"
            toAnchor="left"
            duration={4}
            delay={0.6}
            pathWidth={3}
            pathOpacity={0.1}
          />
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
              {[...testimonials, ...testimonials].map((item, i) => (
                <div key={`${item.name}-${i}`} className="w-[300px] shrink-0">
                  <TestimonialCard testimonial={item} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {visible.map((item, i) => <TestimonialCard key={`${item.name}-${i}`} testimonial={item} />)}
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

function TestimonialCard({ testimonial }) {
  const { t } = useTranslation("home")
  return (
    <div className="flex h-full flex-col gap-4 rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_8px_24px_rgba(93,63,211,0.05)]">
      <div className="flex gap-0.5 text-terracotta">
        {Array.from({ length: testimonial.rating }).map((_, j) => (
          <Star key={j} className="h-4 w-4 fill-current" aria-hidden="true" />
        ))}
      </div>
      <p className="flex-1 text-meta leading-6 text-charcoal-80/75">"{testimonial.text}"</p>
      <div className="flex items-center gap-3 border-t border-charcoal-80/8 pt-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet text-meta font-bold text-white">
          {testimonial.initials}
        </div>
        <div>
          <div className="text-meta font-semibold text-violet">{testimonial.name}</div>
          <div className="text-micro text-charcoal-80/55">{t(testimonial.roleKey)}</div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────── LATEST BLOG POSTS ─────────────────── */
function LatestBlogPosts() {
  const { t } = useTranslation("home")
  const [posts, setPosts] = useState(null)

  useEffect(() => {
    let cancelled = false
    apiRequest("/api/v1/blog?limit=3")
      .then((data) => {
        if (!cancelled && data?.posts?.length) setPosts(data.posts.slice(0, 3))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Fall back to bundled static data while the API resolves (or if it fails)
  const displayPosts = posts || getAllPosts().slice(0, 3)

  return (
    <section className="py-20 lg:py-28">
      <Container>
        {/* Section header */}
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3">
            <span className="inline-flex w-fit items-center rounded-full bg-violet-pale px-3 py-1 text-micro font-semibold uppercase tracking-[0.2em] text-violet">
              <BookOpen className="mr-1.5 h-3 w-3" aria-hidden="true" />
              {t("sections.blog.eyebrow")}
            </span>
            <h2 className="text-section font-bold tracking-tight text-violet sm:text-page">
              {t("sections.blog.title")}
            </h2>
            <p className="max-w-2xl text-body leading-7 text-charcoal-80/70">
              {t("sections.blog.subtitle")}
            </p>
          </div>
          <Link
            to="/blog"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-violet/20 px-5 py-2.5 text-meta font-semibold text-violet transition hover:bg-violet-pale"
          >
            {t("sections.blog.cta")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {/* 3-column card grid */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-40px" }}
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {displayPosts.map((post) => {
            const cat = BLOG_CATEGORIES.find((c) => c.slug === post.category)
            const date = post.publishedAt
              ? new Date(post.publishedAt).toLocaleDateString("en-US", {
                  year: "numeric", month: "short", day: "numeric",
                })
              : null
            return (
              <motion.div key={post.slug} variants={fadeUp}>
                <Link
                  to={`/blog/${post.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-charcoal-80/10 bg-white shadow-[0_6px_20px_rgba(93,63,211,0.06)] transition hover:-translate-y-0.5 hover:border-violet/25 hover:shadow-[0_16px_40px_-12px_rgba(93,63,211,0.18)]"
                >
                  {/* Cover — generated gradient illustration (replaces thin accent band) */}
                  <BlogCoverGradient
                    title={post.title}
                    category={cat?.label || ""}
                    accent={cat?.accent || "#5D3FD3"}
                    readMinutes={post.readMinutes}
                    aspectRatio="16 / 7"
                  />

                  <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
                    {/* Title */}
                    <h3 className="line-clamp-2 text-[16.5px] font-bold leading-snug text-violet group-hover:text-violet-deep">
                      {post.title}
                    </h3>

                    {/* Excerpt */}
                    <p className="line-clamp-3 flex-1 text-[13px] leading-6 text-charcoal-80/65">
                      {post.excerpt}
                    </p>

                    {/* Date + arrow */}
                    <div className="flex items-center justify-between border-t border-charcoal-80/8 pt-3">
                      {date ? (
                        <span className="flex items-center gap-1.5 text-[11.5px] text-charcoal-80/45">
                          <Calendar className="h-3 w-3" aria-hidden="true" />
                          {date}
                        </span>
                      ) : <span />}
                      <span className="inline-flex items-center gap-1 text-[12px] font-bold text-violet">
                        {t("sections.blog.read")}
                        <ArrowRight
                          className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </motion.div>

        {/* RSS feed discovery link */}
        <p className="mt-8 text-center text-[12px] text-charcoal-80/40">
          Subscribe via{" "}
          <a
            href="/feed.xml"
            className="font-mono text-violet/70 underline underline-offset-2 transition hover:text-violet"
            target="_blank"
            rel="noopener noreferrer"
          >
            RSS feed
          </a>
        </p>
      </Container>
    </section>
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

              {/* Human signature (reference audit 2026-07): a personal brand
                  closes with the person, not just buttons. */}
              <motion.div variants={itemUp} className="mt-6 flex items-center gap-3">
                <img
                  src="/images/profile/Ukizuru_Mustapha_Photo.jpg"
                  alt=""
                  aria-hidden="true"
                  width={44}
                  height={44}
                  loading="lazy"
                  className="h-11 w-11 rounded-full object-cover ring-2 ring-white/30"
                />
                <div>
                  <p className="text-[13px] font-bold leading-tight text-white">Mustapha Ukizuru</p>
                  <p className="text-[12px] leading-tight text-white/65">
                    {t("cta.signature", { defaultValue: "Your single point of contact — no handoffs, no agencies." })}
                  </p>
                </div>
              </motion.div>

              <motion.div variants={itemUp} className="mt-8 flex flex-wrap items-center gap-3">
                <MagneticButton><CtaPill to="/book" label={t("cta.ctaBook")} icon={Calendar} /></MagneticButton>
                <MagneticButton><CtaPill to="/store" label={t("cta.ctaStore")} icon={ShoppingBag} /></MagneticButton>
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
      className="group inline-flex items-center gap-3 rounded-full bg-charcoal py-1.5 pl-6 pr-1.5 text-white shadow-[0_10px_28px_rgba(0,0,0,0.30)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(0,0,0,0.42)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-terracotta/40 focus-visible:ring-offset-2 focus-visible:ring-offset-violet"
    >
      <span className="text-[14px] font-bold">{label}</span>
      {/* Icon orb — Dawn gradient (Brand v3 §06 permits Dawn for "hero
          sections, premium surfaces, launch banners"). Switched from the
          Sacred Innovation Gradient because §08 expressly forbids that
          gradient as an icon fill — "Never use it for ... icon fills."
          The conversion CTA itself (the dark pill surface + label) reads
          as the actionable element; the orb is decorative reinforcement. */}
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-grad-dawn transition-all duration-300 ease-out group-hover:scale-110"
        style={{ boxShadow: "inset 0 -2px 3px rgba(0,0,0,0.18)" }}
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

      {/* Tools & tech I build with — branded skill-card grid below hero */}
      <TechStackShowcase />

      {/* Key metrics — 8+ years, 47 projects, 4 countries, 100+ students */}
      <RevealSection><HomeStatsStrip /></RevealSection>

      <RevealSection><Audiences /></RevealSection>
      <RevealSection><FeaturedProducts /></RevealSection>
      <RevealSection><FeaturedServices /></RevealSection>
      <RevealSection><FeaturedPortfolio /></RevealSection>
      <RevealSection><Process /></RevealSection>

      {/* Testimonials — 3D dual-row animated marquee (replaces static grid) */}
      <RevealSection>
        <TestimonialsMarquee
          testimonials={testimonials}
          eyebrow={t("sections.testimonials.eyebrow")}
          title={t("sections.testimonials.title")}
          subtitle={t("sections.testimonials.subtitle")}
        />
      </RevealSection>

      {/* FeaturedReviewsRibbon removed (reference audit 2026-07): two
          back-to-back social-proof sections diluted each other. The
          marquee above is now the single testimonial moment on Home;
          pinned reviews still render on the About page. */}
      <RevealSection><LatestBlogPosts /></RevealSection>

      {/* NewsletterSection removed from Home (2026-07): two consecutive
          dark conversion bands (newsletter + gradient CTA) diluted each
          other, and the Footer's newsletter band already captures email
          on every page. */}
      <RevealSection><CTA /></RevealSection>
    </>
  )
}
