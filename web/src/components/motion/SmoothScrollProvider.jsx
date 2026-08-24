/* eslint-disable react-refresh/only-export-components -- exports the Lenis context hooks used by scroll narratives */
import { createContext, useContext, useEffect, useMemo, useRef } from "react"
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
 * Step 33 · GSAP ScrollTrigger sync
 *   The Lenis instance is exposed through `LenisContext` (see `useLenis`).
 *   Consumers that lazily load GSAP (components/motion/scroll/useScrollNarrative)
 *   call `subscribe(fn)` — `fn(lenis | null)` fires immediately with the current
 *   instance and again whenever it is (re)created or destroyed — then wire
 *   `lenis.on("scroll", ScrollTrigger.update)`. `claimTicker()` hands the RAF
 *   loop to an external driver (gsap.ticker) so Lenis and ScrollTrigger tick in
 *   the same frame; the provider's own loop resumes when the claim is released.
 *   The provider itself never imports gsap, so the gsap chunk stays lazy.
 *
 * Usage (main.jsx, wrap App):
 *   <SmoothScrollProvider>
 *     <App />
 *   </SmoothScrollProvider>
 */
export const LenisContext = createContext(null)

/** Access the Lenis bridge: `{ get lenis, subscribe, claimTicker }` (null outside the provider). */
export function useLenis() {
  return useContext(LenisContext)
}

export default function SmoothScrollProvider({ children, enabled }) {
  const lenisRef     = useRef(null)
  const listenersRef = useRef(new Set())
  const claimsRef    = useRef(0)
  const rafRef       = useRef({ id: 0, running: false })

  const api = useMemo(() => {
    const startLoop = () => {
      const state = rafRef.current
      if (state.running || claimsRef.current > 0 || !lenisRef.current) return
      state.running = true
      const raf = (time) => {
        if (!state.running) return
        lenisRef.current?.raf(time)
        state.id = requestAnimationFrame(raf)
      }
      state.id = requestAnimationFrame(raf)
    }
    const stopLoop = () => {
      const state = rafRef.current
      state.running = false
      cancelAnimationFrame(state.id)
    }
    return {
      get lenis() { return lenisRef.current },
      /** fn(lenis|null) now + on every change. Returns unsubscribe. */
      subscribe(fn) {
        listenersRef.current.add(fn)
        fn(lenisRef.current)
        return () => { listenersRef.current.delete(fn) }
      },
      /** Pause the internal RAF loop while an external ticker drives `lenis.raf`. Returns release(). */
      claimTicker() {
        claimsRef.current += 1
        stopLoop()
        let released = false
        return () => {
          if (released) return
          released = true
          claimsRef.current = Math.max(0, claimsRef.current - 1)
          startLoop()
        }
      },
      _startLoop: startLoop,
      _stopLoop: stopLoop,
    }
  }, [])

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
    api._startLoop()
    listenersRef.current.forEach((fn) => fn(lenis))

    return () => {
      api._stopLoop()
      lenisRef.current = null
      listenersRef.current.forEach((fn) => fn(null))
      lenis.destroy()
      if (typeof window !== "undefined" && window.__lenis === lenis) {
        delete window.__lenis
      }
    }
  }, [enabled, api])

  return <LenisContext.Provider value={api}>{children}</LenisContext.Provider>
}
