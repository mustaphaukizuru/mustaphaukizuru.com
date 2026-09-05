/* eslint-disable react-refresh/only-export-components -- exports outcome helpers used by the case-study page */
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { animate, m, useInView, useReducedMotion } from "framer-motion"

import { hasPlaceholder } from "./caseStudy"

/**
 * OutcomeStats · 2–3 quantified results.
 * Placeholder figures render with `data-placeholder="true"`, an asterisk and
 * a footnote so illustrative numbers are never mistaken for audited ones.
 *
 * The numeric part of each value counts up from 0 the first time the card
 * scrolls into view. The DOM is authored with the FINAL value, so
 * reduced-motion and no-JS show the real figure; the number span has a
 * `min-width` in `ch` matching the final string, so counting never reflows.
 *
 * T4-3 · ported from gsap to Framer's `animate`, which tweens a plain number
 * with an onUpdate exactly as gsap did. This was the only one of the three
 * scroll narratives that was not really a scroll animation at all — it is a
 * one-shot tween on enter, and it was pulling in ScrollTrigger to ask
 * "is this on screen yet", which is what useInView answers.
 */

/** "-40%" → { prefix: "-", number: 40, suffix: "%", decimals: 0 }; null when no number. */
export function splitNumeric(value) {
  const str = String(value ?? "")
  const match = str.match(/-?\d[\d,]*(?:\.\d+)?/)
  if (!match) return null
  const raw = match[0]
  const number = parseFloat(raw.replace(/,/g, ""))
  if (!Number.isFinite(number)) return null
  const decimals = (raw.split(".")[1] || "").length
  return {
    prefix: str.slice(0, match.index),
    suffix: str.slice(match.index + raw.length),
    number,
    decimals,
    grouped: raw.includes(","),
    raw,
  }
}

/**
 * The number itself, counting up once.
 *
 * Renders the FINAL string on the first frame and every frame after the tween
 * ends, so a reader with reduced motion, no JS, or a screen reader sees the
 * real figure rather than a zero that is about to change.
 */
function CountUp({ parts, delay, run }) {
  const ref = useRef(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!run || done || !ref.current) return undefined
    const el = ref.current
    // Same shape as the gsap tween it replaces: 1.4s, power3.out, staggered.
    const controls = animate(0, parts.number, {
      duration: 1.4,
      delay,
      ease: [0.215, 0.61, 0.355, 1],
      onUpdate: (v) => { el.textContent = formatNumber(v, parts) },
      onComplete: () => { el.textContent = parts.raw; setDone(true) },
    })
    return () => controls.stop()
  }, [run, done, parts, delay])

  return (
    <span
      ref={ref}
      data-count={parts.number}
      data-decimals={parts.decimals}
      data-grouped={parts.grouped ? "true" : "false"}
      className="inline-block text-right"
      style={{ minWidth: `${parts.raw.length}ch` }}
    >
      {parts.raw}
    </span>
  )
}

function formatNumber(n, { decimals, grouped }) {
  return grouped
    ? n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : n.toFixed(decimals)
}

export default function OutcomeStats({ outcomes = [], compact = false }) {
  const { t } = useTranslation("portfolio")
  const anyPlaceholder = hasPlaceholder(outcomes)

  const scope = useRef(null)
  const reduce = useReducedMotion()
  // margin, not amount: gsap fired at "top 88%", i.e. when the block's top
  // reached 88% down the viewport. -12% off the bottom of the root margin is
  // the same line.
  const inView = useInView(scope, { once: true, margin: "0px 0px -12% 0px" })

  if (!outcomes.length) return null

  return (
    <div ref={scope}>
      <dl className={`grid gap-3 ${compact ? "grid-cols-2 sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {outcomes.map((o, i) => {
          const parts = splitNumeric(o.value)
          return (
            <m.div
              key={i}
              data-stat
              data-placeholder={o.placeholder ? "true" : undefined}
              initial={reduce ? false : { opacity: 0, y: 20 }}
              animate={inView && !reduce ? { opacity: 1, y: 0 } : undefined}
              transition={{ duration: 0.55, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className={`relative overflow-hidden rounded-2xl border p-5 ${
                o.placeholder
                  ? "border-dashed border-violet/30 bg-violet-ghost"
                  : "border-charcoal-80/10 bg-white shadow-[var(--shadow-e4)]"
              }`}
            >
              <dd className={`font-bold tabular-nums tracking-tight text-violet ${compact ? "text-section" : "text-page"}`}>
                {parts ? (
                  <>
                    {parts.prefix}
                    <CountUp parts={parts} delay={i * 0.12} run={inView && !reduce} />
                    {parts.suffix}
                  </>
                ) : (
                  o.value
                )}
                {o.placeholder ? <span aria-hidden="true" className="ml-0.5 text-azure-deep">*</span> : null}
              </dd>
              <dt className="mt-1 text-meta leading-5 text-charcoal-80/70">{o.label}</dt>
              {o.placeholder ? (
                <span className="mt-2 inline-block rounded-full bg-white px-2 py-0.5 text-micro font-semibold uppercase tracking-[0.12em] text-azure-deep">
                  {t("detail.placeholderBadge")}
                </span>
              ) : null}
            </m.div>
          )
        })}
      </dl>
      {anyPlaceholder ? (
        <p className="mt-3 text-micro leading-5 text-charcoal-80/65">{t("detail.placeholderNote")}</p>
      ) : null}
    </div>
  )
}
