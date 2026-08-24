import { useTranslation } from "react-i18next"

/** ApproachSteps · numbered 3–5 step timeline */
export default function ApproachSteps({ steps = [] }) {
  const { t } = useTranslation("portfolio")
  if (!steps.length) return null
  return (
    <ol className="relative space-y-5 border-l border-violet/15 pl-6">
      {steps.map((s, i) => (
        <li key={i} className="relative">
          <span
            aria-hidden="true"
            className="absolute -left-[31px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-violet text-[10px] font-bold text-white ring-4 ring-mist"
          >
            {i + 1}
          </span>
          <div className="text-micro font-semibold uppercase tracking-[0.14em] text-violet/60">
            {t("detail.stepLabel", { n: i + 1 })}
          </div>
          {s.title ? <h3 className="mt-0.5 text-body font-bold text-violet">{s.title}</h3> : null}
          {s.body ? <p className="mt-1 text-meta leading-6 text-charcoal-80/75">{s.body}</p> : null}
        </li>
      ))}
    </ol>
  )
}
