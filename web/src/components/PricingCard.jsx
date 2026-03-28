import PrimaryButton from "../ui/PrimaryButton"

export default function PricingCard({ plan }) {
  return (
    <div
      className={`relative rounded-xl border bg-white p-7 shadow-sm transition hover:-translate-y-1 ${
        plan.popular
          ? "border-[#420060]/25 shadow-[0_18px_48px_rgba(66,0,96,0.10)]"
          : "border-[#634F40]/10"
      }`}
    >
      {plan.popular && (
        <div className="mb-4 inline-flex rounded-full bg-[#ede4ef] px-4 py-2 text-sm font-semibold text-[#420060]">
          Most Popular
        </div>
      )}

      <h3 className="font-['Sora'] text-2xl font-bold text-[#420060]">
        {plan.title}
      </h3>

      <p className="mt-3 text-base leading-8 text-[#634F40]/75">
        {plan.description}
      </p>

      <div className="mt-6 text-4xl font-bold text-[#420060]">
        {plan.price}
      </div>

      <div className="mt-6 h-px bg-[#634F40]/10" />

      <ul className="mt-6 space-y-3">
        {plan.features.map((feature) => (
          <li key={feature} className="text-sm leading-7 text-[#634F40]/80">
            ✓ {feature}
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <PrimaryButton fullWidth>Get Started</PrimaryButton>
      </div>
    </div>
  )
}