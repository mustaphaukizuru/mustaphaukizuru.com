import { useEffect } from "react"
import Lenis from "lenis"

/**
 * SmoothScrollProvider · momentum-eased page scrolling
 *
 * Mounts a Lenis instance against `document.documentElement` and drives
 * its RAF loop. Optional feature flag (`enabled`) so the smooth scroll
 * can be toggled per-environment without code change — the flag reads
 * `VITE_SMOOTH_SCROLL` at build time, with `enabled` as runtime override.
 *
 * Accessibility:
 *   - When `prefers-reduced-motion: reduce` is requested the provider
 *     is a no-op (native scrolling preserved).
 *   - Native scrolling APIs (scrollIntoView, anchor #hash) still work
 *     because Lenis only intercepts wheel/touch.
 *
 * Why this lives at the React layer instead of a top-level script:
 *   - cleans up cleanly on HMR / route changes
 *   - ties Lenis lifetime to the React tree (no zombie RAF after unmount)
 *   - lets us listen to scroll events later via Lenis's API if needed
 *
 * Usage (main.jsx, wrap App):
 *   <SmoothScrollProvider>
 *     <App />
 *   </SmoothScrollProvider>
 */
export default function SmoothScrollProvider({ children, enabled }) {
  useEffect(() => {
    // Resolve final enabled state. Order of precedence:
    //   1. explicit `enabled` prop (runtime override)
    //   2. VITE_SMOOTH_SCROLL env var ("true" / "false")
    //   3. default on
    const envFlag = String(import.meta.env.VITE_SMOOTH_SCROLL ?? "true").toLowerCase()
    const flagOn  = typeof enabled === "boolean" ? enabled : envFlag !== "false"
    if (!flagOn) return

    // Respect prefers-reduced-motion — never enable momentum scroll for
    // users who've explicitly asked for less motion. Browsers vary in
    // how aggressively they apply this, so we check the media query
    // directly rather than trust a single React hook.
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return
    }

    const lenis = new Lenis({
      lerp:             0.1,          // 0.05 = molasses, 0.15 = snappy
      smoothWheel:      true,
      smoothTouch:      false,        // touch on mobile/tablet stays native
      wheelMultiplier:  1,
      touchMultiplier:  1.2,
      easing:           (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    })

    let rafId = 0
    function raf(time) {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }
    rafId = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
    }
  }, [enabled])

  return children
}
