// ════════════════════════════════════════════════════════════════════════════
// Stat · system composite · v1.0
// ────────────────────────────────────────────────────────────────────────────
// A KPI tile that displays:
//   ┌──────────────────────────┐
//   │ LABEL  (text-meta upper) │
//   │  42                      │   ← AnimatedCount, JetBrains Mono numerals
//   │  caption (optional)      │
//   └──────────────────────────┘
//
// Behaviours:
//   · Counts up from 0 to `value` over ~900ms when scrolled into view.
//   · prefers-reduced-motion → renders the final value directly, no animation.
//   · IntersectionObserver-gated so it only runs once per page-view.
//   · Supports `prefix` (e.g. "$"), `suffix` (e.g. "%", "+"), and `decimals`.
//   · Non-numeric `value` (string) is rendered as-is, no animation.
//
// Trend chip (optional):
//   · `trend` is a number — green if ≥ 0, red if < 0
//   · Renders as ↑ 12% / ↓ 4% beside the caption
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react"

// Easing — cubic-out matches --ease-decelerate for a smooth deceleration
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

function AnimatedCount({ to, duration = 900, decimals = 0 }) {
  const [n, setN] = useState(0)
  const ref = useRef(null)
  const startedRef = useRef(false)
  const reducedMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  )

  useEffect(() => {
    if (!ref.current) return

    if (reducedMotion.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- skip animation under reduced motion
      setN(to)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !startedRef.current) {
            startedRef.current = true
            const start = performance.now()
            const tick = (now) => {
              const t = Math.min((now - start) / duration, 1)
              setN(to * easeOutCubic(t))
              if (t < 1) requestAnimationFrame(tick)
            }
            requestAnimationFrame(tick)
          }
        })
      },
      { threshold: 0.4 },
    )

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [to, duration])

  return <span ref={ref}>{n.toFixed(decimals)}</span>
}

/**
 * Stat · single KPI tile.
 *
 * Props:
 *   label      · string  (e.g. "Active projects")
 *   value      · number | string — number animates up; string renders as-is
 *   prefix?    · string (e.g. "$")
 *   suffix?    · string (e.g. "%", "+")
 *   decimals?  · integer (default 0)
 *   caption?   · string (small descriptor below the value)
 *   trend?     · number — percentage; positive = green, negative = red
 *   icon?      · Lucide component (small, optional, top-right)
 *   onDark?    · boolean — invert palette for dark cards
 *   className? · outer wrapper class
 */
export default function Stat({
  label,
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  caption,
  trend,
  icon: Icon,
  onDark = false,
  className = "",
}) {
  const isNumeric = typeof value === "number" && Number.isFinite(value)

  const labelClass = onDark
    ? "text-[var(--color-text-on-dark-muted)]"
    : "text-[var(--color-text-muted)]"
  const valueClass = onDark
    ? "text-[var(--color-text-on-dark)]"
    : "text-[var(--color-violet)]"
  const captionClass = onDark
    ? "text-[var(--color-text-on-dark-muted)]"
    : "text-[var(--color-text-muted)]"

  return (
    <div
      className={[
        "flex flex-col gap-1.5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`text-meta uppercase tracking-[0.12em] ${labelClass}`}>
          {label}
        </span>
        {Icon && (
          <Icon
            className={`h-4 w-4 shrink-0 ${onDark ? "text-[var(--color-text-on-dark-muted)]" : "text-[var(--color-text-muted)]"}`}
            aria-hidden="true"
          />
        )}
      </div>

      <div
        className={`font-bold leading-[1.05] tracking-tight ${valueClass}`}
        style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-page-size)", fontVariantNumeric: "tabular-nums" }}
      >
        {prefix}
        {isNumeric ? <AnimatedCount to={value} decimals={decimals} /> : value}
        {suffix}
      </div>

      {(caption || trend !== undefined) && (
        <div className="flex items-center gap-2">
          {trend !== undefined && (
            <span
              className={
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums " +
                (trend >= 0
                  ? "bg-[var(--color-feedback-success-bg)] text-[var(--color-feedback-success-text)]"
                  : "bg-[var(--color-feedback-danger-bg)] text-[var(--color-feedback-danger-text)]")
              }
              aria-label={`${trend >= 0 ? "up" : "down"} ${Math.abs(trend)} percent`}
            >
              <span aria-hidden="true">{trend >= 0 ? "↑" : "↓"}</span>
              {Math.abs(trend)}%
            </span>
          )}
          {caption && <span className={`text-[12px] ${captionClass}`}>{caption}</span>}
        </div>
      )}
    </div>
  )
}

export { Stat, AnimatedCount }
