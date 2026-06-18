import { useEffect, useRef, useState } from "react"
import { useReducedMotion } from "framer-motion"

const STYLE_ID = "ukz-confetti-kf"

function ensureKeyframes() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return
  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = `
@keyframes ukz-confetti {
  from { transform: translate(0, -16px) rotate(var(--ukz-rot-from)); opacity: 1; }
  to   { transform: translate(var(--ukz-drift), var(--ukz-fall)) rotate(var(--ukz-rot-to)); opacity: 0; }
}
`
  document.head.appendChild(style)
}

const COLORS = ["#5D3FD3", "#0284C7", "#E9C46A", "#34D399", "#FFFFFF"]
const PIECE_COUNT = 40
const LIFETIME = 2000

function makePieces(colors) {
  return Array.from({ length: PIECE_COUNT }, (_, i) => ({
    id: i,
    left: 18 + Math.random() * 64,
    drift: (Math.random() - 0.5) * 160,
    fall: 200 + Math.random() * 160,
    size: 5 + Math.random() * 7,
    rounded: Math.random() > 0.5,
    color: colors[Math.floor(Math.random() * colors.length)],
    rotateFrom: Math.random() * 360,
    rotateTo: Math.random() * 720 - 360,
    duration: 1.0 + Math.random() * 0.7,
    delay: Math.random() * 0.2,
  }))
}

/**
 * Confetti · celebratory burst for success states — 21st.dev/Magic UI pattern
 * ─────────────────────────────────────────────────────────────────────────
 * One-shot burst of brand-colored pieces that tumble down and fade out,
 * triggered whenever `fire` flips to true (e.g. a form's success state).
 * Pure CSS keyframe animation (GPU-friendly), self-cleans after ~2s, and
 * renders nothing when prefers-reduced-motion is set.
 *
 * Usage — drop inside a `relative` success panel:
 *   <div className="relative ...">
 *     <Confetti fire={success} />
 *     ...success content...
 *   </div>
 */
export default function Confetti({ fire = false, className = "", colors = COLORS }) {
  const reduced = useReducedMotion()
  const [pieces, setPieces] = useState([])
  // Latest-value ref so the fire effect doesn't depend on array identity —
  // callers may pass inline color arrays without re-triggering the burst.
  const colorsRef = useRef(colors)

  useEffect(() => {
    colorsRef.current = colors
  }, [colors])

  useEffect(() => {
    ensureKeyframes()
  }, [])

  useEffect(() => {
    if (!fire || reduced) return
    const raf = requestAnimationFrame(() => setPieces(makePieces(colorsRef.current)))
    const timer = setTimeout(() => setPieces([]), LIFETIME)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [fire, reduced])

  if (pieces.length === 0) return null

  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {pieces.map((p) => (
        <span
          key={p.id}
          className={`absolute top-0 ${p.rounded ? "rounded-full" : "rounded-sm"}`}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            "--ukz-drift": `${p.drift}px`,
            "--ukz-fall": `${p.fall}px`,
            "--ukz-rot-from": `${p.rotateFrom}deg`,
            "--ukz-rot-to": `${p.rotateTo}deg`,
            animation: `ukz-confetti ${p.duration}s ${p.delay}s cubic-bezier(0.22,1,0.36,1) forwards`,
          }}
        />
      ))}
    </div>
  )
}
