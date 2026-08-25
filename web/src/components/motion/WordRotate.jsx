import { useEffect, useState } from "react"
import { AnimatePresence, m, useReducedMotion } from "framer-motion"

/**
 * WordRotate · cycling word animation — 21st.dev signature pattern
 * ─────────────────────────────────────────────────────────────────────────
 * Cycles through an array of words with a smooth vertical slide-in/out.
 * Each word exits upward while the next slides in from below, creating
 * a "flipping scoreboard" effect at a human-readable cadence.
 *
 * Reduced-motion: the words still rotate but without movement (just a
 * cross-fade), so the meaning is preserved without violating a11y.
 *
 * Props:
 *   words       — string[]  words to cycle (required)
 *   interval    — number    ms between rotations (default 2400)
 *   className   — string    applied to the outer span
 *   wordClass   — string    applied to each individual word span
 *
 * Usage:
 *   <WordRotate
 *     words={["technology", "education", "your business"]}
 *     className="text-violet font-extrabold"
 *   />
 */
export default function WordRotate({
  words = [],
  interval = 2400,
  className = "",
  wordClass = "",
}) {
  const [index, setIndex] = useState(0)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (words.length <= 1) return
    const id = setInterval(
      () => setIndex((i) => (i + 1) % words.length),
      interval,
    )
    return () => clearInterval(id)
  }, [words.length, interval])

  const variants = reduced
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.3 } },
        exit:    { opacity: 0, transition: { duration: 0.2 } },
      }
    : {
        initial: { opacity: 0, y: 20, filter: "blur(4px)" },
        animate: {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
        },
        exit: {
          opacity: 0,
          y: -18,
          filter: "blur(3px)",
          transition: { duration: 0.28, ease: [0.4, 0, 1, 1] },
        },
      }

  return (
    <span className={`relative inline-block overflow-hidden ${className}`}>
      <AnimatePresence mode="wait">
        <m.span
          key={words[index]}
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          className={`inline-block ${wordClass}`}
        >
          {words[index]}
        </m.span>
      </AnimatePresence>
    </span>
  )
}
