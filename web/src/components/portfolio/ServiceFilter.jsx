import { useTranslation } from "react-i18next"
import { Grid3x3, Briefcase } from "lucide-react"
import { SERVICE_SLUGS } from "./caseStudy"

/** ServiceFilter · chip row for the four service categories (+ All) */
export default function ServiceFilter({ value, onChange, counts = {} }) {
  const { t } = useTranslation("portfolio")
  const chip = (active) =>
    `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-micro font-semibold transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 ${
      active ? "bg-violet text-white" : "bg-violet-pale text-violet hover:bg-violet/10"
    }`
  return (
    <div role="group" aria-label={t("filters.byService")} className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => onChange(null)} className={chip(value === null)} aria-pressed={value === null}>
        <Grid3x3 className="h-3.5 w-3.5" aria-hidden="true" /> {t("filters.all")}
      </button>
      {SERVICE_SLUGS.map((slug) => (
        <button
          key={slug}
          type="button"
          onClick={() => onChange(slug)}
          className={chip(value === slug)}
          aria-pressed={value === slug}
        >
          <Briefcase className="h-3 w-3" aria-hidden="true" /> {t(`services.${slug}`)}
          {counts[slug] != null ? (
            <span className="ml-1 rounded-full bg-black/5 px-1.5 text-micro font-normal">{counts[slug]}</span>
          ) : null}
        </button>
      ))}
    </div>
  )
}
