/* Offerings of one category, rendered as a list of compact rows. */
import { useTranslation } from "react-i18next"
import { Clock, Tag, CheckCircle2, ChevronDown } from "lucide-react"
import { LocalizedLink as Link } from "../LocalizedLink"
import { pick, offeringPriceLabel, useCatalogueLang } from "./localize"
import { getServiceById, packagesIncluding, planEnquiryHref, isQuoteOnlyTier, AUDIENCE_PRICING_PLANS } from "../../data/servicesCatalogue"

/** "Included in Business Basic and above" — or nothing, for the offerings
 *  that are sold one way only, which is most of them. */
function PackageInclusion({ offeringSlug }) {
  const { t } = useTranslation("services")
  const inclusions = packagesIncluding(offeringSlug)
  if (!inclusions.length) return null

  return (
    <p className="mt-3 text-micro leading-5 text-charcoal-80/75">
      {inclusions.map((inc, i) => {
        const tiers = AUDIENCE_PRICING_PLANS[inc.audience]?.tiers || {}
        const price = tiers[inc.tierKey]?.priceMxn
        // A quote-only tier has no checkout to link to; it goes to the call.
        const href = isQuoteOnlyTier(inc.audience, inc.tierKey, price)
          ? planEnquiryHref(inc.audience, inc.tierKey)
          : `/checkout/service?audience=${inc.audience}&tier=${inc.tierKey}`
        return (
          <span key={`${inc.audience}.${inc.tierKey}`}>
            {i > 0 && " "}
            {t("funnel.includedIn.prefix")}{" "}
            <Link to={href} className="font-semibold text-violet underline-offset-2 hover:underline">
              {t("funnel.includedIn.plan", { plan: inc.planName, tier: inc.tierName })}
            </Link>
            {t("funnel.includedIn.suffix")}
          </span>
        )
      })}
    </p>
  )
}

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
          <div className="text-[13px] font-bold tabular-nums text-violet">{String(idx + 1).padStart(2, "0")}</div>
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
            {/* T2-11 · five capabilities are sold both as a standalone
                offering and inside a monthly package, at different prices. A
                reader comparing the two pages reached two numbers with
                nothing acknowledging the other. This is the offering end of
                the relation; the checkout's feature list is the other. */}
            <PackageInclusion offeringSlug={o.slug} />
            {(o.priceIncludes || o.priceFromMxn || (Array.isArray(o.relatedOfferings) && o.relatedOfferings.length > 0)) && (
              <details className="group mt-3">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-micro font-semibold text-violet hover:text-violet-deep">
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
                  {t("funnel.priceDetail.toggle")}
                </summary>
                <div className="mt-2.5 rounded-xl bg-mist p-3.5">
                  {pick(o, "priceIncludes", lang) && (
                    <p className="text-micro leading-5 text-charcoal-80/75">{pick(o, "priceIncludes", lang)}</p>
                  )}
                  {Array.isArray(o.priceScalesWith) && o.priceScalesWith.length > 0 && (
                    <>
                      <p className="mt-2.5 text-micro font-semibold text-charcoal-80/85">{t("funnel.priceDetail.scalesWith")}</p>
                      <ul className="mt-1 space-y-1">
                        {pick(o, "priceScalesWith", lang).map((factor) => (
                          <li key={factor} className="flex items-start gap-1.5 text-micro leading-5 text-charcoal-80/70">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-violet/50" aria-hidden="true" />
                            {factor}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {Array.isArray(o.relatedOfferings) && o.relatedOfferings.length > 0 && (
                    <>
                      <p className="mt-2.5 text-micro font-semibold text-charcoal-80/85">{t("funnel.priceDetail.related")}</p>
                      <ul className="mt-1 flex flex-wrap gap-1.5">
                        {o.relatedOfferings.map((relId) => {
                          const rel = getServiceById(relId)
                          if (!rel) return null
                          return (
                            <li key={relId}>
                              <a
                                href={`/services/${rel.categorySlug}#${rel.slug}`}
                                className="inline-block rounded-full border border-violet/25 bg-white px-2.5 py-1 text-micro text-violet hover:bg-violet-pale"
                              >
                                {pick(rel, "name", lang)}
                              </a>
                            </li>
                          )
                        })}
                      </ul>
                    </>
                  )}
                </div>
              </details>
            )}
          </div>
          <dl className="flex gap-4 text-micro text-charcoal-80/65 sm:flex-col sm:items-end sm:gap-1.5">
            <div className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              <dt className="sr-only">{t("funnel.durationLabel")}</dt>
              <dd>{pick(o, "duration", lang)}</dd>
            </div>
            <div className="inline-flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" aria-hidden="true" />
              <dt className="sr-only">{t("funnel.pricingLabel")}</dt>
              <dd className="font-mono tabular-nums">{offeringPriceLabel(o, t)}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ol>
  )
}
