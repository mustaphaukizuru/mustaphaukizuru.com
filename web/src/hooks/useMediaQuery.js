import { useEffect, useState } from "react"

/**
 * useMediaQuery · does this media query match right now?
 *
 * Written for T4-3, which replaced gsap.matchMedia() with Framer. gsap's
 * matchMedia did two things at once — it evaluated the query AND reverted
 * every animation it owned when the query stopped matching. Framer needs
 * only the first half, because a scroll-linked transform that stops being
 * rendered simply stops existing.
 *
 * Starts false on the server and on the first client render, then corrects
 * after mount. That order is deliberate: a component built for this hook
 * must author its DOM in the state a NON-matching viewport gets, so the
 * first frame is always the safe one and nothing flashes into place.
 *
 * @param {string} query
 * @returns {boolean}
 */
export default function useMediaQuery(query) {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined
    const list = window.matchMedia(query)
    // In a callback, not the effect body: setting state synchronously there
    // cascades a render before the browser has done anything.
    const sync = () => setMatches(list.matches)
    sync()
    list.addEventListener("change", sync)
    return () => list.removeEventListener("change", sync)
  }, [query])

  return matches
}
