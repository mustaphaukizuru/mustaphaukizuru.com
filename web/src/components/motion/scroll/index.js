/**
 * The scroll-narrative module, after T4-3.
 *
 * useScrollNarrative used to live here: a lazily-imported gsap +
 * ScrollTrigger wrapper with a Lenis bridge, a matchMedia split and a
 * context-revert teardown. Its three consumers — Home's Process, and the case
 * study's ApproachSteps and OutcomeStats — now use Framer's useScroll,
 * useTransform, whileInView and useInView directly, so the 114 KB library and
 * everything written to manage it are gone.
 *
 * What remains is the part that was never gsap's: a CSS-sticky pin with the
 * scroll runway reserved in CSS.
 */
export { default as ScrollPinSection } from "./ScrollPinSection"

/**
 * The desktop/mobile split, as media-query strings.
 *
 * These outlived gsap's matchMedia — they are just the Tailwind `lg`
 * breakpoint said in a form matchMedia understands, and two components read
 * them (Home's Process and ScrollDeviceShowcase). Kept here rather than
 * duplicated so the two can never disagree about where the split is.
 */
export const DESKTOP_QUERY = "(min-width: 1024px)"
export const MOBILE_QUERY = "(max-width: 1023px)"
