import { useEffect, useRef, useState } from "react"
import { m, useReducedMotion, useScroll, useTransform } from "framer-motion"
import { MOBILE_QUERY } from "./scroll"

/**
 * ScrollDeviceShowcase · a laptop-style frame that straightens as you scroll
 * ─────────────────────────────────────────────────────────────────────────
 * The screen starts tilted back in 3D and rotates flat while the section
 * travels from the bottom of the viewport to the middle of it, so a product
 * screenshot reads as a real device being lifted towards the reader.
 *
 *   · framer-motion only (useScroll/useTransform live in the core bundle
 *     that MotionProvider already ships) — this adds no new dependency and
 *     no new chunk. GSAP is reserved for the pinned narratives under
 *     components/motion/scroll.
 *   · `m.*` not `motion.*` — MotionProvider runs LazyMotion in strict mode.
 *   · useReducedMotion → the frame renders flat and still; the header does
 *     not drift. No transform is ever applied.
 *   · Colours are tokens (charcoal bezel, mist screen) and the elevation is
 *     a --shadow-e* step, so lint:tokens and lint:shadows stay green.
 *
 * Props
 *   header   — node rendered above the device (heading, copy, CTA)
 *   children — the screen contents; sized to fill the frame
 *   chrome   — optional string shown in the fake browser address bar; pass
 *              null to drop the chrome bar entirely. It is decorative: the
 *              screen is described by its own image alt, so the frame adds
 *              no second announcement.
 */
export default function ScrollDeviceShowcase({ header, children, chrome = null }) {
  const containerRef = useRef(null)
  const reduced = useReducedMotion()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY)
    const apply = () => setIsMobile(mql.matches)
    apply()
    mql.addEventListener("change", apply)
    return () => mql.removeEventListener("change", apply)
  }, [])

  // 0 when the section's top reaches the bottom of the viewport,
  // 1 when the section is centred — the tilt resolves as you read it.
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "center center"],
  })

  const rotate = useTransform(scrollYProgress, [0, 1], [18, 0])
  const scale = useTransform(scrollYProgress, [0, 1], isMobile ? [0.88, 1] : [0.95, 1])
  const lift = useTransform(scrollYProgress, [0, 1], [40, 0])

  const motionStyle = reduced ? undefined : { rotateX: rotate, scale }
  const headerStyle = reduced ? undefined : { y: lift }

  return (
    <div ref={containerRef} className="relative">
      <m.div style={headerStyle} className="mx-auto max-w-3xl">
        {header}
      </m.div>

      <div className="mt-10 [perspective:1200px] sm:mt-12">
        <m.figure
          style={motionStyle}
          className="mx-auto w-full max-w-5xl rounded-xl border border-charcoal/10 bg-charcoal p-2 shadow-[var(--shadow-e7)] sm:p-3"
        >
          {chrome && (
            <div aria-hidden="true" className="flex items-center gap-2 px-2 pb-2 pt-1">
              <span className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              </span>
              <span className="mx-auto truncate rounded-full bg-white/10 px-3 py-0.5 text-micro text-white/70">
                {chrome}
              </span>
            </div>
          )}
          <div className="overflow-hidden rounded-lg bg-mist">{children}</div>
        </m.figure>
      </div>
    </div>
  )
}
