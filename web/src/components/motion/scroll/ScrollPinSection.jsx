/**
 * ScrollPinSection · CSS-sticky "pin" with reserved scroll runway
 *
 * Reserves the scroll distance up-front with a fixed-height outer track
 * (`trackClassName`, e.g. "lg:h-[220vh]") and keeps the inner panel sticky
 * inside it. Because the height is declared in CSS rather than injected by
 * ScrollTrigger's pin-spacer after refresh, the layout below never jumps
 * (zero CLS) and reduced-motion / no-JS users simply scroll past a normal
 * section. On viewports without the `lg:` classes the track collapses to the
 * content height — a plain stacked section.
 *
 * Pair with useScrollNarrative: `trigger: scope, start: "top top",
 * end: "bottom bottom", scrub: …` gives a 0→1 progress across the runway.
 */
export default function ScrollPinSection({
  as: Tag = "section",
  trackRef,
  trackClassName = "lg:h-[220vh]",
  panelClassName = "lg:sticky lg:top-0 lg:flex lg:min-h-screen lg:items-center",
  className = "",
  children,
  ...rest
}) {
  return (
    <Tag ref={trackRef} className={`relative ${trackClassName} ${className}`} {...rest}>
      <div data-pin-panel className={`w-full ${panelClassName}`}>{children}</div>
    </Tag>
  )
}
