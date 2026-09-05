/* call → proposal → delivery */
import { useTranslation } from "react-i18next"
import { ArrowRight } from "lucide-react"
import { LocalizedLink as Link } from "../LocalizedLink"
import { HOW_IT_WORKS } from "../../data/servicesCatalogue"
import { pick, useCatalogueLang } from "./localize"
import { SectionHeader } from "./Primitives"

export default function HowItWorks({ invert = false }) {
  const { t } = useTranslation("services")
  const lang = useCatalogueLang()
  return (
    <div>
      <SectionHeader
        eyebrow={t("funnel.how.eyebrow")}
        title={t("funnel.how.title")}
        subtitle={t("funnel.how.subtitle")}
        invert={invert}
      />
      <ol className="grid gap-5 md:grid-cols-3">
        {HOW_IT_WORKS.map((step) => {
          const Icon = step.Icon
          return (
            <li
              key={step.id}
              className={`rounded-2xl border p-6 ${invert ? "border-white/15 bg-white/5" : "border-charcoal-80/10 bg-white"}`}
            >
              <div className="flex items-center justify-between">
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${invert ? "bg-white/15 text-white" : "bg-violet-pale text-violet"}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className={`text-[13px] font-bold tabular-nums ${invert ? "text-white/85" : "text-violet"}`}>{step.step}</span>
              </div>
              <h3 className={`mt-4 text-body font-bold ${invert ? "text-white" : "text-violet"}`}>{pick(step, "title", lang)}</h3>
              <p className={`mt-1.5 text-meta leading-6 ${invert ? "text-white/75" : "text-charcoal-80/70"}`}>{pick(step, "body", lang)}</p>
            </li>
          )
        })}
      </ol>
      {/* These three are a summary of six (T2-9). The full process — what to
          submit at each stage, remote vs on-site, the access rules — is a
          page, and this is the only route to it from /services and every
          category page. Visible link text, not an aria-label: that is what
          the link-text audit reads, and what a reader scanning for "is there
          more?" reads too. */}
      <p className="mt-5 text-meta">
        <Link
          to="/how-we-work"
          className={`inline-flex items-center gap-1.5 font-semibold underline-offset-2 hover:underline ${invert ? "text-white" : "text-violet"}`}
        >
          {t("process.servicesLink")}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </p>
    </div>
  )
}
