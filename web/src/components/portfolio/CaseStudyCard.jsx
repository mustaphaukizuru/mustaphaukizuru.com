import { Link } from "react-router-dom"
import { m } from "framer-motion"
import { useTranslation } from "react-i18next"
import { Sparkles, ChevronRight, ExternalLink, Code2, Grid3x3, TrendingUp } from "lucide-react"
import { getCaseStudy, responsiveSrcSet, hasPlaceholder } from "./caseStudy"

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
}

/**
 * CaseStudyCard · PortfolioPage grid card.
 * Leads with the outcome line (numbers), not just the screenshot.
 */
export default function CaseStudyCard({ item }) {
  const { t } = useTranslation("portfolio")
  const cs = getCaseStudy(item)
  const outcomes = cs?.outcomes || []
  const outcomeLine = item.outcomeLine
    || (outcomes.length ? outcomes.slice(0, 2).map((o) => [o.value, o.label].filter(Boolean).join(" ")).join(" · ") : null)
  const placeholder = hasPlaceholder(outcomes)
  const service = cs?.serviceSlug

  return (
    <m.article
      variants={fadeUp}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-charcoal-80/10 bg-white shadow-[var(--shadow-e4)] transition-all hover:-translate-y-1 hover:shadow-[0_18px_40px_rgb(var(--color-violet-rgb)/0.12)]"
    >
      <Link to={`/projects/${item.slug}`} className="flex h-full flex-col focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30">
        {/* Cover */}
        <div className="relative aspect-[16/10] overflow-hidden bg-violet-pale">
          {item.coverImage ? (
            <m.img
              layoutId={`project-cover-${item.slug}`}
              src={item.coverImage}
              srcSet={responsiveSrcSet(item.coverImage)}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
              alt={item.title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-violet/40">
              <Grid3x3 className="h-10 w-10" aria-hidden="true" />
            </div>
          )}
          {item.isFeatured ? (
            <div className="absolute left-3 top-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-terracotta px-2.5 py-0.5 text-micro font-bold text-violet-deep">
                <Sparkles className="h-2.5 w-2.5" aria-hidden="true" /> {t("card.featured")}
              </span>
            </div>
          ) : null}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col p-5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-micro font-semibold uppercase tracking-[0.15em] text-violet">
            <span>{service ? t(`services.${service}`) : item.category}</span>
            {item.year ? <span className="text-charcoal-80/40">· {item.year}</span> : null}
          </div>
          <h3 className="mt-2 line-clamp-2 text-card font-bold text-violet group-hover:text-violet-deep">
            {item.title}
          </h3>

          {/* Outcome line — the point of a case study */}
          {outcomeLine ? (
            <p
              data-placeholder={placeholder ? "true" : undefined}
              className="mt-3 flex items-start gap-2 rounded-xl bg-violet-ghost px-3 py-2 text-meta font-semibold leading-5 text-violet"
            >
              <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-azure" aria-hidden="true" />
              <span>
                <span className="sr-only">{t("card.outcome")}: </span>
                {outcomeLine}
                {placeholder ? <span className="ml-1 font-normal text-charcoal-80/65">({t("card.placeholderShort")})</span> : null}
              </span>
            </p>
          ) : null}

          <p className="mt-3 line-clamp-2 flex-1 text-meta leading-6 text-charcoal-80/70">
            {cs?.problem || item.shortDescription}
          </p>

          <div className="mt-4 flex items-center justify-between">
            <span className="inline-flex items-center gap-1 text-micro font-semibold text-violet">
              {t("card.caseStudy")} <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="inline-flex items-center gap-3">
              {item.liveUrl ? (
                <span className="inline-flex items-center gap-1 text-micro text-charcoal-80/65">
                  <ExternalLink className="h-3 w-3" aria-hidden="true" /> {t("card.live")}
                </span>
              ) : null}
              {item.repoUrl ? (
                <span className="inline-flex items-center gap-1 text-micro text-charcoal-80/65">
                  <Code2 className="h-3 w-3" aria-hidden="true" /> {t("card.repo")}
                </span>
              ) : null}
            </span>
          </div>
        </div>
      </Link>
    </m.article>
  )
}
