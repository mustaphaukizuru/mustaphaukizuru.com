import { useRef } from "react"
import { useTranslation } from "react-i18next"
import { m, useReducedMotion, useScroll, useTransform } from "framer-motion"

import { processSteps } from "../../data/homeData"
import useMediaQuery from "../../hooks/useMediaQuery"
import { Container, SectionHeading } from "./primitives"
import { ScrollPinSection, DESKTOP_QUERY } from "../motion/scroll"

/**
 * Process · "How I work" — three numbered steps.
 *
 * Desktop (≥1024px): the panel is CSS-sticky inside a 220vh track (the space
 * is reserved in CSS, so no CLS) and the steps reveal one by one against
 * scroll progress while the connector line draws left to right.
 * Mobile/tablet: plain stacked reveal — each card fades up once as it enters.
 * Reduced motion / no JS: the DOM is authored in its FINAL state, so
 * everything is simply visible.
 *
 * T4-3 · ported from gsap + ScrollTrigger to Framer's useScroll/useTransform.
 * The timeline this replaced pulled a 114 KB library in to move three cards;
 * the same shape is four useTransform calls, on a library the rest of the
 * site already loads.
 *
 * The gsap timeline was authored on a 3.5-unit clock (steps at 0, 1 and 2
 * with duration 0.8, the line drawn over 3, then 0.5 of breathing room).
 * Those positions are kept as fractions of that clock rather than re-tuned,
 * so this is the motion that was designed rather than a new one that happens
 * to compile.
 */
const TINTS = ["bg-violet-ghost", "bg-azure-pale/50", "bg-terracotta/10"]

/** The original timeline's length, in its own units. */
const CLOCK = 3.5
const at = (unit) => Math.min(1, unit / CLOCK)

/**
 * One card. A component because useTransform is a hook and each index needs
 * its own window — the alternative is three hardcoded copies.
 */
function Step({ progress, index, mode, tint, icon: Icon, title, body }) {
  // gsap: tl.fromTo(step, { autoAlpha: 0, y: 48 }, { …, duration: 0.8 }, i)
  const opacity = useTransform(progress, [at(index), at(index + 0.8)], [0, 1])
  const y = useTransform(progress, [at(index), at(index + 0.8)], [48, 0])
  // gsap: the fill bar, at i + 0.2 for 0.6
  const fill = useTransform(progress, [at(index + 0.2), at(index + 0.8)], [0, 1])

  // Three modes, and "static" is not a degraded version of the other two —
  // it is the contract. Under reduced motion the old hook never ran at all,
  // so the card was simply present; a whileInView fade-up here would be a
  // NEW animation shown to the one reader who asked for none.
  const animation = {
    scrub: { style: { opacity, y }, initial: false },
    enter: {
      initial: { opacity: 0, y: 28 },
      whileInView: { opacity: 1, y: 0 },
      viewport: { once: true, amount: 0.3 },
      transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
    },
    static: { initial: false },
  }[mode]

  return (
    <m.li
      data-step
      className={`relative flex flex-col gap-4 rounded-2xl ${tint} p-6 ring-1 ring-charcoal-80/8 will-change-transform`}
      {...animation}
    >
      <div className="flex items-center justify-between">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-violet shadow-sm">
          <Icon className="h-5.5 w-5.5" aria-hidden="true" />
        </span>
        {/* Decorative step numeral. `aria-hidden` because the step's
            position is already carried by DOM order and by the step
            title — this is a visual echo, not information.
            aria-hidden alone does not settle it, though: axe judges
            contrast on what is VISIBLE, not on what is exposed to a
            screen reader, and it is right to — a smudge a sighted
            reader cannot resolve is a defect whether or not it is
            announced. At violet/15 this sat at 1.25:1 on all three
            step grounds. 28px bold is large text, so the bar is 3:1,
            and violet needs alpha 0.65 to reach it (3.02, no margin);
            /70 is the first step with room. */}
        <span aria-hidden="true" className="font-mono text-[28px] font-bold tabular-nums text-violet/70">
          0{index + 1}
        </span>
      </div>
      <div>
        <h3 className="text-[17px] font-bold text-charcoal">{title}</h3>
        <p className="mt-1.5 text-[14px] leading-6 text-charcoal-80/70">{body}</p>
      </div>
      <m.span
        aria-hidden="true"
        data-step-fill
        className="mt-auto block h-0.5 w-full origin-left rounded-full bg-gradient-to-r from-violet to-azure"
        style={mode === "scrub" ? { scaleX: fill } : undefined}
      />
    </m.li>
  )
}

export default function Process() {
  const { t } = useTranslation("home")
  const trackRef = useRef(null)
  const reduce = useReducedMotion()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)

  // Scroll-linked on a desktop viewport, a one-shot fade on a small one, and
  // NOTHING under reduced motion — the DOM is already the finished layout, so
  // there is nothing to reveal.
  const mode = reduce ? "static" : isDesktop ? "scrub" : "enter"

  // The same window gsap used: trigger the track, start when its top reaches
  // the viewport top, end when its bottom does.
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  })

  // gsap: tl.fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: 3 }, 0)
  const lineScale = useTransform(scrollYProgress, [0, at(3)], [0, 1])

  return (
    <ScrollPinSection
      trackRef={trackRef}
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
          <m.span
            aria-hidden="true"
            data-progress-line
            className="pointer-events-none absolute left-[16%] right-[16%] top-11 hidden h-px origin-left bg-gradient-to-r from-violet/40 via-azure/50 to-terracotta/70 will-change-transform lg:block"
            style={mode === "scrub" ? { scaleX: lineScale } : undefined}
          />
          {processSteps.map(({ key, icon }, i) => (
            <Step
              key={key}
              progress={scrollYProgress}
              index={i}
              mode={mode}
              tint={TINTS[i % TINTS.length]}
              icon={icon}
              title={t(`process.steps.${key}.title`)}
              body={t(`process.steps.${key}.body`)}
            />
          ))}
        </ol>
      </Container>
    </ScrollPinSection>
  )
}
