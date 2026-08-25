/* Overview card for one of the 4 categories: outcome, offerings list, one
 * primary CTA (book a call) and a secondary "view details" link. */
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ArrowRight } from "lucide-react"
import { pick, useCatalogueLang } from "./localize"
import OfferingList from "./OfferingList"
import { BookCallButton } from "./BookCallCta"

export default function CategoryCard({ category, index = 0 }) {
  const { t } = useTranslation("services")
  const lang = useCatalogueLang()
  const Icon = category.Icon

  return (
    <article className="group flex h-full flex-col rounded-2xl border border-charcoal-80/10 bg-white p-6 shadow-[0_8px_24px_rgb(var(--color-violet-rgb)/0.05)] transition-all hover:-translate-y-1 hover:border-violet/30 hover:shadow-[0_16px_40px_rgb(var(--color-violet-rgb)/0.12)] sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl text-white ${category.tile}`}>
          {Icon && <Icon className="h-6 w-6" aria-hidden="true" />}
        </div>
        <span className="text-[13px] font-bold tabular-nums text-violet">0{index + 1}</span>
      </div>
      <h3 className="mt-5 text-title font-bold text-violet">{pick(category, "name", lang)}</h3>
      <p className="mt-2 text-body leading-7 text-charcoal-80/75">{pick(category, "outcome", lang)}</p>

      <OfferingList offerings={category.offerings} compact />

      <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
        <BookCallButton slug={category.slug} />
        <Link
          to={`/services/${category.slug}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet hover:underline"
        >
          {t("funnel.viewCategory")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  )
}
