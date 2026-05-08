import { motion } from "framer-motion"

export default function AudienceCard({ item }) {
  const Icon = item.icon

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl border border-charcoal-80/10 bg-white p-8 text-center shadow-[0_12px_30px_rgba(93,63,211,0.06)]"
    >
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-xl bg-terracotta/45 text-violet">
        <Icon className="h-8 w-8" strokeWidth={1.8} />
      </div>
      <h3 className="font-['Sora'] text-lg font-semibold text-violet">
        {item.title}
      </h3>
      <p className="mt-3 text-sm leading-6 text-charcoal-80/80">
        {item.description}
      </p>
    </motion.div>
  )
}