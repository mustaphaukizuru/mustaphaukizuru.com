import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { responsiveSrcSet } from "./caseStudy"

function PagerCell({ item, dir }) {
  const { t } = useTranslation("portfolio")
  if (!item) return <div aria-hidden="true" />
  const isNext = dir === "next"
  return (
    <Link
      to={`/projects/${item.slug}`}
      rel={dir}
      className={`group flex items-center gap-4 rounded-2xl border border-charcoal-80/10 bg-white p-4 transition hover:-translate-y-0.5 hover:border-violet/30 hover:shadow-[0_12px_30px_rgba(93,63,211,0.10)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 ${isNext ? "flex-row-reverse text-right" : ""}`}
    >
      <div className="hidden h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-violet-pale sm:block">
        {item.coverImage ? (
          <img
            src={item.coverImage}
            srcSet={responsiveSrcSet(item.coverImage)}
            sizes="96px"
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className={`flex items-center gap-1 text-micro font-semibold uppercase tracking-[0.14em] text-violet/60 ${isNext ? "justify-end" : ""}`}>
          {!isNext ? <ArrowLeft className="h-3 w-3" aria-hidden="true" /> : null}
          {isNext ? t("detail.nextProject") : t("detail.prevProject")}
          {isNext ? <ArrowRight className="h-3 w-3" aria-hidden="true" /> : null}
        </div>
        <div className="mt-1 line-clamp-2 text-body font-bold text-violet group-hover:text-violet-deep">{item.title}</div>
      </div>
    </Link>
  )
}

/** ProjectPager · previous / next project navigation */
export default function ProjectPager({ prev, next }) {
  const { t } = useTranslation("portfolio")
  if (!prev && !next) return null
  return (
    <nav aria-label={`${t("detail.prevProject")} / ${t("detail.nextProject")}`} className="grid gap-4 sm:grid-cols-2">
      <PagerCell item={prev} dir="prev" />
      <PagerCell item={next} dir="next" />
    </nav>
  )
}
