/* ════════════════════════════════════════════════════════════════════════
   useBodyScrollLock · prevents page scroll while an overlay is open
   ────────────────────────────────────────────────────────────────────────
   Locks both <html> and <body> overflow when `active` is true. Restores
   on deactivation. Preserves scroll position across the lock/unlock cycle.

   Why both html AND body:
     · Body-only lock leaks scroll on:
        - Pages using Lenis smooth-scroll (drives the html element)
        - Pages with overflow:auto/scroll on a wrapper above body
        - iOS Safari's rubber-band bounce on body-only `overflow: hidden`
     · Locking <html> too closes every known leak path.

   Usage:
     useBodyScrollLock(isMenuOpen)

   Behavior:
     · Captures `window.scrollY` at activation
     · Sets `html.style.overflow = 'hidden'` and same on body
     · On deactivation: restores both overflow values to whatever they
       were, then `window.scrollTo(saved scrollY)` as belt-and-suspenders
       (some browsers reset scroll on overflow change)

   Compatible with multiple simultaneous locks — uses a ref-counter so
   nested overlays (modal inside drawer) don't prematurely unlock the
   page when one closes. Implementation: a module-level Set tracks
   active lockers; lock only fires when the Set transitions empty→non-
   empty; unlock only fires when non-empty→empty.
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef } from "react"

// Module-level state — survives mount/unmount cycles. The Set holds an
// identifier for each active locker (we use the lock's own ref object).
const activeLocks = new Set()
let savedScrollY = 0
let savedHtmlOverflow = ""
let savedBodyOverflow = ""

function engageLock() {
  savedScrollY = window.scrollY
  savedHtmlOverflow = document.documentElement.style.overflow
  savedBodyOverflow = document.body.style.overflow

  // Pause Lenis (smooth-scroll) BEFORE locking overflow. Otherwise Lenis's
  // RAF loop keeps interpolating toward a stale scroll target while the
  // page is locked, and on overlay close you can see a brief snap as
  // Lenis catches up. Worse: while locked, Lenis sometimes reads
  // scrollTop as 0 (since `overflow: hidden` on html makes scrollTop
  // immutable) and aggressively lerps the page back to 0 — the user
  // perceives this as "tapping the menu scrolled me to the top".
  if (typeof window !== "undefined" && window.__lenis && typeof window.__lenis.stop === "function") {
    try { window.__lenis.stop() } catch { /* defensive */ }
  }

  document.documentElement.style.overflow = "hidden"
  document.body.style.overflow = "hidden"
}

function releaseLock() {
  document.documentElement.style.overflow = savedHtmlOverflow
  document.body.style.overflow = savedBodyOverflow
  // Restore scroll — some browsers reset to 0 when overflow changes.
  window.scrollTo({ top: savedScrollY, behavior: "instant" })

  // Resume Lenis AFTER scroll is restored so its internal target picks
  // up the corrected position, not the transient `0` it would see if we
  // resumed before scrollTo. .start() is the inverse of .stop() and a
  // no-op if Lenis is already running.
  if (typeof window !== "undefined" && window.__lenis && typeof window.__lenis.start === "function") {
    try { window.__lenis.start() } catch { /* defensive */ }
  }
}

export default function useBodyScrollLock(active) {
  // Each hook instance gets a stable identity token (ref object) used
  // as the Set key. Ensures component re-renders don't double-add.
  const tokenRef = useRef({})

  useEffect(() => {
    if (!active) return undefined
    const token = tokenRef.current
    const wasEmpty = activeLocks.size === 0
    activeLocks.add(token)
    if (wasEmpty) engageLock()
    return () => {
      activeLocks.delete(token)
      if (activeLocks.size === 0) releaseLock()
    }
  }, [active])
}
