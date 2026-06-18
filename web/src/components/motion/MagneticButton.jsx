import { useRef, useCallback } from "react"
import { motion, useReducedMotion } from "framer-motion"

/**
 * MagneticButton · cursor-following magnetic hover — 21st.dev pattern
 * ─────────────────────────────────────────────────────────────────────────
 * Wraps any element (typically a CTA button or social icon) and applies a
 * subtle magnetic pull: the element drifts toward the cursor as it enters
 * the proximity zone, snapping back on leave.
 *
 * The effect is driven by direct DOM manipulation via Framer Motion's
 * `animate()` imperative API — zero React re-renders on pointer events.
 *
 * Reduced-motion: the magnetic effect is disabled; the element renders
 * statically with its normal hover transitions intact.
 *
 * Props:
 *   children      — the button/icon/element to magnetize
 *   strength      — movement range in px (default 12 — subtle)
 *   className     — outer wrapper classes
 *
 * Usage:
 *   <MagneticButton>
 *     <Link to="/contact" className="…">Book a call</Link>
 *   </MagneticButton>
 */
export default function MagneticButton({
  children,
  strength = 12,
  className = "",
}) {
  const ref = useRef(null)
  const reduced = useReducedMotion()

  const onMouseMove = useCallback((e) => {
    if (reduced || !ref.current) return
    const { left, top, width, height } = ref.current.getBoundingClientRect()
    const x = (e.clientX - left - width  / 2) / width  * strength * 2
    const y = (e.clientY - top  - height / 2) / height * strength * 2
    ref.current.style.transform = `translate(${x}px, ${y}px)`
  }, [reduced, strength])

  const onMouseLeave = useCallback(() => {
    if (!ref.current) return
    ref.current.style.transition = "transform 0.45s cubic-bezier(0.34,1.56,0.64,1)"
    ref.current.style.transform = "translate(0px, 0px)"
    setTimeout(() => {
      if (ref.current) ref.current.style.transition = ""
    }, 450)
  }, [])

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={`inline-flex ${className}`}
      style={{ willChange: "transform" }}
    >
      {children}
    </div>
  )
}
