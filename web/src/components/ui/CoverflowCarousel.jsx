import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

/**
 * CoverflowCarousel · 3-D cover-flow rail
 *
 * A single fractional index (`posRef`) is the source of truth; every card's
 * transform is derived from its distance to that index and painted straight
 * to the DOM. React only ever hears about the *selected* card, so a drag
 * doesn't re-render the rail sixty times a second.
 *
 * Looping needs no cloned nodes: the offset is folded into the shorter way
 * round the ring and a card is teleported across at exactly half a turn out,
 * by which point it has already faded to zero.
 *
 * Ported from the shadcn/TS reference into this codebase's conventions —
 * plain JSX, no `cn()` helper, brand tokens instead of shadcn colour names.
 * Additions over the reference:
 *   • `aspect` — certificates are landscape (√2), not square.
 *   • `onActivate` — a tap on the centre card opens it; a tap on a
 *     neighbour brings it to the centre. Drags are not taps (5 px slop).
 *   • prefers-reduced-motion → cards jump instead of easing.
 *
 * Props
 *   slides       [{ id, src, alt, title, subtitle, badge, meta:[{label,value}] }]
 *   rotate       degrees the first neighbour tilts
 *   depth        how far the first neighbour recedes, as a fraction of card width
 *   perspective  viewer distance as a multiple of card width — smaller is a wider lens
 *   falloff      exponent on distance; below 1 the rake eases off as cards travel out
 *   fade         opacity lost per step from the centre
 *   cardWidth    any CSS length — everything else derives from it
 *   aspect       card width ÷ height
 *   gap          space between cards, as a fraction of card width
 *   onActivate   (slide, index) => void — fired when the centre card is tapped
 *   renderSlide  optional (slide, { active }) => node, replaces the default <img>
 */
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect

export function CoverflowCarousel({
  slides,
  rotate = 44,
  depth = 0.6,
  perspective = 3,
  falloff = 0.56,
  fade = 0.1,
  cardWidth = "clamp(240px, 40vw, 460px)",
  aspect = 1.414,
  gap = 0.05,
  loop = true,
  showCaption = true,
  showPagination = true,
  showNavigation = true,
  label = "Cover carousel",
  className = "",
  cardClassName = "",
  onActivate,
  renderSlide,
}) {
  const count = slides.length

  const frameRef = useRef(null)
  const cardRefs = useRef([])
  /** Fractional card index at the centre. The single source of truth. */
  const posRef = useRef(0)
  /** Where the current settle is headed. Stepping off `pos` instead would
      swallow a keypress that lands mid-flight, before the round-off moves. */
  const targetRef = useRef(0)
  const widthRef = useRef(0)
  const rafRef = useRef(null)
  const dragRef = useRef(null)

  const [selected, setSelected] = useState(0)

  /** Nearest whole card, folded back into 0..count-1. */
  const indexAt = useCallback(
    (pos) => ((Math.round(pos) % count) + count) % count,
    [count],
  )

  // Paint straight to the DOM. Sixty state updates a second would re-render
  // every card for numbers React never needs to see.
  const paint = useCallback(() => {
    const width = widthRef.current
    if (!width) return
    const pitch = width * (1 + gap)
    const pos = posRef.current

    cardRefs.current.forEach((card, index) => {
      if (!card) return

      // Fold the distance into the shorter way round the ring. This is the
      // whole looping mechanism — no cloned nodes, no shuffling the DOM.
      let offset = index - pos
      if (loop) {
        offset = ((offset % count) + count) % count
        if (offset > count / 2) offset -= count
      }

      const distance = Math.abs(offset)
      // Both the tilt and the recession ease off as cards travel out —
      // doubling the distance adds only about half again as much of each.
      // A linear ramp folds the second card shut; this keeps it readable.
      const ramp = Math.pow(distance, falloff)
      // Capped short of edge-on so a far card never turns its back.
      const tilt = Math.min(rotate * ramp, 82) * Math.sign(offset)

      card.style.transform =
        `translateX(calc(-50% + ${offset * pitch}px)) ` +
        `translateZ(${-depth * width * ramp}px) rotateY(${-tilt}deg)`

      // A card is teleported across the ring at exactly half a turn out, so it
      // has to be gone by then or the jump is visible.
      const edge = loop ? Math.min(1, Math.max(0, count / 2 - distance)) : 1
      card.style.opacity = String(Math.max(0, 1 - fade * distance) * edge)
      card.style.zIndex = String(100 - Math.round(distance))
      // Only the centre card is reachable by tab / screen-reader cursor;
      // the rest are decorative until they are brought forward.
      card.style.pointerEvents = distance < 0.5 ? "auto" : "none"
    })
  }, [count, depth, fade, falloff, gap, loop, rotate])

  const settle = useCallback(
    (target) => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      targetRef.current = target
      setSelected(indexAt(target))

      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      if (reduced) {
        posRef.current = target
        paint()
        rafRef.current = null
        return
      }

      const step = () => {
        const remaining = target - posRef.current
        if (Math.abs(remaining) < 0.0004) {
          posRef.current = target
          paint()
          rafRef.current = null
          return
        }
        // Exponential ease-out, not a spring. Swap in a spring only if the
        // settle needs overshoot.
        posRef.current += remaining * 0.16
        paint()
        rafRef.current = requestAnimationFrame(step)
      }
      rafRef.current = requestAnimationFrame(step)
    },
    [indexAt, paint],
  )

  const clamp = useCallback(
    (pos) => (loop ? pos : Math.max(0, Math.min(count - 1, pos))),
    [count, loop],
  )

  const goTo = useCallback(
    (index) => {
      // Take the shorter way round rather than unwinding the whole ring.
      const target = loop
        ? index + Math.round((targetRef.current - index) / count) * count
        : index
      settle(clamp(target))
    },
    [clamp, count, loop, settle],
  )

  const nudge = useCallback(
    (by) => settle(clamp(Math.round(targetRef.current) + by)),
    [clamp, settle],
  )

  const onPointerDown = (event) => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    targetRef.current = posRef.current
    dragRef.current = {
      id: event.pointerId,
      x: event.clientX,
      pos: posRef.current,
      v: 0,
      t: performance.now(),
      moved: 0,
    }
  }

  const onPointerMove = (event) => {
    const drag = dragRef.current
    if (!drag || drag.id !== event.pointerId) return

    const pitch = widthRef.current * (1 + gap)
    if (!pitch) return

    drag.moved = Math.max(drag.moved, Math.abs(event.clientX - drag.x))

    const now = performance.now()
    const previous = posRef.current
    posRef.current = clamp(drag.pos - (event.clientX - drag.x) / pitch)
    // Cards per second, for the throw.
    drag.v = ((posRef.current - previous) / Math.max(now - drag.t, 1)) * 1000
    drag.t = now

    const index = indexAt(posRef.current)
    if (index !== selected) setSelected(index)
    paint()
  }

  const endDrag = (event) => {
    const drag = dragRef.current
    if (!drag || drag.id !== event.pointerId) return
    dragRef.current = null
    // Under the slop threshold this was a tap, not a throw — leave the rail
    // exactly where it is so the card's own click handler can run.
    if (drag.moved < 5) {
      settle(clamp(Math.round(posRef.current)))
      return
    }
    // Let a flick carry, but never more than two cards.
    const carried = Math.max(-2, Math.min(2, drag.v * 0.18))
    settle(clamp(Math.round(posRef.current + carried)))
  }

  const activate = (index) => {
    if (index !== selected) {
      goTo(index)
      return
    }
    onActivate?.(slides[index], index)
  }

  // Card width drives pitch, depth and perspective, so it is the only thing
  // worth measuring — and only when the box actually changes.
  useIsoLayoutEffect(() => {
    const frame = frameRef.current
    if (!frame) return

    const measure = () => {
      const card = cardRefs.current[0]
      if (!card) return
      widthRef.current = card.offsetWidth
      paint()
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [paint])

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    },
    [],
  )

  const active = slides[selected]

  return (
    <div
      className={`w-full ${className}`}
      style={{ "--cf-card": cardWidth }}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
    >
      <div className="relative">
        <div
          ref={frameRef}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault()
              nudge(-1)
            } else if (event.key === "ArrowRight") {
              event.preventDefault()
              nudge(1)
            }
          }}
          // Vertical padding keeps the drop shadows clear of the overflow clip.
          className="cursor-grab overflow-hidden py-10 outline-none focus-visible:ring-[3px] focus-visible:ring-violet-light/60 active:cursor-grabbing"
          style={{
            perspective: `calc(var(--cf-card) * ${perspective})`,
            // Horizontal drag is ours; the page keeps vertical scrolling.
            touchAction: "pan-y",
          }}
        >
          <div
            className="relative select-none"
            style={{
              height: `calc(var(--cf-card) / ${aspect})`,
              transformStyle: "preserve-3d",
            }}
          >
            {slides.map((slide, index) => (
              <div
                key={slide.id ?? index}
                ref={(node) => { cardRefs.current[index] = node }}
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${count}`}
                aria-hidden={index !== selected}
                className={`absolute left-1/2 top-0 overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-e7)] ring-1 ring-white/10 will-change-transform ${cardClassName}`}
                style={{ width: "var(--cf-card)", aspectRatio: String(aspect) }}
              >
                <button
                  type="button"
                  tabIndex={index === selected ? 0 : -1}
                  onClick={() => activate(index)}
                  aria-label={slide.title || slide.alt}
                  className="group block h-full w-full cursor-pointer text-left outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-violet-light"
                >
                  {renderSlide ? (
                    renderSlide(slide, { active: index === selected })
                  ) : (
                    <img
                      src={slide.src}
                      alt={slide.alt || ""}
                      draggable={false}
                      loading="lazy"
                      className="h-full w-full select-none object-cover"
                    />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {showNavigation && (
          <>
            <button
              type="button"
              aria-label="Previous slide"
              onClick={() => nudge(-1)}
              className="absolute left-1 top-1/2 z-[200] -translate-y-1/2 rounded-full border border-white/20 bg-charcoal/70 p-2 text-white backdrop-blur transition hover:bg-charcoal focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet-light/60 sm:left-3"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={() => nudge(1)}
              className="absolute right-1 top-1/2 z-[200] -translate-y-1/2 rounded-full border border-white/20 bg-charcoal/70 p-2 text-white backdrop-blur transition hover:bg-charcoal focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-violet-light/60 sm:right-3"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {showCaption && active?.title && (
        <div key={selected} className="mt-2 flex flex-col items-center px-6 text-center" aria-live="polite">
          <p className="text-[15px] font-semibold tracking-tight text-white sm:text-[17px]">
            {active.title}
          </p>
          {active.subtitle && (
            <p className="mt-1 font-mono text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--color-violet-light)" }}>
              {active.subtitle}
            </p>
          )}
          {active.meta?.length > 0 && (
            <dl className="mt-5 w-full max-w-[260px] text-[12px]">
              {active.meta.map((row) => (
                <div key={row.label} className="flex justify-between py-[5px]">
                  <dt style={{ color: "rgba(255,255,255,0.6)" }}>{row.label}</dt>
                  <dd className="font-medium text-white">{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {showPagination && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {slides.map((slide, index) => (
            <button
              key={slide.id ?? index}
              type="button"
              aria-label={`Go to slide ${index + 1}`}
              aria-current={index === selected}
              onClick={() => goTo(index)}
              className={`h-2 w-2 rounded-full bg-white transition-opacity ${index === selected ? "opacity-100" : "opacity-30"}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default CoverflowCarousel
