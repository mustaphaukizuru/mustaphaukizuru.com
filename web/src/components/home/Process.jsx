import { useTranslation } from "react-i18next"
import { processSteps } from "../../data/homeData"
import { Container, SectionHeading } from "./primitives"
import { useScrollNarrative, ScrollPinSection, DESKTOP_QUERY, MOBILE_QUERY } from "../motion/scroll"

/**
 * Process · "How I work" — three numbered steps (roadmap step 33 narrative).
 *
 * Desktop (≥1024px): the panel is CSS-sticky inside a 220vh track (space is
 * reserved in CSS, so no CLS) and a scrubbed GSAP timeline reveals the steps
 * one by one while the connector line draws from left to right.
 * Mobile/tablet: plain stacked reveal — each card fades up once as it enters.
 * Reduced motion / no JS: DOM is authored in its final state; the hook never
 * loads gsap, so everything is simply visible.
 */
const TINTS = ["bg-violet-ghost", "bg-azure-pale/50", "bg-terracotta/10"]

export default function Process() {
  const { t } = useTranslation("home")

  const scope = useScrollNarrative(({ gsap, mm, scope: root }) => {
    const steps = gsap.utils.toArray("[data-step]", root)
    const line  = root.querySelector("[data-progress-line]")
    const fills = gsap.utils.toArray("[data-step-fill]", root)

    mm.add(DESKTOP_QUERY, () => {
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: { trigger: root, start: "top top", end: "bottom bottom", scrub: 0.6 },
      })
      tl.fromTo(line, { scaleX: 0, transformOrigin: "0 50%" }, { scaleX: 1, duration: 3 }, 0)
      steps.forEach((step, i) => {
        tl.fromTo(step, { autoAlpha: 0, y: 48 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: "power2.out" }, i)
        if (fills[i]) tl.fromTo(fills[i], { scaleX: 0, transformOrigin: "0 50%" }, { scaleX: 1, duration: 0.6 }, i + 0.2)
      })
      tl.to({}, { duration: 0.5 }) // breathing room after the last step
    })

    mm.add(MOBILE_QUERY, () => {
      steps.forEach((step, i) => {
        gsap.fromTo(
          step,
          { autoAlpha: 0, y: 28 },
          {
            autoAlpha: 1, y: 0, duration: 0.6, ease: "power2.out",
            scrollTrigger: { trigger: step, start: "top 85%", once: true },
          },
        )
        if (fills[i]) {
          gsap.fromTo(
            fills[i],
            { scaleX: 0, transformOrigin: "0 50%" },
            { scaleX: 1, duration: 0.6, delay: 0.2, ease: "power2.out",
              scrollTrigger: { trigger: step, start: "top 85%", once: true } },
          )
        }
      })
    })
  })

  return (
    <ScrollPinSection
      trackRef={scope}
      trackClassName="lg:h-[220vh]"
      className="py-20 lg:py-0"
      aria-labelledby="home-process-heading"
    >
      <Container className="lg:py-16">
        <SectionHeading
          id="home-process-heading"
          eyebrow={t("process.eyebrow")}
          title={t("process.title")}
          subtitle={t("process.subtitle")}
          align="center"
        />
        {/* min-h reserves the card row so the sticky panel never resizes mid-scroll */}
        <ol className="relative grid gap-5 lg:min-h-[260px] lg:grid-cols-3">
          <span
            aria-hidden="true"
            data-progress-line
            className="pointer-events-none absolute left-[16%] right-[16%] top-11 hidden h-px bg-gradient-to-r from-violet/40 via-azure/50 to-terracotta/70 will-change-transform lg:block"
          />
          {processSteps.map(({ key, icon: Icon }, i) => (
            <li
              key={key}
              data-step
              className={`relative flex flex-col gap-4 rounded-2xl ${TINTS[i % TINTS.length]} p-6 ring-1 ring-charcoal-80/8 will-change-transform`}
            >
              <div className="flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-violet shadow-sm">
                  <Icon className="h-5.5 w-5.5" aria-hidden="true" />
                </span>
                {/* Decorative step numeral. `aria-hidden` because the step's
                    position is already carried by DOM order and by the step
                    title — this is a visual echo, not information.
                    It also has to be marked: at violet/15 on white it sits
                    near 1.2:1, well under AA, and axe rightly fails it as
                    text. That defect is not new. It was invisible to CI only
                    because gsap set autoAlpha:0 on this subtree before the
                    audit ran, so axe skipped it; deferring the gsap load
                    stopped masking it. */}
                <span aria-hidden="true" className="font-mono text-[28px] font-bold tabular-nums text-violet/15">
                  0{i + 1}
                </span>
              </div>
              <div>
                <h3 className="text-[17px] font-bold text-charcoal">{t(`process.steps.${key}.title`)}</h3>
                <p className="mt-1.5 text-[14px] leading-6 text-charcoal-80/70">{t(`process.steps.${key}.body`)}</p>
              </div>
              <span
                aria-hidden="true"
                data-step-fill
                className="mt-auto block h-0.5 w-full rounded-full bg-gradient-to-r from-violet to-azure"
              />
            </li>
          ))}
        </ol>
      </Container>
    </ScrollPinSection>
  )
}
