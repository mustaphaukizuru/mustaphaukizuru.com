import { motion, useReducedMotion } from "framer-motion"

/**
 * Reveal · scroll-reveal wrapper
 *
 * Animates its children in once they enter the viewport. Plays once by
 * default (no re-trigger when re-scrolling past). Respects
 * prefers-reduced-motion automatically — when reduced motion is requested
 * the children render with no transform / opacity change.
 *
 * Defaults intentionally lean conservative — slight upward translation,
 * 450ms ease-out, viewport margin so the trigger fires slightly *before*
 * the element is fully in view. Override per-call when needed.
 *
 * Props:
 *   children     — anything renderable
 *   as           — element to render (default "div")
 *   delay        — seconds to wait after viewport enter (default 0)
 *   y            — initial translateY in px (default 24)
 *   duration     — seconds (default 0.55)
 *   once         — true → fire one time, false → on every viewport enter
 *   amount       — fraction of element in view before firing (default 0.2)
 *   className    — passed through
 *   role/aria-*  — passed through
 */
export default function Reveal({
  children,
  as = "div",
  delay = 0,
  y = 24,
  duration = 0.55,
  once = true,
  amount = 0.2,
  className = "",
  ...rest
}) {
  const reduced = useReducedMotion()
  const MotionTag = motion[as] || motion.div

  if (reduced) {
    const Tag = as
    return <Tag className={className} {...rest}>{children}</Tag>
  }

  return (
    <MotionTag
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount, margin: "0px 0px -80px 0px" }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
      {...rest}
    >
      {children}
    </MotionTag>
  )
}
