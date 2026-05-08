import { useEffect } from "react"
import { useLocation } from "react-router-dom"

/**
 * ScrollToTopOnNavigate · F11 · Batch 2
 *
 * Resets window scroll to (0, 0) on every route change. This is a behavior
 * concern (UX) — separate from the back-to-top button that lives in
 * ScrollToTop.jsx.
 *
 * Renders nothing. Mount once at the root of the routes tree.
 *
 * Note: Previously the entire `ScrollToTop.jsx` file was just this effect.
 * It was renamed to free up `ScrollToTop` for the F11 floating button while
 * preserving identical navigation-scroll behavior.
 */
export default function ScrollToTopOnNavigate() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" })
  }, [pathname])

  return null
}
