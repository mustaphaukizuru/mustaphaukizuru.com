import { TOKENS } from "../../styles/tokens.js"
/**
 * BorderBeam · animated light beam tracing a card border — 21st.dev signature
 * ─────────────────────────────────────────────────────────────────────────
 * A conic-gradient "searchlight" that rotates along the border of its parent
 * element via CSS animation. The parent must have `position: relative` and
 * `overflow: hidden`.
 *
 * Implementation uses a pseudo-element approach via an absolutely-positioned
 * div with a rotating conic-gradient — no canvas, no JS RAF, pure CSS so
 * it runs on the compositor thread at 60fps with zero React re-renders.
 *
 * Reduced-motion: the beam simply disappears (the card border remains via
 * the parent's own `border` class — BorderBeam is purely additive).
 *
 * Props:
 *   size        — beam spread px (default 200) — larger = wider glow
 *   duration    — animation loop in seconds (default 8)
 *   colorFrom   — beam start color (default brand violet)
 *   colorTo     — beam end color (default brand azure)
 *   delay       — animation delay in seconds (default 0)
 *   className   — extra classes on the beam div
 *
 * Usage (parent MUST have `relative overflow-hidden rounded-xl`):
 *   <div className="relative overflow-hidden rounded-xl border border-charcoal-80/10">
 *     <BorderBeam />
 *     …card content…
 *   </div>
 */
export default function BorderBeam({
  size = 200,
  duration = 8,
  colorFrom = TOKENS.violet,
  colorTo = TOKENS.azure,
  delay = 0,
  className = "",
}) {
  /* Inject keyframe once */
  const styleId = "ukz-border-beam-kf"
  if (typeof document !== "undefined" && !document.getElementById(styleId)) {
    const el = document.createElement("style")
    el.id = styleId
    el.textContent = `
      @keyframes ukz-border-beam {
        100% { offset-distance: 100%; }
      }
      @media (prefers-reduced-motion: reduce) {
        .ukz-border-beam-el { display: none !important; }
      }
    `
    document.head.appendChild(el)
  }

  return (
    <div
      aria-hidden="true"
      className={`ukz-border-beam-el pointer-events-none absolute inset-0 rounded-[inherit] ${className}`}
      style={{ zIndex: 0 }}
    >
      {/* Outer glow ring */}
      <div
        style={{
          position: "absolute",
          inset: -1,
          borderRadius: "inherit",
          background: "transparent",
          border: "1px solid transparent",
          backgroundImage: `linear-gradient(white, white), linear-gradient(90deg, transparent 40%, ${colorFrom}, ${colorTo}, transparent 60%)`,
          backgroundOrigin: "border-box",
          backgroundClip: "padding-box, border-box",
          animation: `ukz-border-beam ${duration}s linear ${delay}s infinite`,
          /* Rotate the gradient-based border */
          WebkitMask: "linear-gradient(white, white) padding-box, linear-gradient(white, white)",
          WebkitMaskComposite: "destination-out",
          maskComposite: "exclude",
        }}
      />
      {/* Traveling light beam spot */}
      <span
        style={{
          position: "absolute",
          aspectRatio: "1",
          width: size,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${colorFrom}55 0%, ${colorTo}22 50%, transparent 70%)`,
          offsetPath: `rect(0 auto auto 0 round inherit)`,
          animation: `ukz-border-beam ${duration}s linear ${delay}s infinite`,
          top: 0,
          left: 0,
          transform: "translate(-50%, -50%)",
          filter: "blur(6px)",
        }}
      />
    </div>
  )
}
