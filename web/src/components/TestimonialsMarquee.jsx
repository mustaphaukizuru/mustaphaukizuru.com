import { useTranslation } from "react-i18next"
import { Star, Quote, BadgeCheck } from "lucide-react"
import { Container, SectionHeading } from "./home/primitives"

/**
 * TestimonialsMarquee · V3 — featured reviews from the API (Tier 3)
 * ─────────────────────────────────────────────────────────────────────────
 * The file name is kept for import stability. V2 rendered three named
 * cards from i18n placeholders; V3 takes the shaped rows of
 * GET /api/v1/reviews/featured (approved + admin-featured) and renders
 * nothing while there are none, so the page never shows invented social
 * proof. Each card: stars · quote · reviewer · what they bought
 * (product/service title) · verified-purchase badge.
 */
export default function TestimonialsMarquee({ testimonials = [] }) {
  const { t } = useTranslation("home")
  const items = Array.isArray(testimonials) ? testimonials.filter((r) => r && r.reviewText) : []
  if (!items.length) return null

  return (
    <section className="bg-mist py-20 lg:py-24" aria-labelledby="home-testimonials-heading">
      <Container>
        <SectionHeading
          id="home-testimonials-heading"
          eyebrow={t("testimonials.eyebrow")}
          title={t("testimonials.title")}
          subtitle={t("testimonials.subtitle")}
          align="center"
        />
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.slice(0, 6).map((item) => (
            <li key={item.id} className="h-full">
              <TestimonialCard item={item} t={t} />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}

function initialsOf(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "—"
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join("")
}

function TestimonialCard({ item, t }) {
  const rating = Math.max(0, Math.min(5, Number(item.rating) || 0))
  const name = item.user?.fullName || t("testimonials.anonymous")
  const subject = item.subject?.title || ""

  return (
    <figure className="flex h-full flex-col gap-4 rounded-2xl border border-charcoal-80/8 bg-white p-6 shadow-[var(--shadow-e4)]">
      <div className="flex items-center justify-between">
        <div className="flex gap-0.5 text-terracotta" aria-label={`${rating} / 5`}>
          {Array.from({ length: 5 }).map((_, j) => (
            <Star
              key={j}
              className={`h-3.5 w-3.5 ${j < rating ? "fill-current" : "fill-none opacity-25"}`}
              aria-hidden="true"
            />
          ))}
        </div>
        <Quote className="h-5 w-5 text-violet/25" aria-hidden="true" />
      </div>

      <blockquote className="flex-1 text-[14px] leading-[1.65] text-charcoal-80/80">
        {item.reviewText}
      </blockquote>

      <figcaption className="flex items-center gap-3 border-t border-charcoal-80/8 pt-4">
        {item.user?.avatarUrl ? (
          <img
            src={item.user.avatarUrl}
            alt=""
            loading="lazy"
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet text-[12px] font-bold text-white"
          >
            {initialsOf(name)}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-bold text-charcoal">{name}</p>
          <p className="flex min-w-0 items-center gap-1 truncate text-[12px] text-charcoal-80/65">
            {item.isVerifiedPurchase && (
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-violet" aria-label={t("testimonials.verified")} />
            )}
            <span className="truncate">{subject || t("testimonials.client")}</span>
          </p>
        </div>
      </figcaption>
    </figure>
  )
}
