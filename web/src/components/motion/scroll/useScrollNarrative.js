import { useEffect, useRef } from "react"
import { useLenis } from "../SmoothScrollProvider"

/**
 * useScrollNarrative · lazily-loaded GSAP + ScrollTrigger, scoped to a ref
 *
 *   const scope = useScrollNarrative(({ gsap, ScrollTrigger, mm }) => {
 *     gsap.from(".step", { opacity: 0, scrollTrigger: { trigger: ".step" } })
 *   }, [deps])
 *   <section ref={scope}>…</section>
 *
 * Contract:
 *   · `gsap` and `gsap/ScrollTrigger` are `import()`ed inside the effect, so
 *     the "gsap" chunk is only fetched by routes whose components call this
 *     hook (Home process section, project case studies) — never by admin /
 *     dashboard bundles.
 *   · prefers-reduced-motion: reduce → the setup function is never run and
 *     gsap is never imported. Components must therefore author their DOM in
 *     its FINAL state and animate `from` it, so reduced-motion / no-JS / SSR
 *     all render the finished layout with zero layout shift.
 *   · Everything created in `setup` lives inside `gsap.context(…, scope)`;
 *     on unmount, on dep change, and on route change the context is reverted
 *     (`ctx.revert()` kills every tween + ScrollTrigger it owns and restores
 *     inline styles). A defensive pass also kills any ScrollTrigger whose
 *     trigger/pin element sits inside the scope.
 *   · Lenis sync — `lenis.on("scroll", ScrollTrigger.update)` and the RAF
 *     loop is handed to `gsap.ticker` (`lenis.raf(time * 1000)`) with
 *     `lagSmoothing(0)` while at least one narrative is mounted.
 *   · `mm` is a `gsap.matchMedia()` bound to the scope — use it for the
 *     desktop (≥1024px) / mobile split; it reverts automatically on resize.
 */
export const DESKTOP_QUERY = "(min-width: 1024px)"
export const MOBILE_QUERY  = "(max-width: 1023px)"
export const REDUCED_QUERY = "(prefers-reduced-motion: reduce)"

export function prefersReducedMotion() {
  return typeof window !== "undefined" && !!window.matchMedia?.(REDUCED_QUERY).matches
}

/* ── shared Lenis ⇄ ScrollTrigger bridge (ref-counted singleton) ─────────── */
let bridgeRefs = 0
let bridgeTeardown = null

function attachBridge({ gsap, ScrollTrigger }, lenisApi) {
  bridgeRefs += 1
  if (bridgeTeardown || !lenisApi) return

  let current = null
  let releaseTicker = null
  const onScroll = () => ScrollTrigger.update()
  const tick = (time) => { current?.raf(time * 1000) }

  const detach = () => {
    if (!current) return
    current.off("scroll", onScroll)
    gsap.ticker.remove(tick)
    releaseTicker?.()
    releaseTicker = null
    current = null
  }
  const unsubscribe = lenisApi.subscribe((lenis) => {
    detach()
    if (!lenis) return
    current = lenis
    lenis.on("scroll", onScroll)
    releaseTicker = lenisApi.claimTicker()
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
  })

  bridgeTeardown = () => {
    unsubscribe()
    detach()
    gsap.ticker.lagSmoothing(500, 33) // restore gsap defaults
    bridgeTeardown = null
  }
}

function releaseBridge() {
  bridgeRefs = Math.max(0, bridgeRefs - 1)
  if (bridgeRefs === 0) bridgeTeardown?.()
}

let libPromise = null
function loadGsap() {
  if (!libPromise) {
    libPromise = Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([g, st]) => {
      const gsap = g.gsap || g.default
      const ScrollTrigger = st.ScrollTrigger || st.default
      gsap.registerPlugin(ScrollTrigger)
      return { gsap, ScrollTrigger }
    })
  }
  return libPromise
}

export default function useScrollNarrative(setup, deps = [], { enabled = true } = {}) {
  const scope = useRef(null)
  const setupRef = useRef(setup)
  setupRef.current = setup
  const lenisApi = useLenis()

  useEffect(() => {
    if (!enabled || !scope.current || prefersReducedMotion()) return

    let cancelled = false
    let ctx = null
    let mm = null
    let libs = null
    let bridged = false
    const root = scope.current

    loadGsap().then((loaded) => {
      if (cancelled || !root.isConnected) return
      libs = loaded
      const { gsap, ScrollTrigger } = libs
      attachBridge(libs, lenisApi)
      bridged = true
      ctx = gsap.context(() => {
        mm = gsap.matchMedia(root)
        setupRef.current?.({ gsap, ScrollTrigger, mm, scope: root })
      }, root)
      ScrollTrigger.refresh()
    })

    return () => {
      cancelled = true
      mm?.revert()
      ctx?.revert()
      if (libs) {
        // Belt and braces: kill any trigger that targets something inside our scope.
        libs.ScrollTrigger.getAll().forEach((t) => {
          const el = t.trigger || t.pin
          if (el instanceof Element && root.contains(el)) t.kill()
        })
      }
      if (bridged) releaseBridge()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, lenisApi, ...deps])

  return scope
}
