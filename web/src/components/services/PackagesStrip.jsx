/* Surviving fixed-price packages (audience plans). Their checkout link is
 * unchanged: /checkout/service?audience=<code>&tier=<key>.
 *
 * T1 · prices and tier availability come from GET /services/plans (the DB,
 * edited in /admin/services). Names, descriptions and the feature matrix stay
 * in the static catalogue. */
import { LocalizedLink as Link } from "../LocalizedLink"
import { useTranslation } from "react-i18next"
import { ArrowRight } from "lucide-react"
import { AUDIENCE_PRICING_PLANS, AUDIENCE_PRICING_ORDER } from "../../data/servicesCatalogue"
import { fetchServicePlans, indexServicePlans } from "../../services/serviceService"
import useApiQuery from "../../hooks/useApiQuery"
import { SectionHeader } from "./Primitives"
import { formatPriceWhole } from "../../lib/format"

// Canonical "MX$5,800" — es-MX Intl would drop the "MX" disambiguator.
const fmt = (n, currency = "MXN") => formatPriceWhole(n, currency)

export default function PackagesStrip() {
  const { t } = useTranslation("services")
  const { data: livePlans, loading, error } = useApiQuery(
    "service-plans",
    ({ signal }) => fetchServicePlans({ signal }),
    { select: indexServicePlans },
  )
  // Once the DB answered, a tier missing there is unavailable and is hidden.
  const dbReady = !loading && !error && livePlans && Object.keys(livePlans).length > 0
  return (
    <div>
      <SectionHeader
        eyebrow={t("funnel.packages.eyebrow")}
        title={t("funnel.packages.title")}
        subtitle={t("funnel.packages.subtitle")}
      />
      <div className="grid gap-5 md:grid-cols-3">
        {AUDIENCE_PRICING_ORDER.map((code) => {
          const plan = AUDIENCE_PRICING_PLANS[code]
          if (!plan) return null
          const Icon = plan.Icon
          const tiers = Object.entries(plan.tiers || {})
            .map(([tierKey, tier]) => {
              const live = livePlans?.[code]?.[tierKey]
              if (dbReady && !live) return null
              // FALLBACK: static priceMxn is shown only while /services/plans
              // is loading or when it failed; the DB price wins otherwise.
              return [tierKey, {
                ...tier,
                price:    live ? live.price : tier.priceMxn,
                currency: live?.currency || "MXN",
                period:   live?.period || tier.period,
                popular:  live ? live.popular : tier.popular,
              }]
            })
            .filter(Boolean)
          return (
            <div key={code} className="flex flex-col rounded-2xl border border-charcoal-80/10 bg-white p-6">
              <div className="flex items-center gap-3">
                {Icon && (
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-violet-pale text-violet">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                )}
                <div>
                  <div className="text-body font-bold text-violet">{plan.name}</div>
                  <div className="text-micro text-charcoal-80/65">{plan.short}</div>
                </div>
              </div>
              <ul className="mt-5 space-y-2">
                {tiers.map(([tierKey, tier]) => (
                  <li key={tierKey}>
                    <Link
                      to={`/checkout/service?audience=${code}&tier=${tierKey}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-charcoal-80/10 px-3 py-2.5 text-meta transition hover:border-violet/40 hover:bg-mist/60"
                    >
                      <span className="font-semibold text-charcoal-80">
                        {tier.name}
                        {tier.popular && (
                          <span className="ml-2 rounded-full bg-violet px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                            {t("funnel.packages.popular")}
                          </span>
                        )}
                      </span>
                      <span className="inline-flex items-center gap-1 whitespace-nowrap text-violet">
                        {fmt(tier.price, tier.currency)}
                        <span className="text-micro text-charcoal-80/65">/{tier.period}</span>
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
