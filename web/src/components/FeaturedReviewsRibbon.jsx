/* ════════════════════════════════════════════════════════════════════════
   FeaturedReviewsRibbon.jsx · social-proof strip for Home / About
   ────────────────────────────────────────────────────────────────────────
   Pulls admin-curated featured reviews and renders them as a 3-up grid on
   desktop, single-column carousel on mobile. Renders nothing if there are
   zero featured reviews — never shows an awkward empty state.

   Sprint-3 deliverable. Pinning happens from /admin/reviews → review
   detail panel → Featured toggle (already wired in Sprint 1).
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { m } from "framer-motion"
import { Star, Quote, ShieldCheck, Sparkles } from "lucide-react"
import { fetchFeaturedReviews } from "../services/reviewService"

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } } }
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } }

function StarRow({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-4 w-4 ${s <= rating ? "fill-terracotta text-terracotta" : "text-charcoal-80/20"}`}
        />
      ))}
    </div>
  )
}

function getInitials(name = "") {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?"
}

function ReviewCard({ review }) {
  const subject = review.subject
  const subjectHref = subject
    ? subject.type === "service"
      ? `/services/${subject.slug}`
      : `/store/${subject.slug}`
    : null

  return (
    <m.article
      variants={fadeUp}
      className="relative flex h-full flex-col rounded-2xl border border-violet/15 bg-white p-6 shadow-[0_8px_24px_rgba(93,63,211,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(93,63,211,0.10)]"
    >
      <Quote className="absolute right-5 top-5 h-7 w-7 text-violet/15" aria-hidden="true" />

      <div className="flex items-center gap-2">
        <StarRow rating={review.rating} />
        <span className="text-meta font-bold text-violet">{review.rating}.0</span>
        {review.isVerifiedPurchase && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-mint-600/10 px-2 py-0.5 text-micro font-bold text-mint-600">
            <ShieldCheck className="h-2.5 w-2.5" /> Verified
          </span>
        )}
      </div>

      {review.reviewText && (
        <p className="mt-4 line-clamp-6 text-meta leading-6 text-charcoal-80/85">
          {review.reviewText}
        </p>
      )}

      <div className="mt-auto flex items-center gap-3 pt-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet/10 text-xs font-bold text-violet">
          {getInitials(review.user?.fullName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-violet">
            {review.user?.fullName || "Anonymous"}
          </div>
          {subject && (
            <div className="mt-0.5 truncate text-micro text-charcoal-80/55">
              on{" "}
              {subjectHref ? (
                <Link to={subjectHref} className="font-semibold text-violet hover:underline">
                  {subject.title}
                </Link>
              ) : subject.title}
            </div>
          )}
        </div>
      </div>
    </m.article>
  )
}

/**
 * Drop-in social-proof ribbon. Renders nothing when there are no featured
 * reviews so it never adds awkward empty real estate to the layout.
 *
 * Props:
 *   limit       — how many reviews to fetch (default 6)
 *   eyebrow     — optional override for the eyebrow chip text
 *   title       — optional heading override
 *   subtitle    — optional intro paragraph
 *   tone        — "light" (default) or "dark" surface variant
 */
export default function FeaturedReviewsRibbon({
  limit = 6,
  eyebrow = "Loved by clients",
  title = "What people say",
  subtitle = "Hand-picked reviews from real engagements.",
  tone = "light",
}) {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let aborted = false
    ;(async () => {
      try {
        const data = await fetchFeaturedReviews({ limit })
        if (aborted) return
        setReviews(Array.isArray(data) ? data : [])
      } finally {
        if (!aborted) setLoading(false)
      }
    })()
    return () => { aborted = true }
  }, [limit])

  // Don't render anything if the API failed or admins haven't featured
  // anything yet. This component must never produce dead space.
  if (!loading && reviews.length === 0) return null

  const isDark = tone === "dark"
  const surface = isDark
    ? "bg-charcoal text-white"
    : "bg-violet-pale/30 text-charcoal-80"
  const eyebrowCls = isDark
    ? "bg-white/10 text-white/85"
    : "bg-violet-pale text-violet"
  const headingCls = isDark ? "!text-white" : "!text-violet"
  const subtitleCls = isDark ? "text-white/65" : "text-charcoal-80/70"

  return (
    <section className={`py-14 sm:py-16 ${surface}`}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <m.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="mb-10 flex flex-col items-center gap-3 text-center"
        >
          <m.span
            variants={fadeUp}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${eyebrowCls}`}
          >
            <Sparkles className="h-3 w-3" />
            {eyebrow}
          </m.span>
          <m.h2
            variants={fadeUp}
            className={`max-w-2xl text-[26px] font-bold leading-[1.15] tracking-tight sm:text-[32px] ${headingCls}`}
          >
            {title}
          </m.h2>
          {subtitle && (
            <m.p variants={fadeUp} className={`max-w-2xl text-[14px] leading-6 ${subtitleCls}`}>
              {subtitle}
            </m.p>
          )}
        </m.div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-2xl bg-violet-pale/50" />
            ))}
          </div>
        ) : (
          <m.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-50px" }}
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          >
            {reviews.map((review) => <ReviewCard key={review.id} review={review} />)}
          </m.div>
        )}
      </div>
    </section>
  )
}
