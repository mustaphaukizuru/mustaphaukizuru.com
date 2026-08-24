import { useEffect, useRef } from "react"
import { createHeroDepth } from "./heroDepth/renderer"

/**
 * HeroDepth — desktop-only animated gradient mesh behind the Home hero
 * (roadmap step 34). Loaded lazily by HomeHero after `load` + idle; this
 * file is its own chunk. It never affects layout: absolutely positioned,
 * pointer-events none, aria-hidden, fades in over the static gradient.
 *
 * Pauses when the hero leaves the viewport (IntersectionObserver) and when
 * the tab is hidden (visibilitychange); the renderer caps itself at 30 fps.
 */
export default function HeroDepth() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const fx = createHeroDepth(canvas)
    if (!fx) return undefined

    let visible = true
    const sync = () => {
      if (visible && document.visibilityState === "visible") fx.start()
      else fx.stop()
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
        sync()
      },
      { threshold: 0 },
    )
    io.observe(canvas)
    document.addEventListener("visibilitychange", sync)
    sync()

    // fade in on the next frame so the static gradient never "pops"
    const fade = requestAnimationFrame(() => {
      canvas.style.opacity = "1"
    })

    return () => {
      cancelAnimationFrame(fade)
      io.disconnect()
      document.removeEventListener("visibilitychange", sync)
      fx.destroy()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ opacity: 0, transition: "opacity 1.2s ease-out", willChange: "opacity" }}
    />
  )
}
