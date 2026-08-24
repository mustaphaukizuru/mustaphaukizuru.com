import { useEffect, useRef } from "react"
import { useReducedMotion } from "framer-motion"

/**
 * ScrollProgress · thin reading-progress bar at the top of the viewport
 * ─────────────────────────────────────────────────────────────────────────
 * A fixed-position bar that fills from left to right as the user scrolls
 * the page. Uses a passive scroll listener and direct DOM manipulation
 * (no React re-renders) for 60fps performance on any device.
 *
 * Respects prefers-reduced-motion: renders as a static translucent bar.
 *
 * Brand token: uses the Innovation Gradient (--grad-innovation).
 *
 * Props:
 *   height     — bar height in px (default 3)
 *   zIndex     — CSS z-index (default 9999, above nav)
 */
export default function ScrollProgress({ height = 3, zIndex = 9999 }) {
  const barRef = useRef(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const bar = barRef.current
    if (!bar || reduced) return

    const update = () => {
      const scrollTop    = window.scrollY || document.documentElement.scrollTop
      const docHeight    = document.documentElement.scrollHeight - window.innerHeight
      const progress     = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0
      bar.style.transform = `scaleX(${progress})`
    }

    window.addEventListener("scroll", update, { passive: true })
    update()
    return () => window.removeEventListener("scroll", update)
  }, [reduced])

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: height,
        zIndex,
        pointerEvents: "none",
      }}
    >
      <div
        ref={barRef}
        style={{
          height: "100%",
          width: "100%",
          background: "linear-gradient(90deg, var(--color-violet), var(--color-azure))",
          transformOrigin: "left center",
          transform: "scaleX(0)",
          transition: reduced ? "none" : undefined,
          opacity: reduced ? 0.4 : 1,
        }}
      />
    </div>
  )
}
