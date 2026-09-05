import { useEffect, useMemo, useRef } from "react"
// PERF · Lenis is loaded on demand, not with the app shell.
//
// Momentum scrolling is a progressive enhancement that this effect already
// declines to start when VITE_SMOOTH_SCROLL is off or the visitor prefers
// reduced motion — but a STATIC import ships the library to those users
// anyway. It was 31 kB sitting in the global vendor chunk, on the critical
// path of every page, for a feature that only begins after first paint.
// Importing it inside the effect keeps it out of the shell entirely and
// means reduced-motion users never download it at all.

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
 * T4-3 · the GSAP bridge is gone. `LenisContext`, `useLenis`, `subscribe()`
 *   and `claimTicker()` existed so useScrollNarrative could hand this RAF loop
 *   to `gsap.ticker` and keep Lenis and ScrollTrigger ticking in one frame.
 *   With the narratives on Framer there is nothing to hand it to: Framer's
 *   useScroll reads window.scrollY, and Lenis scrolls the real document, so
 *   the two need no introduction. The provider owns its own loop again.
 *
 *   Lenis itself stays. Framer has no momentum scrolling, so removing it
 *   would be a product change rather than a refactor.
 *
 * Usage (main.jsx, wrap App):
 *   <SmoothScrollProvider>
 *     <App />
 *   </SmoothScrollProvider>
 */
export default function SmoothScrollProvider({ children, enabled }) {
  const lenisRef = useRef(null)
  const rafRef   = useRef({ id: 0, running: false })

  const api = useMemo(() => ({
    startLoop() {
      const state = rafRef.current
      if (state.running || !lenisRef.current) return
      state.running = true
      const raf = (time) => {
        if (!state.running) return
        lenisRef.current?.raf(time)
        state.id = requestAnimationFrame(raf)
      }
      state.id = requestAnimationFrame(raf)
    },
    stopLoop() {
      const state = rafRef.current
      state.running = false
      cancelAnimationFrame(state.id)
    },
  }), [])

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

    // The import is async, so the effect may be torn down before the module
    // resolves (fast route change, StrictMode double-mount). `cancelled`
    // guards that: a late-arriving module must not start a loop nobody owns.
    let cancelled = false
    let lenis = null

    import("lenis")
      .then(({ default: Lenis }) => {
        if (cancelled) return
        lenis = new Lenis({
          lerp:             0.1,          // 0.05 = molasses, 0.15 = snappy
          smoothWheel:      true,
          smoothTouch:      false,        // touch on mobile/tablet stays native
          wheelMultiplier:  1,
          touchMultiplier:  1.2,
          easing:           (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        })

        // Expose the Lenis instance globally so other code can pause it
        // when needed — specifically, useBodyScrollLock pauses smooth scroll
        // while an overlay is open. Without this, Lenis keeps interpolating
        // scroll targets in the background, occasionally yanking the page
        // back to scrollY=0 when the overlay locks `html.overflow: hidden`
        // — visible to the user as "the page jumped to top when I tapped
        // the menu". `window.__lenis` is the de-facto convention used by
        // the Lenis community; we keep it for parity.
        if (typeof window !== "undefined") {
          window.__lenis = lenis
        }

        lenisRef.current = lenis
        api.startLoop()
      })
      .catch(() => {
        // Chunk failed to load (offline, deploy mid-session). Native
        // scrolling is the fallback and everything else keeps working.
      })

    return () => {
      cancelled = true
      if (!lenis) return
      api.stopLoop()
      lenisRef.current = null
      lenis.destroy()
      if (typeof window !== "undefined" && window.__lenis === lenis) {
        delete window.__lenis
      }
    }
  }, [enabled, api])

  // No context any more: nothing outside this file needs the instance.
  // useBodyScrollLock reaches it through window.__lenis, which is the
  // convention Lenis's own community uses and which survives this change.
  return children
}
