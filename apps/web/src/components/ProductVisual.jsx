import { MonitorSmartphone } from "lucide-react"

export default function ProductVisual({
  title,
  category,
  text,
  compact = false,
}) {
  return (
    <div
      className={`flex items-center justify-center rounded-xl border border-[#634F40]/10 bg-white/70 text-[#420060] ${
        compact ? "h-[130px]" : "h-[340px] sm:h-[460px]"
      }`}
    >
      <div className="px-6 text-center">
        <div className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#420060] shadow-sm">
          {category}
        </div>

        <div className={`mt-6 ${compact ? "text-xl" : "text-2xl"} font-['Sora'] font-semibold text-[#420060]`}>
          {title}
        </div>

        <div className="mx-auto mt-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#ede4ef] text-[#420060]">
          <MonitorSmartphone className="h-6 w-6" />
        </div>

        <p className="mt-4 text-sm leading-7 text-[#634F40]/75">{text}</p>
      </div>
    </div>
  )
}