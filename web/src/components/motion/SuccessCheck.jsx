// ════════════════════════════════════════════════════════════════════════════
// SuccessCheck · motion primitive · roadmap step 35
// ────────────────────────────────────────────────────────────────────────────
// Circle pop + checkmark path-draw rendered as inline SVG via LazyMotion `m.`
// (no Lottie payload needed — the whole asset is ~10 lines of SVG).
//
// · Fixed width/height → zero layout shift while the draw animates.
// · Honours `useReducedMotion`: renders the final frame with no transition.
//
// Props:
//   size       · px (default 96)
//   tone       · "mint" (filled disc, white stroke) · "inline" (no disc, currentColor stroke)
//   delay      · seconds before the draw starts
//   label      · accessible label (omit → aria-hidden decorative)
// ════════════════════════════════════════════════════════════════════════════
import { m, useReducedMotion } from "framer-motion"

const EASE = [0.16, 1, 0.3, 1]

export default function SuccessCheck({ size = 96, tone = "mint", delay = 0, label, className = "" }) {
  const reduced = useReducedMotion()
  const inline = tone === "inline"
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true }

  return (
    <m.svg
      width={size} height={size} viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg"
      className={className} style={{ display: "block", flexShrink: 0 }}
      initial={reduced ? false : { scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4, ease: EASE, delay }}
      {...a11y}
    >
      {!inline && (
        <m.circle
          cx="48" cy="48" r="44" fill="var(--color-mint, var(--color-mint-light))"
          initial={reduced ? false : { scale: 0 }} animate={{ scale: 1 }}
          style={{ transformOrigin: "48px 48px" }}
          transition={{ duration: 0.4, ease: EASE, delay }}
        />
      )}
      <m.path
        d="M30 50 L43 63 L66 36" fill="none"
        stroke={inline ? "currentColor" : "white"}
        strokeWidth={inline ? 10 : 6} strokeLinecap="round" strokeLinejoin="round"
        initial={reduced ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.3, ease: EASE, delay: delay + (inline ? 0 : 0.18) }}
      />
    </m.svg>
  )
}

export { SuccessCheck }
