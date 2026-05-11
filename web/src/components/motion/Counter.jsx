import { useEffect, useRef, useState } from "react"
import { motion, useInView, useMotionValue, useReducedMotion, useSpring } from "framer-motion"

/**
 * Counter · animated number counter
 *
 * Counts up from 0 (or `from`) to `to` once the element enters the
 * viewport. Uses a spring for natural easing rather than linear interp.
 * Respects prefers-reduced-motion (renders the final value statically).
 *
 * Props:
 *   to        — target number (required)
 *   from      — starting number (default 0)
 *   duration  — approximate seconds to complete (default 1.6)
 *   format    — function(value: number) => string for display formatting
 *               (default: Math.round with locale separators)
 *   suffix    — appended to the display value (e.g. "+", "%", "+ yrs")
 *   prefix    — prepended (e.g. "$", "₹")
 *   className — applied to the outer span
 *
 * Example:
 *   <Counter to={6} suffix="+ years" />
 *   <Counter to={120} suffix="+ students taught" />
 *   <Counter to={47} suffix=" projects shipped" />
 */
export default function Counter({
  to,
  from = 0,
  duration = 1.6,
  format,
  suffix = "",
  prefix = "",
  className = "",
}) {
  const reduced = useReducedMotion()
  const ref     = useRef(null)
  const inView  = useInView(ref, { once: true, amount: 0.5 })

  const motionValue = useMotionValue(from)
  // Damping derived from duration: target ~95% of the way at `duration` seconds.
  // useSpring's stiffness/damping pair here yields a calm climb without bounce.
  const spring = useSpring(motionValue, {
    stiffness: 80,
    damping:   28,
    mass:      1,
    restDelta: 0.5,
  })

  const [display, setDisplay] = useState(() => formatValue(from, format))

  useEffect(() => {
    if (!inView || reduced) return
    motionValue.set(to)
  }, [inView, reduced, to, motionValue, duration])

  useEffect(() => {
    return spring.on("change", (latest) => {
      setDisplay(formatValue(latest, format))
    })
  }, [spring, format])

  // When reduced motion is requested, skip the animation entirely and
  // show the target value immediately on mount.
  useEffect(() => {
    if (reduced) setDisplay(formatValue(to, format))
  }, [reduced, to, format])

  return (
    <motion.span ref={ref} className={className} aria-label={`${prefix}${to}${suffix}`}>
      <span aria-hidden="true">
        {prefix}{display}{suffix}
      </span>
    </motion.span>
  )
}

function formatValue(value, format) {
  if (typeof format === "function") return format(value)
  return Math.round(value).toLocaleString()
}
