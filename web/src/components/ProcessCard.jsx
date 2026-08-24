import { m } from "framer-motion"

export default function ProcessCard({ item, index }) {
  const Icon = item.icon

  return (
    <m.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl border border-charcoal-80/10 bg-white p-7 text-center shadow-[0_12px_30px_rgb(var(--color-violet-rgb)/0.06)]"
    >
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-xl bg-violet-pale text-violet">
        <Icon className="h-8 w-8" strokeWidth={1.8} />
      </div>

      <div className="mb-2 text-sm font-semibold tracking-[0.2em] text-charcoal-80/55">
        0{index + 1}
      </div>

      <h3 className="font-display text-lg font-semibold text-violet">
        {item.title}
      </h3>

      <p className="mt-4 text-base leading-6 text-charcoal-80/80">
        {item.description}
      </p>
    </m.div>
  )
}