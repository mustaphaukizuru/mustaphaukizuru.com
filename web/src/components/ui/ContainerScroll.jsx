import { useEffect, useRef, useState } from "react"
import { m, useScroll, useTransform, useReducedMotion } from "framer-motion"

/**
 * ContainerScroll · scroll-driven 3D "device frame" reveal
 *
 * Port of the Aceternity container-scroll-animation to this codebase's
 * conventions: plain JSX (no TS), `m.*` instead of `motion.*` (the app runs a
 * single LazyMotion `strict` boundary — see components/motion/MotionProvider),
 * and brand tokens instead of the original hex literals.
 *
 * As the container scrolls through the viewport the card rotates from a 20°
 * backward tilt to flat while the header drifts up behind it, so the artwork
 * reads as a screen standing up to meet the reader.
 *
 * `prefers-reduced-motion` disables every transform — the frame renders flat.
 *
 * The scroll offset is explicit on purpose. The upstream component relies on
 * the default (["start start", "end end"]), which only behaves when the track
 * is taller than the viewport — on a short track the progress range is
 * inverted and the frame sticks at its 20° tilt. ["start end", "center
 * center"] instead runs the tilt from "the stage has just appeared at the
 * bottom of the screen" to "the stage is centred", which holds at any track
 * height and at any viewport height, and leaves the frame flat while the
 * reader actually looks at it.
 *
 * Props:
 *   titleComponent   — anything renderable, drawn above the frame
 *   children         — frame contents (an image, a video, a live embed)
 *   heightClassName  — track height; taller track = slower, longer tilt
 *   frameClassName   — extra classes on the tilting frame (height, max-width)
 *   offset           — useScroll offset, for a different pacing
 *   className        — extra classes on the outer track
 */
/* The bezel and the screen inside it. Exported because the project detail
 * page dresses its hero in the same frame *without* the tilt — above the fold
 * there is no scroll to drive, and that hero is the shared-element target of
 * the transition out of a stage. One definition, two behaviours. */
export const STAGE_FRAME_CLASS =
  "rounded-[30px] border-4 border-charcoal-light bg-charcoal-deep p-2 shadow-[var(--shadow-stage)] md:p-6"
export const STAGE_SCREEN_CLASS = "h-full w-full overflow-hidden rounded-2xl bg-mist"

export default function ContainerScroll({
  titleComponent,
  children,
  heightClassName = "min-h-[36rem] md:min-h-[52rem]",
  frameClassName = "max-w-5xl h-[24rem] md:h-[36rem]",
  offset = ["start end", "center center"],
  className = "",
}) {
  const containerRef = useRef(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: containerRef, offset })
  const [isMobile, setIsMobile] = useState(false)

  // matchMedia, not a resize listener reading innerWidth: a page can stack a
  // dozen of these, and this way each one listens for the single breakpoint
  // crossing instead of every resize frame.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)")
    const apply = (e) => setIsMobile(e.matches)
    apply(mq)
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  // Mobile grows into place (a narrow screen has no room to oversize first);
  // desktop starts slightly oversized and settles. Both land on 1: with the
  // offset below the animation genuinely completes, so an end scale under 1
  // would leave the frame permanently shrunk rather than mid-flight.
  const scaleRange = isMobile ? [0.85, 1] : [1.05, 1]
  const rotate = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [20, 0])
  const scale = useTransform(scrollYProgress, [0, 1], reduced ? [1, 1] : scaleRange)
  const translate = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [0, -100])

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center p-2 md:p-6 ${heightClassName} ${className}`}
    >
      <div className="relative w-full py-8 md:py-12" style={{ perspective: "1000px" }}>
        <m.div style={{ translateY: translate }} className="mx-auto max-w-5xl text-center">
          {titleComponent}
        </m.div>

        <m.div
          style={{
            rotateX: rotate,
            scale,
          }}
          className={`-mt-12 mx-auto w-full ${STAGE_FRAME_CLASS} ${frameClassName}`}
        >
          <div className={STAGE_SCREEN_CLASS}>
            {children}
          </div>
        </m.div>
      </div>
    </div>
  )
}
