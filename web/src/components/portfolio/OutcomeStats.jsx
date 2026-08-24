/* eslint-disable react-refresh/only-export-components -- exports outcome helpers used by the case-study page */
import { useTranslation } from "react-i18next"
import { hasPlaceholder } from "./caseStudy"
import { useScrollNarrative } from "../motion/scroll"

/**
 * OutcomeStats · 2–3 quantified results.
 * Placeholder figures render with `data-placeholder="true"`, an asterisk and
 * a footnote so illustrative numbers are never mistaken for audited ones.
 *
 * Step 33 · the numeric part of each value counts up from 0 the first time
 * the card scrolls into view (GSAP, lazy). The DOM is authored with the final
 * value, so reduced-motion / no-JS show the real figure; the number span has
 * a `min-width` in `ch` matching the final string so counting never reflows.
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

function formatNumber(n, { decimals, grouped }) {
  return grouped
    ? n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : n.toFixed(decimals)
}

export default function OutcomeStats({ outcomes = [], compact = false }) {
  const { t } = useTranslation("portfolio")
  const anyPlaceholder = hasPlaceholder(outcomes)

  const scope = useScrollNarrative(({ gsap, scope: root }) => {
    gsap.utils.toArray("[data-count]", root).forEach((el, i) => {
      const target = parseFloat(el.dataset.count)
      const decimals = parseInt(el.dataset.decimals || "0", 10)
      const grouped = el.dataset.grouped === "true"
      if (!Number.isFinite(target)) return
      const state = { v: 0 }
      gsap.fromTo(state, { v: 0 }, {
        v: target,
        duration: 1.4,
        delay: i * 0.12,
        ease: "power3.out",
        onUpdate: () => { el.textContent = formatNumber(state.v, { decimals, grouped }) },
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      })
    })
    gsap.fromTo(
      gsap.utils.toArray("[data-stat]", root),
      { autoAlpha: 0, y: 20 },
      { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.1, ease: "power2.out",
        scrollTrigger: { trigger: root, start: "top 88%", once: true } },
    )
  }, [outcomes])

  if (!outcomes.length) return null

  return (
    <div ref={scope}>
      <dl className={`grid gap-3 ${compact ? "grid-cols-2 sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {outcomes.map((o, i) => {
          const parts = splitNumeric(o.value)
          return (
            <div
              key={i}
              data-stat
              data-placeholder={o.placeholder ? "true" : undefined}
              className={`relative overflow-hidden rounded-2xl border p-5 ${
                o.placeholder
                  ? "border-dashed border-violet/30 bg-violet-ghost"
                  : "border-charcoal-80/10 bg-white shadow-[0_6px_20px_rgba(93,63,211,0.05)]"
              }`}
            >
              <dd className={`font-bold tabular-nums tracking-tight text-violet ${compact ? "text-section" : "text-page"}`}>
                {parts ? (
                  <>
                    {parts.prefix}
                    <span
                      data-count={parts.number}
                      data-decimals={parts.decimals}
                      data-grouped={parts.grouped ? "true" : "false"}
                      className="inline-block text-right"
                      style={{ minWidth: `${parts.raw.length}ch` }}
                    >
                      {parts.raw}
                    </span>
                    {parts.suffix}
                  </>
                ) : (
                  o.value
                )}
                {o.placeholder ? <span aria-hidden="true" className="ml-0.5 text-azure">*</span> : null}
              </dd>
              <dt className="mt-1 text-meta leading-5 text-charcoal-80/70">{o.label}</dt>
              {o.placeholder ? (
                <span className="mt-2 inline-block rounded-full bg-white px-2 py-0.5 text-micro font-semibold uppercase tracking-[0.12em] text-azure">
                  {t("detail.placeholderBadge")}
                </span>
              ) : null}
            </div>
          )
        })}
      </dl>
      {anyPlaceholder ? (
        <p className="mt-3 text-micro leading-5 text-charcoal-80/55">{t("detail.placeholderNote")}</p>
      ) : null}
    </div>
  )
}
