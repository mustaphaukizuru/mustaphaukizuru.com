import { useState } from "react"
import { ChevronDown } from "lucide-react"

export default function FAQAccordion({ items = [] }) {
  const [openIndex, setOpenIndex] = useState(0)

  return (
    <div className="rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-sm">
      {items.map((item, index) => {
        const isOpen = index === openIndex

        return (
          <div
            key={item.question}
            className="border-b border-[#634F40]/10 last:border-b-0"
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? -1 : index)}
              className="flex w-full items-center justify-between gap-4 py-5 text-left"
            >
              <span className="font-semibold text-[#420060]">
                {item.question}
              </span>

              <ChevronDown
                className={`h-5 w-5 shrink-0 text-[#420060] transition ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isOpen && (
              <div className="pb-5 text-sm leading-7 text-[#634F40]/80">
                {item.answer}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}