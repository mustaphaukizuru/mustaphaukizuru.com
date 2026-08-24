/* Offerings of one category, rendered as a list of compact rows. */
import { useTranslation } from "react-i18next"
import { Clock, Tag, CheckCircle2 } from "lucide-react"
import { pick, pricingLabel, useCatalogueLang } from "./localize"

export default function OfferingList({ offerings = [], compact = false }) {
  const { t } = useTranslation("services")
  const lang = useCatalogueLang()

  if (compact) {
    return (
      <ul className="mt-4 space-y-2">
        {offerings.map((o) => (
          <li key={o.id} className="flex items-start gap-2 text-meta text-charcoal-80/80">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet" aria-hidden="true" />
            <span>{pick(o, "name", lang)}</span>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <ol className="divide-y divide-charcoal-80/10 overflow-hidden rounded-2xl border border-charcoal-80/10 bg-white">
      {offerings.map((o, idx) => (
        <li key={o.id} id={o.slug} className="grid gap-4 p-5 sm:grid-cols-[48px_1fr_auto] sm:p-6">
          <div className="text-[13px] font-bold tabular-nums text-violet/50">{String(idx + 1).padStart(2, "0")}</div>
          <div className="min-w-0">
            <h3 className="text-body font-bold text-violet">{pick(o, "name", lang)}</h3>
            <p className="mt-1 text-meta leading-6 text-charcoal-80/70">{pick(o, "description", lang)}</p>
            {Array.isArray(o.deliverables) && o.deliverables.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {pick(o, "deliverables", lang).map((d) => (
                  <li key={d} className="rounded-full bg-mist px-2.5 py-1 text-micro text-charcoal-80/70">{d}</li>
                ))}
              </ul>
            )}
          </div>
          <dl className="flex gap-4 text-micro text-charcoal-80/60 sm:flex-col sm:items-end sm:gap-1.5">
            <div className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              <dt className="sr-only">{t("funnel.durationLabel")}</dt>
              <dd>{pick(o, "duration", lang)}</dd>
            </div>
            <div className="inline-flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" aria-hidden="true" />
              <dt className="sr-only">{t("funnel.pricingLabel")}</dt>
              <dd>{pricingLabel(t, o.pricingModel)}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ol>
  )
}
