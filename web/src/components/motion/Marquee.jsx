import { Children, useMemo } from "react"
import { useReducedMotion } from "framer-motion"

/**
 * Marquee · infinite horizontal ticker
 *
 * Renders its children inline in a CSS-driven, GPU-accelerated infinite
 * scroll. Two copies of the children are emitted so the loop is seamless;
 * a CSS keyframe animation translates the inner track from 0% to -50%
 * (the width of one copy) and loops forever. Pause on hover by default.
 * Respects prefers-reduced-motion (the track stays static).
 *
 * Why CSS animation rather than Framer Motion: a 30s linear infinite
 * tween via JS-driven motion forces React to re-render thousands of
 * times. CSS does this on the compositor thread for zero JS overhead.
 *
 * Why an inner track rather than a single repeated list: with one copy
 * the animation would visibly snap when it resets; with two copies the
 * second appears seamlessly behind the first as the first scrolls off.
 *
 * Props:
 *   children     — any inline-renderable items (logos, text, icons)
 *   speed        — seconds per full loop (default 28; smaller = faster)
 *   direction    — "left" (default) or "right"
 *   pauseOnHover — true (default)
 *   fade         — true (default) — adds gradient masks at both edges
 *                  so items appear/disappear softly rather than clipping
 *   gap          — Tailwind gap utility for spacing items (default "gap-12")
 *   className    — applied to the outer <div> (set bg, padding, etc.)
 *   ariaLabel    — accessibility label for the marquee region
 *
 * Example:
 *   <Marquee speed={32} ariaLabel="Trusted by">
 *     {logos.map((l) => <img key={l.alt} src={l.src} alt={l.alt} className="h-8" />)}
 *   </Marquee>
 */
export default function Marquee({
  children,
  speed = 28,
  direction = "left",
  pauseOnHover = true,
  fade = true,
  gap = "gap-12",
  className = "",
  ariaLabel,
}) {
  const reduced = useReducedMotion()
  const items   = Children.toArray(children)

  // We render two identical tracks side-by-side and translate the parent
  // by -50% so when the first copy moves entirely off-screen the second
  // is in the original position — yielding a seamless loop. Keying the
  // child copies with a `-copy` suffix avoids React key collisions.
  const trackChildren = useMemo(
    () => [
      ...items.map((child, i) => (
        <span key={`a-${i}`} className="shrink-0 inline-flex items-center">{child}</span>
      )),
      ...items.map((child, i) => (
        <span key={`b-${i}`} aria-hidden="true" className="shrink-0 inline-flex items-center">{child}</span>
      )),
    ],
    [items],
  )

  // Inline keyframes so callers don't need to add a global stylesheet
  // entry. Two animations (one per direction); the active one is bound
  // via `animation` shorthand below.
  const styleTag = `
    @keyframes marquee-left  { from { transform: translateX(0);   } to { transform: translateX(-50%); } }
    @keyframes marquee-right { from { transform: translateX(-50%); } to { transform: translateX(0);    } }
  `

  const trackStyle = reduced
    ? undefined
    : {
        animation: `marquee-${direction} ${speed}s linear infinite`,
        willChange: "transform",
      }

  return (
    <div
      role="region"
      aria-label={ariaLabel || "Marquee"}
      className={`group relative overflow-hidden ${className}`}
    >
      <style>{styleTag}</style>

      {/* Edge fade masks — soft gradient overlays that taper the marquee
          on both sides so items don't appear/disappear with a hard clip.
          Pointer-events disabled so they don't intercept hover-pause. */}
      {fade && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-mist via-mist/80 to-transparent sm:w-20"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-mist via-mist/80 to-transparent sm:w-20"
          />
        </>
      )}

      {/* Track — width is 2x the visible viewport because we render two
          copies. The keyframes translate by -50% which is exactly one
          copy's width, so the loop is seamless. */}
      <div
        className={`flex w-max items-center ${gap} ${pauseOnHover ? "group-hover:[animation-play-state:paused]" : ""}`}
        style={trackStyle}
      >
        {trackChildren}
      </div>
    </div>
  )
}
