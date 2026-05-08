import PrimaryButton from "../ui/PrimaryButton"
import { useTranslation } from "react-i18next"

export default function PricingCard({ plan }) {
  const { t } = useTranslation("common")
  return (
    <div
      className={`relative rounded-xl border bg-white p-7 shadow-sm transition hover:-translate-y-1 ${
        plan.popular
          ? "border-violet/25 shadow-[0_18px_48px_rgba(93,63,211,0.10)]"
          : "border-charcoal-80/10"
      }`}
    >
      {plan.popular && (
        <div className="mb-4 inline-flex rounded-full bg-violet-pale px-4 py-2 text-sm font-semibold text-violet">
          {t("ui.pricing.mostPopular")}
        </div>
      )}

      <h3 className="font-['Sora'] text-2xl font-bold text-violet">
        {plan.title}
      </h3>

      <p className="mt-3 text-base leading-8 text-charcoal-80/75">
        {plan.description}
      </p>

      <div className="mt-6 text-4xl font-bold text-violet">
        {plan.price}
      </div>

      <div className="mt-6 h-px bg-charcoal-80/10" />

      <ul className="mt-6 space-y-3">
        {plan.features.map((feature) => (
          <li key={feature} className="text-sm leading-7 text-charcoal-80/80">
            âœ“ {feature}
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <PrimaryButton fullWidth>{t("ui.pricing.getStarted")}</PrimaryButton>
      </div>
    </div>
  )
}