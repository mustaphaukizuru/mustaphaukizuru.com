import { useRef } from "react"
import { useTranslation } from "react-i18next"
import { m, useReducedMotion, useScroll, useTransform } from "framer-motion"

/**
 * ApproachSteps · numbered 3–5 step timeline.
 *
 * The connector line draws downward against scroll and each step's marker and
 * copy reveal once as they enter. The DOM is the final state; with reduced
 * motion nothing animates and the list is simply static.
 *
 * T4-3 · ported from gsap + ScrollTrigger to Framer. The line is the only
 * scrubbed thing here; the per-step reveals were already "play once on
 * enter", which is whileInView with no library at all.
 */
export default function ApproachSteps({ steps = [] }) {
  const { t } = useTranslation("portfolio")
  const trackRef = useRef(null)
  const reduce = useReducedMotion()

  // gsap: scrollTrigger { trigger: root, start: "top 75%", end: "bottom 60%" }
  // — the list starts drawing when its top is three-quarters down the
  // viewport and finishes when its bottom passes 60%.
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start 0.75", "end 0.6"],
  })
  const lineScale = useTransform(scrollYProgress, [0, 1], [0, 1])

  if (!steps.length) return null

  return (
    <ol ref={trackRef} className="relative space-y-5 pl-6">
      {/* static hairline (always visible) + drawn accent line on top */}
      <span aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 top-0 w-px bg-violet/15" />
      <m.span
        aria-hidden="true"
        data-approach-line
        className="pointer-events-none absolute bottom-0 left-0 top-0 w-px origin-top bg-gradient-to-b from-violet to-azure will-change-transform"
        style={reduce ? undefined : { scaleY: lineScale }}
      />
      {steps.map((s, i) => (
        <m.li
          key={i}
          data-approach-step
          className="relative"
          initial={reduce ? false : "hidden"}
          whileInView="shown"
          viewport={{ once: true, amount: 0.6 }}
        >
          <m.span
            aria-hidden="true"
            data-approach-dot
            className="absolute -left-[31px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-violet text-[10px] font-bold text-white ring-4 ring-mist will-change-transform"
            variants={{
              hidden: { scale: 0 },
              // back.out(2) in gsap; the overshoot is the character of this
              // reveal, so it is a spring rather than an ease that loses it.
              shown: { scale: 1, transition: { type: "spring", stiffness: 520, damping: 15 } },
            }}
          >
            {i + 1}
          </m.span>
          <m.div
            data-approach-body
            variants={{
              hidden: { opacity: 0, x: -12 },
              shown: { opacity: 1, x: 0, transition: { duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] } },
            }}
          >
            <div className="text-micro font-semibold uppercase tracking-[0.14em] text-violet">
              {t("detail.stepLabel", { n: i + 1 })}
            </div>
            {s.title ? <h3 className="mt-0.5 text-body font-bold text-violet">{s.title}</h3> : null}
            {s.body ? <p className="mt-1 text-meta leading-6 text-charcoal-80/75">{s.body}</p> : null}
          </m.div>
        </m.li>
      ))}
    </ol>
  )
}
