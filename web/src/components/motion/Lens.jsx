import { useRef, useState } from "react"
import { useReducedMotion } from "framer-motion"

/**
 * Lens · hover-to-magnify image inspector — 21st.dev/Aceternity pattern
 * ─────────────────────────────────────────────────────────────────────────
 * Renders an image plus a circular "lens" that follows the cursor on hover,
 * showing a zoomed-in crop of the same image — handy for portfolio
 * screenshots and product photography where visitors want to inspect detail
 * without leaving the page.
 *
 * Hover-only: touch devices simply see the plain image (no fake affordance).
 * Respects prefers-reduced-motion by disabling the lens entirely.
 *
 * Usage:
 *   <div className="aspect-[16/9] overflow-hidden rounded-2xl">
 *     <Lens src={cover} alt="Project screenshot" className="h-full w-full" />
 *   </div>
 */
export default function Lens({
  src,
  alt = "",
  className = "",
  imgClassName = "object-cover",
  zoomFactor = 2.5,
  lensSize = 160,
}) {
  const containerRef = useRef(null)
  const reduced = useReducedMotion()
  const [hovering, setHovering] = useState(false)
  const [lens, setLens] = useState({ x: 0, y: 0, w: 0, h: 0 })

  const track = (e) => {
    const rect = containerRef.current.getBoundingClientRect()
    setLens({ x: e.clientX - rect.left, y: e.clientY - rect.top, w: rect.width, h: rect.height })
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${reduced ? "" : "cursor-zoom-in"} ${className}`}
      onMouseEnter={(e) => {
        if (reduced) return
        track(e)
        setHovering(true)
      }}
      onMouseMove={(e) => {
        if (reduced || !hovering) return
        track(e)
      }}
      onMouseLeave={() => setHovering(false)}
    >
      <img src={src} alt={alt} className={`h-full w-full ${imgClassName}`} />
      {hovering && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full ring-2 ring-white shadow-[0_12px_36px_rgba(26,27,35,0.35)]"
          style={{
            left: lens.x - lensSize / 2,
            top: lens.y - lensSize / 2,
            width: lensSize,
            height: lensSize,
            backgroundImage: `url(${src})`,
            backgroundSize: `${lens.w * zoomFactor}px ${lens.h * zoomFactor}px`,
            backgroundPosition: `${-(lens.x * zoomFactor - lensSize / 2)}px ${-(lens.y * zoomFactor - lensSize / 2)}px`,
          }}
        />
      )}
    </div>
  )
}
