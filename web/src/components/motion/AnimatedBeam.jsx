import { useEffect, useId, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"

const MotionLinearGradient = motion.linearGradient

/**
 * AnimatedBeam · gradient pulse traveling along a curve between two elements
 * ─────────────────────────────────────────────────────────────────────────
 * 21st.dev/Magic UI pattern: draws an SVG path between the centers of two
 * ref'd DOM nodes (relative to a shared container) and animates a brand
 * gradient stroke that travels back and forth along it on loop — used to
 * visually "connect" related cards/steps.
 *
 * The path recalculates on container resize via ResizeObserver, so it stays
 * correct across responsive breakpoints.
 *
 * Respects prefers-reduced-motion by rendering only the static base path
 * (no traveling gradient).
 *
 * Usage:
 *   const containerRef = useRef(null)
 *   const aRef = useRef(null)
 *   const bRef = useRef(null)
 *   <div ref={containerRef} className="relative ...">
 *     <div ref={aRef}>Card A</div>
 *     <div ref={bRef}>Card B</div>
 *     <AnimatedBeam containerRef={containerRef} fromRef={aRef} toRef={bRef} />
 *   </div>
 */
export default function AnimatedBeam({
  className = "",
  containerRef,
  fromRef,
  toRef,
  curvature = 0,
  reverse = false,
  duration = 4,
  delay = 0,
  pathColor = "#5D3FD3",
  pathWidth = 2,
  pathOpacity = 0.12,
  gradientStartColor = "#5D3FD3",
  gradientStopColor = "#0284C7",
  fromAnchor = "center",
  toAnchor = "center",
  startXOffset = 0,
  startYOffset = 0,
  endXOffset = 0,
  endYOffset = 0,
}) {
  const id = useId()
  const reduced = useReducedMotion()
  const [pathD, setPathD] = useState("")
  const [dims, setDims] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const updatePath = () => {
      const container = containerRef.current
      const from = fromRef.current
      const to = toRef.current
      if (!container || !from || !to) return

      const containerRect = container.getBoundingClientRect()
      const fromRect = from.getBoundingClientRect()
      const toRect = to.getBoundingClientRect()

      setDims({ width: containerRect.width, height: containerRect.height })

      const anchorPoint = (rect, anchor) => {
        switch (anchor) {
          case "left":   return { x: rect.left, y: rect.top + rect.height / 2 }
          case "right":  return { x: rect.right, y: rect.top + rect.height / 2 }
          case "top":    return { x: rect.left + rect.width / 2, y: rect.top }
          case "bottom": return { x: rect.left + rect.width / 2, y: rect.bottom }
          default:       return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        }
      }
      const fromPoint = anchorPoint(fromRect, fromAnchor)
      const toPoint = anchorPoint(toRect, toAnchor)

      const startX = fromPoint.x - containerRect.left + startXOffset
      const startY = fromPoint.y - containerRect.top + startYOffset
      const endX = toPoint.x - containerRect.left + endXOffset
      const endY = toPoint.y - containerRect.top + endYOffset

      const controlX = (startX + endX) / 2
      const controlY = (startY + endY) / 2 - curvature

      setPathD(`M ${startX},${startY} Q ${controlX},${controlY} ${endX},${endY}`)
    }

    updatePath()

    const observer = new ResizeObserver(updatePath)
    if (containerRef.current) observer.observe(containerRef.current)
    window.addEventListener("resize", updatePath)

    return () => {
      observer.disconnect()
      window.removeEventListener("resize", updatePath)
    }
  }, [containerRef, fromRef, toRef, curvature, fromAnchor, toAnchor, startXOffset, startYOffset, endXOffset, endYOffset])

  if (!pathD) return null

  const gradientCoords = reverse
    ? { x1: ["90%", "-10%"], x2: ["100%", "0%"] }
    : { x1: ["10%", "110%"], x2: ["0%", "100%"] }

  return (
    <svg
      fill="none"
      width={dims.width}
      height={dims.height}
      viewBox={`0 0 ${dims.width} ${dims.height}`}
      className={`pointer-events-none absolute left-0 top-0 ${className}`}
      aria-hidden="true"
    >
      <path d={pathD} stroke={pathColor} strokeWidth={pathWidth} strokeOpacity={pathOpacity} strokeLinecap="round" />
      {!reduced && (
        <>
          <path d={pathD} stroke={`url(#${id})`} strokeWidth={pathWidth} strokeLinecap="round" />
          <defs>
            <MotionLinearGradient
              id={id}
              gradientUnits="userSpaceOnUse"
              initial={{ x1: "0%", x2: "0%", y1: "0%", y2: "0%" }}
              animate={{ x1: gradientCoords.x1, x2: gradientCoords.x2, y1: "0%", y2: "0%" }}
              transition={{ delay, duration, repeat: Infinity, ease: [0.16, 1, 0.3, 1] }}
            >
              <stop stopColor={gradientStartColor} stopOpacity="0" />
              <stop stopColor={gradientStartColor} />
              <stop offset="32.5%" stopColor={gradientStopColor} />
              <stop offset="100%" stopColor={gradientStopColor} stopOpacity="0" />
            </MotionLinearGradient>
          </defs>
        </>
      )}
    </svg>
  )
}
