import { useTranslation } from "react-i18next"
import { Star, Quote } from "lucide-react"
import { Container, SectionHeading } from "./home/primitives"

/**
 * TestimonialsMarquee · V2 — static named-testimonial grid (roadmap step 28)
 * ─────────────────────────────────────────────────────────────────────────
 * The file name is kept for import stability, but the 3D dual-row marquee
 * is gone: auto-scrolling content needs pause controls (WAI), competed with
 * the CTA below it, and ran two infinite animations on every Home visit.
 *
 * V2 renders three named cards (name · role · company). Entries flagged
 * `placeholder: true` in homeData get a `data-placeholder` attribute and a
 * visible "replace before launch" note so they can never pass for real
 * social proof by accident. Copy lives in home.json under
 * testimonials.items.<key>.
 */
export default function TestimonialsMarquee({ testimonials = [] }) {
  const { t } = useTranslation("home")
  if (!testimonials.length) return null

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
          {testimonials.slice(0, 3).map((item) => (
            <li key={item.key} className="h-full">
              <TestimonialCard item={item} t={t} />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}

function TestimonialCard({ item, t }) {
  const base = `testimonials.items.${item.key}`
  return (
    <figure
      data-placeholder={item.placeholder ? "true" : undefined}
      className="flex h-full flex-col gap-4 rounded-2xl border border-charcoal-80/8 bg-white p-6 shadow-[0_8px_28px_rgb(var(--color-violet-rgb)/0.06)]"
    >
      <div className="flex items-center justify-between">
        <div className="flex gap-0.5 text-terracotta" aria-label={`${item.rating} / 5`}>
          {Array.from({ length: 5 }).map((_, j) => (
            <Star
              key={j}
              className={`h-3.5 w-3.5 ${j < item.rating ? "fill-current" : "fill-none opacity-25"}`}
              aria-hidden="true"
            />
          ))}
        </div>
        <Quote className="h-5 w-5 text-violet/25" aria-hidden="true" />
      </div>

      <blockquote className="flex-1 text-[14px] leading-[1.65] text-charcoal-80/80">
        {t(`${base}.quote`)}
      </blockquote>

      <figcaption className="flex items-center gap-3 border-t border-charcoal-80/8 pt-4">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet text-[12px] font-bold text-white"
        >
          {item.initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-bold text-charcoal">{t(`${base}.name`)}</p>
          <p className="truncate text-[12px] text-charcoal-80/60">
            {t(`${base}.role`)} · {t(`${base}.company`)}
          </p>
        </div>
      </figcaption>

      {item.placeholder && (
        <p className="rounded-md bg-terracotta/15 px-2.5 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-charcoal/70">
          {t("testimonials.placeholderNote")}
        </p>
      )}
    </figure>
  )
}
