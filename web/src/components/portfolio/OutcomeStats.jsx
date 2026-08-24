import { useTranslation } from "react-i18next"
import { hasPlaceholder } from "./caseStudy"

/**
 * OutcomeStats · 2–3 quantified results.
 * Placeholder figures render with `data-placeholder="true"`, an asterisk and
 * a footnote so illustrative numbers are never mistaken for audited ones.
 */
export default function OutcomeStats({ outcomes = [], compact = false }) {
  const { t } = useTranslation("portfolio")
  if (!outcomes.length) return null
  const anyPlaceholder = hasPlaceholder(outcomes)

  return (
    <div>
      <dl className={`grid gap-3 ${compact ? "grid-cols-2 sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {outcomes.map((o, i) => (
          <div
            key={i}
            data-placeholder={o.placeholder ? "true" : undefined}
            className={`relative overflow-hidden rounded-2xl border p-5 ${
              o.placeholder
                ? "border-dashed border-violet/30 bg-violet-ghost"
                : "border-charcoal-80/10 bg-white shadow-[0_6px_20px_rgba(93,63,211,0.05)]"
            }`}
          >
            <dd className={`font-bold tabular-nums tracking-tight text-violet ${compact ? "text-section" : "text-page"}`}>
              {o.value}
              {o.placeholder ? <span aria-hidden="true" className="ml-0.5 text-azure">*</span> : null}
            </dd>
            <dt className="mt-1 text-meta leading-5 text-charcoal-80/70">{o.label}</dt>
            {o.placeholder ? (
              <span className="mt-2 inline-block rounded-full bg-white px-2 py-0.5 text-micro font-semibold uppercase tracking-[0.12em] text-azure">
                {t("detail.placeholderBadge")}
              </span>
            ) : null}
          </div>
        ))}
      </dl>
      {anyPlaceholder ? (
        <p className="mt-3 text-micro leading-5 text-charcoal-80/55">{t("detail.placeholderNote")}</p>
      ) : null}
    </div>
  )
}
