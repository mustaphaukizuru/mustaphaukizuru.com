/* Accordion FAQ. Accepts already-localised { id, question, answer } items. */
import { useState } from "react"
import { Plus, Minus } from "lucide-react"

export default function CategoryFaq({ items = [] }) {
  const [openId, setOpenId] = useState(items[0]?.id || null)
  return (
    <div className="divide-y divide-charcoal-80/10 rounded-2xl border border-charcoal-80/10 bg-white">
      {items.map((item) => {
        const open = openId === item.id
        return (
          <div key={item.id}>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={`faq-${item.id}`}
              onClick={() => setOpenId(open ? null : item.id)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-body font-semibold text-violet hover:bg-mist/60 sm:px-6"
            >
              <span>{item.question}</span>
              {open
                ? <Minus className="h-4 w-4 shrink-0" aria-hidden="true" />
                : <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />}
            </button>
            {open && (
              <div id={`faq-${item.id}`} className="px-5 pb-5 text-meta leading-6 text-charcoal-80/75 sm:px-6">
                {item.answer}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
