import { motion } from "framer-motion"

export default function AudienceCard({ item }) {
  const Icon = item.icon

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl border border-[#634F40]/10 bg-white p-8 text-center shadow-[0_12px_30px_rgba(66,0,96,0.06)]"
    >
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-xl bg-[#FFCCAF]/45 text-[#420060]">
        <Icon className="h-8 w-8" strokeWidth={1.8} />
      </div>
      <h3 className="font-['Sora'] text-lg font-semibold text-[#420060]">
        {item.title}
      </h3>
      <p className="mt-3 text-sm leading-6 text-[#634F40]/80">
        {item.description}
      </p>
    </motion.div>
  )
}