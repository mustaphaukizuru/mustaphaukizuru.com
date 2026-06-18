import { useEffect, useRef, useCallback } from "react"
import { useReducedMotion } from "framer-motion"

/**
 * Particles · canvas-based floating particle field
 * ─────────────────────────────────────────────────────────────────────────
 * Renders a GPU-accelerated canvas layer with softly floating, fading
 * particles. Particles respond to mouse proximity (within `interactRadius`)
 * by gently drifting away — creating a "living" background feel.
 *
 * Adapted from MagicUI / 21st.dev particle pattern, rewritten for:
 *   · Tailwind v4 / brand token colors
 *   · prefers-reduced-motion (completely static fallback)
 *   · ResizeObserver for responsive canvas sizing
 *   · requestAnimationFrame with cleanup on unmount
 *
 * Props:
 *   quantity        — number of particles (default 80)
 *   color           — hex color string (default brand violet)
 *   size            — base particle radius in px (default 1.5)
 *   speed           — movement speed multiplier (default 0.4)
 *   interactRadius  — mouse repulsion radius in px (default 120)
 *   interactStrength — repulsion force (default 3)
 *   className       — applied to the outer wrapper div
 *   style           — applied to the canvas
 *   refresh         — bump this value to reset all particles
 */
export default function Particles({
  quantity = 80,
  color = "#5D3FD3",
  size = 1.5,
  speed = 0.4,
  interactRadius = 120,
  interactStrength = 3,
  className = "",
  style = {},
  refresh = 0,
}) {
  const canvasRef = useRef(null)
  const particles  = useRef([])
  const mouse      = useRef({ x: -9999, y: -9999 })
  const animId     = useRef(null)
  const reduced    = useReducedMotion()

  /* ── Parse hex → [r,g,b] once ─────────────────────────────────────── */
  const parseHex = useCallback((hex) => {
    const clean = hex.replace("#", "")
    const full  = clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ]
  }, [])

  /* ── Initialise / reset particles ─────────────────────────────────── */
  const init = useCallback((canvas) => {
    const W = canvas.width
    const H = canvas.height
    particles.current = Array.from({ length: quantity }, () => ({
      x:      Math.random() * W,
      y:      Math.random() * H,
      vx:     (Math.random() - 0.5) * speed,
      vy:     (Math.random() - 0.5) * speed,
      alpha:  Math.random() * 0.5 + 0.15,
      r:      size * (Math.random() * 0.8 + 0.6),
      phase:  Math.random() * Math.PI * 2,  // for alpha pulsing
    }))
  }, [quantity, speed, size])

  /* ── Main draw loop ────────────────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    const [r, g, b] = parseHex(color)

    /* size canvas to its CSS box */
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      canvas.width  = Math.floor(width  * devicePixelRatio)
      canvas.height = Math.floor(height * devicePixelRatio)
      ctx.scale(devicePixelRatio, devicePixelRatio)
      init(canvas)
    })
    observer.observe(canvas)

    /* mouse tracking */
    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      mouse.current.x = e.clientX - rect.left
      mouse.current.y = e.clientY - rect.top
    }
    const onMouseLeave = () => {
      mouse.current.x = -9999
      mouse.current.y = -9999
    }
    canvas.addEventListener("mousemove", onMouseMove, { passive: true })
    canvas.addEventListener("mouseleave", onMouseLeave)

    /* reduced-motion: just draw a static field, no animation */
    if (reduced) {
      const W = canvas.offsetWidth
      const H = canvas.offsetHeight
      canvas.width  = W * devicePixelRatio
      canvas.height = H * devicePixelRatio
      ctx.scale(devicePixelRatio, devicePixelRatio)
      init(canvas)
      ctx.clearRect(0, 0, W, H)
      particles.current.forEach((p) => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${r},${g},${b},${p.alpha})`
        ctx.fill()
      })
      return () => observer.disconnect()
    }

    /* animated loop */
    let t = 0
    const draw = () => {
      const W = canvas.offsetWidth
      const H = canvas.offsetHeight
      ctx.clearRect(0, 0, W, H)
      t += 0.008

      particles.current.forEach((p) => {
        /* gentle alpha pulse */
        const a = p.alpha * (0.7 + 0.3 * Math.sin(t + p.phase))

        /* mouse repulsion */
        const dx = p.x - mouse.current.x
        const dy = p.y - mouse.current.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < interactRadius && dist > 0) {
          const force = (1 - dist / interactRadius) * interactStrength
          p.x += (dx / dist) * force
          p.y += (dy / dist) * force
        }

        /* move */
        p.x += p.vx
        p.y += p.vy

        /* wrap at edges */
        if (p.x < -p.r)  p.x = W + p.r
        if (p.x > W + p.r) p.x = -p.r
        if (p.y < -p.r)  p.y = H + p.r
        if (p.y > H + p.r) p.y = -p.r

        /* draw */
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${r},${g},${b},${a})`
        ctx.fill()
      })

      animId.current = requestAnimationFrame(draw)
    }

    animId.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animId.current)
      observer.disconnect()
      canvas.removeEventListener("mousemove", onMouseMove)
      canvas.removeEventListener("mouseleave", onMouseLeave)
    }
  }, [color, quantity, speed, size, interactRadius, interactStrength, reduced, refresh, init, parseHex])

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        style={style}
      />
    </div>
  )
}
