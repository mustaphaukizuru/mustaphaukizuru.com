/* ════════════════════════════════════════════════════════════════════════
   StoreHero.jsx · Conversion-oriented hero with featured-products carousel
   ────────────────────────────────────────────────────────────────────────
   Left column · narrative + CTAs + trust strip (preserved):
     · "{t("hero.premiumDigital")}" eyebrow chip
     · Punchy H1 with terracotta accent on the value-prop word
     · Concise subhead
     · 5-star social-proof line with three honest brand claims
     · Primary "{t("hero.shopNow")}" (terracotta · highest contrast on violet bg)
     · Ghost "{t("hero.browseCategories")}" secondary CTA
     · 4-badge trust strip (Instant Download · Secure Checkout ·
       Money-Back · 24/7 Support)

   Right column · NEW · 3-card stack carousel showing featured products:
     · Front card: full image + title + price + View link
     · Two cards peeking behind, slightly rotated & scaled
     · Auto-advances every 5.5s · hover-pauses · keyboard ←/→
     · Coloured progress bar at bottom of front card
     · Dot navigation + prev/next buttons
     · Skeleton state when feed is empty (still ships gracefully)

   Props:
     · total              — current product count (honest, no "+")
     · featuredProducts   — array from fetchFeaturedProducts() (default [])
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { motion, useReducedMotion } from "framer-motion"
import {
  Sparkles, ArrowRight, Zap, ShieldCheck, RotateCcw, Headphones, Star,
  ChevronLeft, ChevronRight, ImageIcon, Package,
} from "lucide-react"
import { API_BASE_URL } from "../../lib/api"

/* ── Helpers ────────────────────────────────────────────────────────────── */

// Resolve a product's cover image URL (cover role first, fallback to first)
function resolveImg(product) {
  const imgs = Array.isArray(product?.images) ? product.images : []
  const img = imgs.find((i) => i?.imageRole === "cover") || imgs[0]
  if (!img?.url) return null
  return img.url.startsWith("http") ? img.url : `${API_BASE_URL}${img.url}`
}

// Format price · uses any pre-formatted string if the API provides one
function formatPrice(p) {
  if (typeof p?.priceFormatted === "string") return p.priceFormatted
  const v = Number(p?.price ?? 0)
  return `$${v.toFixed(2)}`
}

// Resolve a friendly category label across the various shapes
function resolveCategory(p) {
  return (
    p?.category?.name ||
    p?.categoryName ||
    (typeof p?.category === "string" ? p.category : "") ||
    "Digital Product"
  )
}

const STACK_DURATION = 5500 // ms between auto-advances

/* ────────────────────────────────────────────────────────────────────────
   Featured product card · single slide
   ──────────────────────────────────────────────────────────────────────── */
function FeaturedCard({ product, position, total }) {
  const { t } = useTranslation("store")
  const imgUrl = resolveImg(product)
  const cat = resolveCategory(product)
  const isFront = position === 0

  // Position-driven transform values
  const POSITIONS = {
    0: { scale: 1.00, rotate: 0, x: 0, y: 0, z: 30, opacity: 1 },
    1: { scale: 0.93, rotate: 5, x: 28, y: 18, z: 20, opacity: 0.6 },
    2: { scale: 0.86, rotate: -4, x: -24, y: 32, z: 10, opacity: 0.35 },
  }
  const s = POSITIONS[position] ?? POSITIONS[2]

  return (
    <motion.article
      initial={false}
      animate={{
        scale: s.scale,
        rotate: s.rotate,
        x: s.x,
        y: s.y,
        opacity: s.opacity,
      }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      style={{ zIndex: s.z }}
      className="absolute inset-0 mx-auto flex w-[88%] flex-col overflow-hidden rounded-3xl bg-white shadow-[0_24px_60px_rgba(0,0,0,0.30)] ring-1 ring-white/10 sm:w-[78%] lg:w-[86%]"
      aria-hidden={!isFront}
    >
      {/* Cover image area */}
      <div className="relative aspect-[5/3] w-full overflow-hidden bg-violet-pale">
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={product.title || "Featured product"}
            loading={isFront ? "eager" : "lazy"}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-pale to-terracotta/30">
            <ImageIcon className="h-14 w-14 text-violet/40" aria-hidden="true" />
          </div>
        )}

        {/* Featured pill · top-left */}
        <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-violet px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white shadow-md">
          <Star className="h-3 w-3 fill-current text-terracotta" aria-hidden="true" />
          Featured
        </div>

        {/* Category pill · top-right */}
        <div className="absolute right-3 top-3 inline-flex items-center rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-violet shadow-md backdrop-blur-sm">
          {cat}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="line-clamp-2 text-[16px] font-bold leading-tight !text-violet sm:text-[17px]">
          {product.title || "Untitled product"}
        </h3>
        {product.shortDescription && (
          <p className="line-clamp-2 text-[12px] leading-snug text-charcoal-80/65 sm:text-[12.5px]">
            {product.shortDescription}
          </p>
        )}

        {/* Price + CTA */}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-charcoal-80/8 pt-3">
          <div className="font-mono text-[22px] font-extrabold tabular-nums !text-violet">
            {formatPrice(product)}
          </div>
          <Link
            to={`/store/${product.slug || product.id}`}
            className="group/btn inline-flex items-center gap-1.5 rounded-full bg-violet px-4 py-2 text-[12px] font-bold !text-white shadow-md transition hover:-translate-y-0.5 hover:bg-violet-deep focus:outline-none focus-visible:ring-2 focus-visible:ring-violet/40"
            tabIndex={isFront ? 0 : -1}
          >
            {t("hero.viewProduct")}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>

        {/* Counter badge · "1 of 5" */}
        {isFront && total > 1 && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-charcoal-80/45">
            {t("hero.featuredLive")}
          </p>
        )}
      </div>
    </motion.article>
  )
}

/* ────────────────────────────────────────────────────────────────────────
   Skeleton placeholder · used when no featured products are available
   ──────────────────────────────────────────────────────────────────────── */
function FeaturedSkeleton({ reduce }) {
  const { t } = useTranslation("store")
  return (
    <div className="relative h-[440px] w-full sm:h-[460px] lg:h-[480px]">
      <div className="absolute inset-0 mx-auto flex w-[86%] flex-col overflow-hidden rounded-3xl bg-white/80 shadow-[0_18px_44px_rgba(0,0,0,0.18)] ring-1 ring-white/10 backdrop-blur-sm">
        <div className="relative aspect-[5/3] w-full overflow-hidden bg-gradient-to-br from-violet-pale to-terracotta/30">
          <motion.div
            aria-hidden="true"
            animate={reduce ? undefined : { x: ["-100%", "100%"] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
            className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Package className="h-12 w-12 text-violet/40" aria-hidden="true" />
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet/50">
              {t("hero.comingSoon")}
            </p>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-5">
          <div className="h-4 w-3/4 rounded-full bg-violet-pale" />
          <div className="h-3 w-full rounded-full bg-violet-pale/60" />
          <div className="h-3 w-2/3 rounded-full bg-violet-pale/60" />
          <div className="mt-auto flex items-center justify-between border-t border-charcoal-80/8 pt-3">
            <div className="h-6 w-20 rounded-full bg-violet-pale" />
            <div className="h-8 w-24 rounded-full bg-violet/30" />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────
   Featured products carousel · the right-side stack
   ──────────────────────────────────────────────────────────────────────── */
function FeaturedProductsCarousel({ products, reduce }) {
  const { t } = useTranslation("store")
  const total = Array.isArray(products) ? products.length : 0
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (reduce || paused || total <= 1) return
    intervalRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % total)
    }, STACK_DURATION)
    return () => clearInterval(intervalRef.current)
  }, [reduce, paused, total])

  function onKeyDown(e) {
    if (total <= 1) return
    if (e.key === "ArrowRight") {
      e.preventDefault()
      setCurrent((c) => (c + 1) % total)
    } else if (e.key === "ArrowLeft") {
      e.preventDefault()
      setCurrent((c) => (c - 1 + total) % total)
    }
  }

  if (total === 0) return <FeaturedSkeleton reduce={reduce} />

  // Build the visible stack (up to 3 cards: front, second, third)
  const stack = []
  for (let i = 0; i < Math.min(3, total); i++) {
    stack.push({ product: products[(current + i) % total], position: i })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto w-full max-w-[560px] lg:max-w-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label={t("hero.featuredAria")}
    >
      {/* Stack of cards · fixed-height so layout never jumps */}
      <div className="relative h-[440px] w-full sm:h-[460px] lg:h-[480px]">
        {/* Soft halo behind the stack */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 mx-auto h-full w-[80%] rounded-[44px] bg-gradient-to-br from-terracotta/20 via-transparent to-violet-deep/20 blur-2xl"
        />
        {stack.map(({ product, position }) => (
          <FeaturedCard
            key={product.id || product.slug || position}
            product={product}
            position={position}
            total={total}
          />
        ))}
      </div>

      {/* Auto-advance progress bar · resets per slide, pauses on hover */}
      {total > 1 && (
        <motion.div
          key={`${current}-${paused ? "p" : "r"}`}
          aria-hidden="true"
          initial={{ width: "0%" }}
          animate={paused || reduce ? { width: "0%" } : { width: "100%" }}
          transition={{
            duration: paused || reduce ? 0 : STACK_DURATION / 1000,
            ease: "linear",
          }}
          className="mt-4 h-[3px] rounded-full bg-terracotta"
        />
      )}

      {/* Controls · prev/next + dot nav */}
      {total > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCurrent((c) => (c - 1 + total) % total)}
            aria-label={t("hero.prevProductAria")}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/[0.06] !text-white backdrop-blur-sm transition hover:border-white/40 hover:bg-white/[0.12] focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/60"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>

          <div className="flex items-center gap-1.5">
            {products.map((_, i) => {
              const active = i === current
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrent(i)}
                  aria-label={`Show product ${i + 1}`}
                  aria-current={active ? "true" : undefined}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    active
                      ? "w-7 bg-terracotta"
                      : "w-2 bg-white/30 hover:bg-white/50"
                  }`}
                />
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => setCurrent((c) => (c + 1) % total)}
            aria-label={t("hero.nextProductAria")}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/[0.06] !text-white backdrop-blur-sm transition hover:border-white/40 hover:bg-white/[0.12] focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/60"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </motion.div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   COMPONENT
   ════════════════════════════════════════════════════════════════════════ */
export default function StoreHero({ total = 0, featuredProducts = [] }) {
  const { t } = useTranslation("store")
  const reduce = useReducedMotion()
  const productCount = String(Math.max(0, Number(total) || 0))

  return (
    <section
      className="relative overflow-hidden bg-gradient-to-br from-violet via-violet-deep to-charcoal-80 py-12 sm:py-16 lg:py-20"
      style={{ backgroundImage: "linear-gradient(135deg, #5D3FD3 0%, #4A2EAB 50%, #1A1B23 100%)" }}
    >

      {/* ── Animated background ──────────────────────────────────────── */}
      <motion.div
        aria-hidden="true"
        animate={reduce ? undefined : { x: [0, 30, 0], y: [0, 20, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/5 blur-3xl"
      />
      <motion.div
        aria-hidden="true"
        animate={reduce ? undefined : { x: [0, -22, 0], y: [0, 28, 0], scale: [1, 1.12, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", delay: 0.7 }}
        className="pointer-events-none absolute -bottom-16 left-1/3 h-56 w-56 rounded-full bg-terracotta/10 blur-2xl"
      />
      <motion.div
        aria-hidden="true"
        animate={reduce ? undefined : { x: [0, 24, 0], y: [0, -18, 0], opacity: [0.35, 0.75, 0.35] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1.4 }}
        className="pointer-events-none absolute right-1/3 top-1/2 h-48 w-48 rounded-full bg-white/[0.04] blur-3xl"
      />

      {/* Subtle grid + gradient sheen */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <motion.div
        aria-hidden="true"
        animate={reduce ? undefined : { backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        style={{
          backgroundImage:
            "linear-gradient(120deg, transparent 30%, rgba(233, 196, 106,0.06) 50%, transparent 70%)",
          backgroundSize: "200% 200%",
        }}
        className="pointer-events-none absolute inset-0"
      />

      {/* ── Content · aligned with site header rhythm ────────────────── */}
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">

          {/* LEFT · narrative + CTAs + trust strip (PRESERVED) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-6"
          >
            {/* Eyebrow */}
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-micro font-semibold uppercase tracking-[0.2em] text-terracotta ring-1 ring-white/10 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" /> {t("hero.premiumDigital")}
            </span>

            {/* Punchy H1 */}
            <h1 className="text-display text-white">
              {t("hero.headline")}{" "}
              <span className="text-terracotta">{t("hero.headlineAccent")}</span>
            </h1>

            {/* Subhead */}
            <p className="max-w-xl text-body leading-7 text-white/65">
              {t("hero.longSubtitle")}
            </p>

            {/* Social-proof line */}
            <div className="flex flex-wrap items-center gap-3 text-micro text-white/60">
              <span className="inline-flex items-center gap-1 text-terracotta" aria-label="five star rating">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current" />
                ))}
              </span>
              <span className="font-semibold text-white/85">{t("hero.trustCrafted")}</span>
              <span aria-hidden="true">&middot;</span>
              <span>{t("hero.trustCountries")}</span>
              <span aria-hidden="true">&middot;</span>
              <span>{productCount} {t("hero.productsLive")}</span>
            </div>

            {/* CTAs · primary + secondary
                Both jump to anchor sections that live on the Store page where
                StoreHero is mounted (id="products" for the grid, id="categories"
                for the filter rail). The `scroll-mt-*` utility on those targets
                offsets the sticky header so the section title isn't hidden. */}
            <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href="#products"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-terracotta px-7 py-4 text-[14px] font-bold !text-violet shadow-[0_14px_36px_rgba(233, 196, 106,0.30)] transition hover:-translate-y-0.5 hover:bg-[#ffd9be] focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/60 focus-visible:ring-offset-2 focus-visible:ring-offset-violet"
              >
                {t("hero.shopNow")}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </a>
              <a
                href="#categories"
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-white/25 bg-white/5 px-7 py-4 text-[14px] font-semibold !text-white backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-white/45 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                {t("hero.browseCategories")}
              </a>
            </div>

            {/* Trust strip · 4 badges (Instant Download · Secure Checkout · Money-Back · 24/7 Support) */}
            <ul
              className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-3 text-[12.5px] !text-white/75 sm:gap-x-6 sm:text-[13px]"
              aria-label={t("hero.guaranteesAria")}
            >
              <li className="inline-flex items-center gap-2">
                <Zap className="h-4 w-4 text-terracotta" aria-hidden="true" />
                {t("hero.instantDownload")}
              </li>
              <li className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-terracotta" aria-hidden="true" />
                {t("hero.secureCheckout")}
              </li>
              {/* <li className="inline-flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-terracotta" aria-hidden="true" />
                Money-back guarantee
              </li> */}
              <li className="inline-flex items-center gap-2">
                <Headphones className="h-4 w-4 text-terracotta" aria-hidden="true" />
                24/7 support
              </li>
            </ul>
          </motion.div>

          {/* RIGHT — Featured products carousel.
              FeaturedProductsCarousel is the 3-card stack with auto-advance,
              hover-pause, keyboard ← / →, dot nav, and progress bar.
              FeaturedSkeleton renders a graceful empty state when the feed
              is still loading or returns no products. */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto w-full max-w-md lg:max-w-none"
          >
            {Array.isArray(featuredProducts) && featuredProducts.length > 0 ? (
              <FeaturedProductsCarousel products={featuredProducts} reduce={reduce} />
            ) : (
              <FeaturedSkeleton reduce={reduce} />
            )}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
