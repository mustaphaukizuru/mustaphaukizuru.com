import { useTranslation } from "react-i18next"
import { useScrollNarrative } from "../motion/scroll"

/**
 * ApproachSteps · numbered 3–5 step timeline.
 *
 * Step 33 · the connector line draws downward (scrubbed to scroll) and each
 * step's marker + copy reveal once as they enter the viewport. The DOM is the
 * final state; with reduced motion the hook never runs and the list is static.
 */
export default function ApproachSteps({ steps = [] }) {
  const { t } = useTranslation("portfolio")

  const scope = useScrollNarrative(({ gsap, scope: root }) => {
    const line = root.querySelector("[data-approach-line]")
    gsap.fromTo(line, { scaleY: 0, transformOrigin: "50% 0" }, {
      scaleY: 1, ease: "none",
      scrollTrigger: { trigger: root, start: "top 75%", end: "bottom 60%", scrub: 0.5 },
    })
    gsap.utils.toArray("[data-approach-step]", root).forEach((step) => {
      const dot = step.querySelector("[data-approach-dot]")
      const body = step.querySelector("[data-approach-body]")
      gsap.timeline({ scrollTrigger: { trigger: step, start: "top 80%", once: true } })
        .fromTo(dot, { scale: 0 }, { scale: 1, duration: 0.4, ease: "back.out(2)" })
        .fromTo(body, { autoAlpha: 0, x: -12 }, { autoAlpha: 1, x: 0, duration: 0.5, ease: "power2.out" }, "-=0.2")
    })
  }, [steps])

  if (!steps.length) return null
  return (
    <ol ref={scope} className="relative space-y-5 pl-6">
      {/* static hairline (always visible) + drawn accent line on top */}
      <span aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 top-0 w-px bg-violet/15" />
      <span
        aria-hidden="true"
        data-approach-line
        className="pointer-events-none absolute bottom-0 left-0 top-0 w-px bg-gradient-to-b from-violet to-azure will-change-transform"
      />
      {steps.map((s, i) => (
        <li key={i} data-approach-step className="relative">
          <span
            aria-hidden="true"
            data-approach-dot
            className="absolute -left-[31px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-violet text-[10px] font-bold text-white ring-4 ring-mist will-change-transform"
          >
            {i + 1}
          </span>
          <div data-approach-body>
            <div className="text-micro font-semibold uppercase tracking-[0.14em] text-violet/60">
              {t("detail.stepLabel", { n: i + 1 })}
            </div>
            {s.title ? <h3 className="mt-0.5 text-body font-bold text-violet">{s.title}</h3> : null}
            {s.body ? <p className="mt-1 text-meta leading-6 text-charcoal-80/75">{s.body}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  )
}
