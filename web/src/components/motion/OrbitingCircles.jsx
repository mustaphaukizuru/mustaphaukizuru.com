import { useEffect } from "react"
import { useReducedMotion } from "framer-motion"

const STYLE_ID = "ukz-orbit-kf"

function ensureKeyframes() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return
  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = `
@keyframes ukz-orbit {
  from { transform: rotate(0deg) translateY(calc(-1 * var(--ukz-radius))) rotate(0deg); }
  to   { transform: rotate(360deg) translateY(calc(-1 * var(--ukz-radius))) rotate(-360deg); }
}
@keyframes ukz-orbit-rev {
  from { transform: rotate(360deg) translateY(calc(-1 * var(--ukz-radius))) rotate(-360deg); }
  to   { transform: rotate(0deg) translateY(calc(-1 * var(--ukz-radius))) rotate(0deg); }
}
`
  document.head.appendChild(style)
}

/**
 * OrbitingCircles · satellite items circling a center point — 21st.dev/Magic UI pattern
 * ─────────────────────────────────────────────────────────────────────────
 * Each child is placed on a circular orbit of the given radius and animated
 * around the center on loop via CSS (rotate + translate + counter-rotate,
 * so the satellite itself stays upright). A faint dashed ring marks the
 * orbit path.
 *
 * Decorative only — always `aria-hidden`. With reduced motion, satellites
 * are laid out statically at evenly-spaced angles instead of animating.
 *
 * Usage — absolutely position the wrapper over/within a host element:
 *   <div className="relative h-24 w-24">
 *     <OrbitingCircles radius={34} duration={24} className="inset-0 text-azure">
 *       <span>🇷🇼</span>
 *       <span>🇹🇷</span>
 *       <span>🇪🇹</span>
 *       <span>🇲🇽</span>
 *     </OrbitingCircles>
 *   </div>
 */
export default function OrbitingCircles({
  className = "",
  children = [],
  radius = 60,
  duration = 20,
  reverse = false,
  path = true,
  iconClassName = "",
}) {
  const reduced = useReducedMotion()

  useEffect(() => {
    ensureKeyframes()
  }, [])

  const items = Array.isArray(children) ? children : [children]
  const count = items.length || 1

  return (
    <div className={`pointer-events-none absolute flex items-center justify-center ${className}`} aria-hidden="true">
      {path && (
        <span
          className="absolute rounded-full border border-dashed border-current opacity-15"
          style={{ width: radius * 2, height: radius * 2 }}
        />
      )}
      {items.map((child, i) => {
        const angle = (360 / count) * i
        const style = reduced
          ? { transform: `rotate(${angle}deg) translateY(-${radius}px) rotate(-${angle}deg)` }
          : {
              "--ukz-radius": `${radius}px`,
              animation: `${reverse ? "ukz-orbit-rev" : "ukz-orbit"} ${duration}s linear infinite`,
              animationDelay: `-${(angle / 360) * duration}s`,
            }
        return (
          <span key={i} className={`absolute flex items-center justify-center ${iconClassName}`} style={style}>
            {child}
          </span>
        )
      })}
    </div>
  )
}
