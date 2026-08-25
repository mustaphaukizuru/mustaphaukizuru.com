import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { ScrollText, UserRound, Briefcase, Ban, RefreshCw, ArrowRight } from "lucide-react"

/* ──────────────────────────────────────────────────────────────────────────
 *  LicenseUpdates — static licence terms + "updates included" policy.
 *
 *  Copy lives in i18n (product.json → license.*) and is marked
 *  `data-placeholder` so the owner can tune the wording before launch.
 *  If a product carries its own `licenseType` / `updatesPolicy` string it is
 *  shown as a chip above the generic terms.
 *  ────────────────────────────────────────────────────────────────────────── */

const ROWS = [
  { icon: UserRound, key: "personal",   tone: "bg-mint/15 text-mint-600" },
  { icon: Briefcase, key: "commercial", tone: "bg-violet-pale text-violet" },
  { icon: Ban,       key: "notAllowed", tone: "bg-rose/10 text-rose-600" },
]

export default function LicenseUpdates({ product }) {
  const { t } = useTranslation("product")
  const licenseType = product?.licenseType || product?.license || null

  return (
    <section
      aria-labelledby="license-heading"
      data-placeholder="license-terms"
      className="mt-8 rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_4px_16px_rgb(var(--color-violet-rgb)/0.04)]"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-violet" aria-hidden="true" />
          <h2 id="license-heading" className="text-section font-bold text-violet">{t("license.title")}</h2>
        </div>
        {licenseType && (
          <span className="rounded-md bg-violet-pale px-2 py-1 font-mono text-micro font-bold uppercase tracking-wide text-violet">
            {licenseType}
          </span>
        )}
      </div>

      <p className="mb-5 max-w-prose text-meta leading-6 text-charcoal-80/70">{t("license.subtitle")}</p>

      <ul className="grid gap-3 sm:grid-cols-3">
        {ROWS.map(({ icon: Icon, key, tone }) => (
          <li key={key} className="rounded-xl border border-charcoal-80/8 bg-mist/60 p-4">
            <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg ${tone}`} aria-hidden="true">
              <Icon className="h-4 w-4" />
            </div>
            <h3 className="text-meta font-bold text-charcoal">{t(`license.${key}.title`)}</h3>
            <p className="mt-1 text-micro leading-5 text-charcoal-80/65">{t(`license.${key}.body`)}</p>
          </li>
        ))}
      </ul>

      {/* Updates policy */}
      <div
        data-placeholder="updates-policy"
        className="mt-4 flex items-start gap-3 rounded-xl border border-violet/15 bg-violet-pale/50 p-4"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-violet shadow-[0_2px_8px_rgb(var(--color-violet-rgb)/0.10)]" aria-hidden="true">
          <RefreshCw className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-meta font-bold text-violet">{t("license.updates.title")}</h3>
          <p className="mt-1 text-micro leading-5 text-charcoal-80/70">
            {product?.updatesPolicy || t("license.updates.body")}
          </p>
          <p className="mt-1.5 text-micro text-charcoal-80/65">{t("license.updates.versionNote")}</p>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Link to="/terms" className="inline-flex items-center gap-1 text-micro font-semibold text-violet hover:underline">
          {t("license.fullTerms")} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}
