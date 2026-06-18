import { useRef, useCallback } from "react"

/**
 * SpotlightCard · mouse-following radial glow inside a card — 21st.dev pattern
 * ─────────────────────────────────────────────────────────────────────────
 * As the mouse moves over the card, a soft radial gradient follows the
 * cursor, creating a "spotlight" effect that reveals subtle depth beneath
 * the surface. Pure CSS + a single mousemove listener — no React state,
 * no re-renders, runs at pointer-event speed.
 *
 * The spotlight is transparent by default and reveals a violet-tinted glow
 * on hover, matching Brand Identity v3 §10 "Glass & Glow Strategy".
 *
 * Usage — wraps any card content:
 *   <SpotlightCard className="rounded-xl border border-charcoal-80/10 bg-white p-6">
 *     …card content…
 *   </SpotlightCard>
 *
 * Props:
 *   children      — React node
 *   className     — outer div classes (padding, border, bg, radius)
 *   spotColor     — radial glow color (default brand violet at 10%)
 *   size          — spotlight radius in px (default 340)
 *   as            — tag override (default "div")
 */
export default function SpotlightCard({
  children,
  className = "",
  spotColor = "rgba(93,63,211,0.10)",
  size = 340,
  as: Tag = "div",
  ...rest
}) {
  const cardRef = useRef(null)

  const onMouseMove = useCallback((e) => {
    const card = cardRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    card.style.setProperty("--spot-x", `${x}px`)
    card.style.setProperty("--spot-y", `${y}px`)
    card.style.setProperty("--spot-opacity", "1")
  }, [])

  const onMouseLeave = useCallback(() => {
    const card = cardRef.current
    if (!card) return
    card.style.setProperty("--spot-opacity", "0")
  }, [])

  return (
    <Tag
      ref={cardRef}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={`relative overflow-hidden ${className}`}
      {...rest}
      style={{
        "--spot-x": "50%",
        "--spot-y": "50%",
        "--spot-opacity": "0",
        "--spot-size": `${size}px`,
        "--spot-color": spotColor,
      }}
    >
      {/* The spotlight layer — sits above bg, below content */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          background: `radial-gradient(var(--spot-size) circle at var(--spot-x) var(--spot-y), var(--spot-color), transparent 65%)`,
          opacity: "var(--spot-opacity)",
          transition: "opacity 0.25s ease",
        }}
      />
      {/* Content sits above the spotlight */}
      <div className="relative z-10">
        {children}
      </div>
    </Tag>
  )
}
