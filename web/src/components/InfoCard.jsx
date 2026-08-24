import { m } from "framer-motion"

export default function InfoCard({
  title,
  description,
  icon: Icon,
  centered = true,
}) {
  return (
    <m.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className={`rounded-xl border border-charcoal-80/10 bg-white p-7 shadow-[0_12px_30px_rgba(93,63,211,0.06)] ${
        centered ? "text-center" : "text-left"
      }`}
    >
      <div
        className={`mb-5 flex h-16 w-16 items-center justify-center rounded-xl bg-violet-pale text-violet ${
          centered ? "mx-auto" : ""
        }`}
      >
        {Icon ? (
          <Icon className="h-8 w-8" strokeWidth={1.8} />
        ) : (
          <span className="text-2xl font-bold">•</span>
        )}
      </div>

      <h3 className="font-['Sora'] text-2xl font-semibold text-violet">
        {title}
      </h3>

      <p className="mt-4 text-base leading-8 text-charcoal-80/80">
        {description}
      </p>
    </m.div>
  )
}