/**
 * AnimatedGradientText · sweeping gradient highlight — 21st.dev pattern
 * ─────────────────────────────────────────────────────────────────────────
 * Wraps children in a <span> with an animated background-position sweep,
 * producing the signature "shimmering gradient text" seen on premium landing
 * pages. Uses CSS `background-clip: text` + a wider-than-100% gradient that
 * translates from right to left on a slow loop.
 *
 * Graceful degradation:
 *   · If background-clip:text is unsupported, the text renders in the
 *     `fallbackColor` (defaults to brand violet).
 *   · prefers-reduced-motion: animation freezes (still beautiful, just static).
 *
 * Props:
 *   children        — React node (text content)
 *   className       — extra classes on the outer span (font, size, weight)
 *   from            — start gradient hex (default brand violet)
 *   via             — mid gradient hex (default brand azure)
 *   to              — end gradient hex (default brand cyan)
 *   duration        — animation loop in seconds (default 4)
 *   fallbackColor   — CSS color for non-clip browsers (default brand violet)
 *
 * Usage:
 *   <AnimatedGradientText className="text-[48px] font-extrabold">
 *     Complexity, simplified.
 *   </AnimatedGradientText>
 */
export default function AnimatedGradientText({
  children,
  className = "",
  from = "#5D3FD3",
  via = "#0284C7",
  to = "#7DD3FC",
  duration = 4,
  fallbackColor = "#5D3FD3",
}) {
  const styleId = "ukz-agt-keyframe"

  /* Inject keyframe once per page — same pattern as Marquee.jsx */
  if (typeof document !== "undefined" && !document.getElementById(styleId)) {
    const el = document.createElement("style")
    el.id = styleId
    el.textContent = `
      @keyframes ukz-gradient-sweep {
        0%   { background-position: 200% center; }
        100% { background-position: -200% center; }
      }
      @media (prefers-reduced-motion: reduce) {
        .ukz-agt { animation: none !important; }
      }
    `
    document.head.appendChild(el)
  }

  return (
    <span
      className={`ukz-agt inline-block ${className}`}
      style={{
        background: `linear-gradient(90deg, ${fallbackColor}, ${from} 20%, ${via} 50%, ${to} 70%, ${from} 85%, ${fallbackColor})`,
        backgroundSize: "400% auto",
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        color: fallbackColor,              /* non-clip fallback */
        animation: `ukz-gradient-sweep ${duration}s linear infinite`,
      }}
    >
      {children}
    </span>
  )
}
