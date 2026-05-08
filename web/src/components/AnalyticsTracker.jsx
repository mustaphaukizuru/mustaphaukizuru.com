import { useEffect, useRef } from "react"
import { useLocation } from "react-router-dom"
import { trackPageView as internalTrackPageView } from "../services/analyticsService"
import { trackPageView as ga4TrackPageView } from "../lib/analytics"

/**
 * AnalyticsTracker · M14 + SEO04
 *
 * Mounted once at the top of <App />. Fires both:
 *   1. The internal pageview ping (analyticsService → /api/analytics/pageview)
 *      — privacy-first server-side counter for our own dashboards.
 *   2. GA4 page_view via gtag (lib/analytics.trackPageView)
 *      — only fires when VITE_GA_MEASUREMENT_ID is set.
 *
 * Skips:
 *   - Admin routes (/admin/*)         — operators shouldn't pollute the funnel
 *   - The same path twice in a row    — strict-mode double-mount + back/forward
 */
export default function AnalyticsTracker() {
  const location = useLocation()
  const lastPath = useRef(null)

  useEffect(() => {
    const path = location.pathname || "/"
    if (path === lastPath.current) return
    if (path.startsWith("/admin")) {
      lastPath.current = path
      return
    }

    lastPath.current = path

    internalTrackPageView({
      path,
      referrer: typeof document !== "undefined" ? document.referrer || null : null,
    })

    // GA4 — gracefully no-ops if VITE_GA_MEASUREMENT_ID is unset.
    ga4TrackPageView(path + (location.search || ""))
  }, [location.pathname, location.search])

  return null
}
