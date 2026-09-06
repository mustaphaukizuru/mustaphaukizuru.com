/* Overview card for one of the 4 categories: outcome, offerings list, one
 * primary CTA (book a call) and a secondary "view details" link. */
import { LocalizedLink as Link } from "../LocalizedLink"
import { useTranslation } from "react-i18next"
import { ArrowRight } from "lucide-react"
import { pick, useCatalogueLang } from "./localize"
import OfferingList from "./OfferingList"
import { BookCallButton } from "./BookCallCta"
import MediaSlot from "../ui/MediaSlot"
import { accentFor } from "../ui/accent"

export default function CategoryCard({ category, index = 0 }) {
  const { t } = useTranslation("services")
  const lang = useCatalogueLang()
  const Icon = category.Icon

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-charcoal-80/10 bg-white shadow-[var(--shadow-e4)] transition-all hover:-translate-y-1 hover:border-violet/30 hover:shadow-[0_16px_40px_rgb(var(--color-violet-rgb)/0.12)]">
      {/* The category cover. Four categories carry the whole catalogue's
          visual weight — the 24 offerings under them inherit it rather than
          each needing their own photograph, which is the difference between
          four assets to source and twenty-four.

          Nothing has to exist for this to look right: MediaSlot draws
          on-brand generative art until the file is dropped at the path
          below. Swapping a real photograph in later is a file copy, not a
          code change. */}
      <MediaSlot
        src={`/images/services/${category.slug}.jpg`}
        alt=""
        seed={category.slug}
        accent={accentFor(category.accent)}
        aspectRatio="16 / 9"
        widths={[400, 800, 1200]}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        rounded=""
        className="border-b border-charcoal-80/10"
      />

      <div className="flex flex-1 flex-col p-6 sm:p-8">
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
      </div>
    </article>
  )
}
