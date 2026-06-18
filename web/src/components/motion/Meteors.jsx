import { useEffect, useState } from "react"
import { useReducedMotion } from "framer-motion"

const STYLE_ID = "ukz-meteors-kf"

function ensureKeyframes() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return
  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = `
@keyframes ukz-meteor {
  0% { transform: translate3d(0, 0, 0) rotate(45deg); opacity: 1; }
  65% { opacity: 1; }
  100% { transform: translate3d(-420px, 420px, 0) rotate(45deg); opacity: 0; }
}
`
  document.head.appendChild(style)
}

const COLORS = ["#7DD3FC", "#5D3FD3", "#0284C7"]

/**
 * Meteors · diagonal shooting-star streaks for dark surfaces — 21st.dev/Magic UI pattern
 * ─────────────────────────────────────────────────────────────────────────
 * A field of thin brand-colored gradient streaks fall diagonally and fade
 * out on loop, giving a dark section ("Solutions" on Home) a subtle sense
 * of motion and depth. Pure CSS keyframes (GPU-accelerated translate3d) —
 * no canvas, no per-frame JS.
 *
 * Respects prefers-reduced-motion by rendering nothing.
 *
 * Usage — place as the first child of a `relative isolate overflow-hidden`
 * dark section; the wrapper is absolutely positioned and inert:
 *   <section className="relative isolate overflow-hidden ...">
 *     <Meteors number={20} />
 *     <Container>…</Container>
 *   </section>
 */
export default function Meteors({ number = 20, className = "" }) {
  const reduced = useReducedMotion()

  // Lazy initializer runs once on mount — the sanctioned place for one-time
  // randomness, so re-renders stay pure/idempotent.
  const [meteors] = useState(() =>
    Array.from({ length: number }).map((_, idx) => ({
      color: COLORS[idx % COLORS.length],
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      duration: (Math.random() * 5 + 4).toFixed(2),
      delay: (Math.random() * 6).toFixed(2),
    }))
  )

  useEffect(() => {
    ensureKeyframes()
  }, [])

  if (reduced) return null

  return (
    <div
      className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {meteors.map((m, idx) => (
        <span
          key={idx}
          className="absolute h-px w-[90px] rounded-full"
          style={{
            top: m.top,
            left: m.left,
            background: `linear-gradient(90deg, ${m.color}, transparent)`,
            boxShadow: `0 0 8px 0 ${m.color}80`,
            animationName: "ukz-meteor",
            animationDuration: `${m.duration}s`,
            animationDelay: `${m.delay}s`,
            animationIterationCount: "infinite",
            animationTimingFunction: "linear",
            animationFillMode: "backwards",
          }}
        />
      ))}
    </div>
  )
}
