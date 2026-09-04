/* ════════════════════════════════════════════════════════════════════════
   SchoolYearTimeline.jsx · the ciclo escolar as a stepper (§ 05 R5)
   ────────────────────────────────────────────────────────────────────────
   Five moments of a Mexican school year, each naming the system it
   touches and the catalogue offering that applies. Rendered as a stepper
   with an SVG connector that draws on scroll; vertical on small screens,
   horizontal from lg. Order is chronological, so the numbering carries
   information. Copy arrives localised from the `schools` namespace.
   ════════════════════════════════════════════════════════════════════════ */

import { m, useReducedMotion } from "framer-motion"
import { CalendarDays } from "lucide-react"

const EASE = [0.22, 1, 0.36, 1]

/**
 * @param {{ steps: Array<{ when: string, title: string, system: string, offering: string }> }} props
 */
export default function SchoolYearTimeline({ steps = [] }) {
  const reduced = useReducedMotion()
  if (!Array.isArray(steps) || steps.length === 0) return null

  const line = reduced
    ? {}
    : {
        initial: { pathLength: 0 },
        whileInView: { pathLength: 1 },
        viewport: { once: true, amount: 0.3 },
        transition: { duration: 1.4, ease: EASE },
      }
  const item = (i) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, amount: 0.3 },
          transition: { duration: 0.5, delay: 0.15 + i * 0.14, ease: EASE },
        }

  return (
    <div className="relative">
      {/* Horizontal connector · lg and up */}
      <svg aria-hidden="true" className="absolute left-0 top-[22px] hidden h-2 w-full lg:block" viewBox="0 0 1000 8" preserveAspectRatio="none">
        <path d="M0 4 H1000" stroke="var(--color-violet-pale)" strokeWidth="4" fill="none" />
        <m.path d="M0 4 H1000" stroke="var(--color-violet)" strokeWidth="4" strokeLinecap="round" fill="none" {...line} />
      </svg>
      {/* Vertical connector · below lg */}
      <svg aria-hidden="true" className="absolute left-[22px] top-0 h-full w-2 lg:hidden" viewBox="0 0 8 1000" preserveAspectRatio="none">
        <path d="M4 0 V1000" stroke="var(--color-violet-pale)" strokeWidth="4" fill="none" />
        <m.path d="M4 0 V1000" stroke="var(--color-violet)" strokeWidth="4" strokeLinecap="round" fill="none" {...line} />
      </svg>

      <ol className="relative grid gap-8 lg:grid-cols-5 lg:gap-6" role="list">
        {steps.map((step, i) => (
          <m.li key={step.title} className="relative flex gap-4 lg:block" {...item(i)}>
            <span className="relative z-10 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet font-mono text-[13px] font-semibold tabular-nums text-white shadow-[var(--shadow-e4)] ring-4 ring-white">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="lg:mt-5">
              <div className="inline-flex items-center gap-1.5 font-mono text-micro uppercase tracking-[0.16em] text-violet">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                {step.when}
              </div>
              <h3 className="mt-1.5 text-subhead font-bold text-charcoal-80">{step.title}</h3>
              <p className="mt-1 text-meta text-charcoal-80/70">{step.system}</p>
              <span className="mt-3 inline-flex rounded-full bg-violet-pale px-2.5 py-1 text-[12px] font-semibold text-violet">
                {step.offering}
              </span>
            </div>
          </m.li>
        ))}
      </ol>
    </div>
  )
}
