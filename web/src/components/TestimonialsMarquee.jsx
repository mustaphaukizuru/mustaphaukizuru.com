import { useTranslation } from "react-i18next"
import { Star } from "lucide-react"
import { useReducedMotion } from "framer-motion"

/**
 * TestimonialsMarquee · 3D dual-row infinite scrolling testimonials
 * ─────────────────────────────────────────────────────────────────────────
 * Design: 21st.dev / MagicUI "3D Marquee" pattern adapted for brand tokens.
 *
 * Layout:
 *   · Two rows of cards, row 1 scrolls LEFT, row 2 scrolls RIGHT
 *   · Container has a subtle 3D perspective tilt (CSS transform)
 *   · Edge fade masks (gradient overlays) for soft entry/exit
 *   · Pause on hover
 *   · prefers-reduced-motion: static grid fallback (4 cards)
 *
 * Props:
 *   testimonials  — array from homeData.js
 *   eyebrow, title, subtitle — section heading strings
 */
export default function TestimonialsMarquee({ testimonials = [], eyebrow, title, subtitle }) {
  const { t } = useTranslation("home")
  const reduced = useReducedMotion()

  if (!testimonials.length) return null

  /* Split into two rows — interleaved so they feel different */
  const row1 = testimonials.filter((_, i) => i % 2 === 0)
  const row2 = testimonials.filter((_, i) => i % 2 !== 0)

  /* Avatar gradient tints — cycles per position, brand-adjacent */
  const TINTS = [
    "from-violet to-violet-deep",
    "from-azure to-azure-deep",
    "from-[#3FB47E] to-[#2D8C5F]",
    "from-terracotta to-terracotta-deep",
    "from-[#8B6FE8] to-violet",
    "from-cyan to-azure",
  ]

  return (
    <section className="relative overflow-hidden py-20 lg:py-28">
      {/* Section header */}
      <div className="mx-auto mb-12 max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        {eyebrow && (
          <span className="inline-flex items-center rounded-full bg-violet-pale px-3 py-1 text-micro font-semibold uppercase tracking-[0.2em] text-violet">
            {eyebrow}
          </span>
        )}
        {title && (
          <h2 className="mt-4 text-section font-bold tracking-tight text-violet sm:text-page">
            {title}
          </h2>
        )}
        {subtitle && (
          <p className="mx-auto mt-3 max-w-xl text-body leading-7 text-charcoal-80/70">
            {subtitle}
          </p>
        )}
      </div>

      {/* Reduced-motion: simple 2×2 grid */}
      {reduced ? (
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-5 px-4 sm:px-6 lg:grid-cols-4 lg:px-8">
          {testimonials.slice(0, 4).map((item, i) => (
            <TestimonialCard key={item.name} item={item} tint={TINTS[i % TINTS.length]} />
          ))}
        </div>
      ) : (
        /* 3D marquee stage */
        <div
          className="group relative"
          style={{
            perspective: "1200px",
          }}
          aria-label={t("sections.testimonials.eyebrow")}
          role="region"
        >
          {/* Left + right edge fades */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 z-20 w-24 bg-gradient-to-r from-mist to-transparent sm:w-40"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 z-20 w-24 bg-gradient-to-l from-mist to-transparent sm:w-40"
          />

          {/* 3D tilt container */}
          <div
            style={{
              transform: "rotateX(8deg) scale(0.97)",
              transformOrigin: "center center",
            }}
            className="flex flex-col gap-4"
          >
            {/* Row 1 — scrolls LEFT */}
            <MarqueeRow items={[...row1, ...row1, ...row1]} tints={TINTS} direction="left" speed={36} />
            {/* Row 2 — scrolls RIGHT */}
            <MarqueeRow items={[...row2, ...row2, ...row2]} tints={TINTS} direction="right" speed={42} />
          </div>
        </div>
      )}
    </section>
  )
}

/* ── Single marquee row ──────────────────────────────────────────────── */
function MarqueeRow({ items, tints, direction, speed }) {
  const keyframes = `
    @keyframes ukz-testimonial-left  { from { transform: translateX(0); }    to { transform: translateX(-33.333%); } }
    @keyframes ukz-testimonial-right { from { transform: translateX(-33.333%); } to { transform: translateX(0); }   }
  `
  const trackStyle = {
    animation: `ukz-testimonial-${direction} ${speed}s linear infinite`,
    willChange: "transform",
  }

  return (
    <div className="overflow-hidden group-hover:[animation-play-state:paused]">
      <style>{keyframes}</style>
      <div
        className="flex gap-4"
        style={trackStyle}
      >
        {items.map((item, i) => (
          <div key={`${item.name}-${i}`} className="w-[300px] shrink-0 sm:w-[340px]">
            <TestimonialCard
              item={item}
              tint={tints[i % tints.length]}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Individual card ─────────────────────────────────────────────────── */
function TestimonialCard({ item, tint }) {
  const { t } = useTranslation("home")
  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl border border-charcoal-80/8 bg-white p-5 shadow-[0_8px_28px_rgba(93,63,211,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(93,63,211,0.12)]">
      {/* Stars */}
      <div className="flex gap-0.5 text-terracotta">
        {Array.from({ length: 5 }).map((_, j) => (
          <Star
            key={j}
            className={`h-3.5 w-3.5 ${j < item.rating ? "fill-current" : "fill-none opacity-25"}`}
            aria-hidden="true"
          />
        ))}
      </div>

      {/* Quote */}
      <p className="flex-1 text-[13.5px] leading-[1.65] text-charcoal-80/75">
        "{item.text}"
      </p>

      {/* Author */}
      <div className="flex items-center gap-3 border-t border-charcoal-80/6 pt-3.5">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${tint} text-[11px] font-bold text-white`}
        >
          {item.initials}
        </div>
        <div>
          <div className="text-[13px] font-bold text-violet">{item.name}</div>
          <div className="text-[11px] text-charcoal-80/50">{t(item.roleKey)}</div>
        </div>
      </div>
    </div>
  )
}
