import { hasAnalyticsConsent } from "./analytics"
import { trackEvent } from "../services/analyticsService"

/* ──────────────────────────────────────────────────────────────────────────
 *  vitals.js · what visitors actually experienced (T3-6)
 *
 *  Lighthouse is a lab estimate: one simulated machine, one simulated
 *  network, on a page nobody was using. It is useful for catching a
 *  regression and useless for answering "is the site fast for the people on
 *  it". These three numbers answer that.
 *
 *  LCP · when the main content finished painting
 *  CLS · how much the layout moved under the reader
 *  INP · how long the page took to respond to a tap
 *
 *  Sent to the analytics endpoint that already exists, as one event per
 *  metric per page, and rolled up to p75 per route per day by
 *  aggregateDailyMetrics.
 *
 *  ── PRIVACY ────────────────────────────────────────────────────────────
 *
 *  Gated on the analytics consent category, so a visitor who clicked
 *  "Reject all" sends nothing. (The internal pageview ping is NOT gated
 *  today — it is first-party and anonymised. Vitals could make the same
 *  argument; they are gated anyway because a measurement nobody asked for
 *  is not worth the argument.)
 *
 *  The ROUTE PATTERN is sent, never the URL. /store/red-hat becomes
 *  /store/:slug, and — the case that actually matters — /track/MU-7K4C-9XQF
 *  becomes /track/:code, because a tracking code in an analytics table is a
 *  client's project identifier sitting somewhere it was never meant to be.
 *  Same for a portal token, which is a live credential.
 *  ──────────────────────────────────────────────────────────────────── */

/**
 * Route families whose second segment is an identifier.
 *
 * Kept as an explicit list rather than "collapse anything that looks like a
 * slug": the failure mode of a heuristic here is a real identifier reaching
 * the analytics table, and the failure mode of a missing entry is one noisy
 * row nobody acts on.
 */
const DYNAMIC = [
  [/^\/store\/[^/]+$/, "/store/:slug"],
  [/^\/blog\/[^/]+$/, "/blog/:slug"],
  [/^\/projects\/[^/]+$/, "/projects/:slug"],
  [/^\/services\/[^/]+$/, "/services/:slug"],
  // A live tracking code. Never sent.
  [/^\/track\/[^/]+$/, "/track/:code"],
  // A live credential. Never sent.
  [/^\/portal\/[^/]+$/, "/portal/:token"],
  [/^\/checkout\/success\/[^/]+$/, "/checkout/success/:orderId"],
  [/^\/dashboard\/projects\/[^/]+$/, "/dashboard/projects/:id"],
  [/^\/dashboard\/orders\/[^/]+$/, "/dashboard/orders/:id"],
  [/^\/reset-password\/[^/]+$/, "/reset-password/:token"],
]

/**
 * A pathname reduced to the route it belongs to.
 *
 * The /es prefix is KEPT: a Spanish reader downloads a different locale
 * chunk, so /es/store and /store are genuinely two different performance
 * stories and averaging them together would hide either one getting worse.
 *
 * Anything not recognised and deeper than two segments is truncated rather
 * than sent whole — an unrecognised third segment is exactly where an
 * identifier hides.
 */
export function routePattern(pathname) {
  const path = String(pathname || "/").split("?")[0].replace(/\/+$/, "") || "/"
  const es = path === "/es" || path.startsWith("/es/")
  const bare = es ? path.slice(3) || "/" : path
  const prefix = es ? "/es" : ""

  for (const [re, pattern] of DYNAMIC) {
    if (re.test(bare)) return `${prefix}${pattern}`
  }

  const segments = bare.split("/").filter(Boolean)
  if (segments.length > 2) return `${prefix}/${segments.slice(0, 2).join("/")}/*`
  // "/es" + "/" would be "/es/", which is a second row for the same page —
  // the exact duplication the trailing-slash strip above exists to prevent.
  if (bare === "/") return prefix || "/"
  return `${prefix}${bare}`
}

/**
 * Which metrics we send, and the thresholds Google defines for each.
 *
 * The rating is computed here rather than in the admin page so the stored
 * event carries the judgement that was current when it was measured — a
 * threshold change should not silently re-grade last month's data.
 */
const THRESHOLDS = {
  LCP: [2500, 4000],
  CLS: [0.1, 0.25],
  INP: [200, 500],
}

function rate(metric, value) {
  const bounds = THRESHOLDS[metric]
  if (!bounds) return "unknown"
  if (value <= bounds[0]) return "good"
  if (value <= bounds[1]) return "needs-improvement"
  return "poor"
}

/**
 * One send per metric per page load. web-vitals may report a metric more
 * than once as it settles (LCP especially), and only the last value is the
 * real one — so the sends happen when the page is hidden or unloaded, which
 * is what the library's reportAllChanges: false default already arranges.
 */
let started = false

/**
 * Registers the three listeners. Returns a promise nobody awaits.
 *
 * The library is loaded with a DYNAMIC import so it stays off the critical
 * path — it is telemetry, nothing renders from it, and adding it to the
 * entry chunk put first paint 1 KB past the budget e2e/first-paint-payload
 * enforces. Deferring it costs nothing measurable: web-vitals creates its
 * PerformanceObserver with `buffered: true`, so entries the browser recorded
 * before this module finished loading are still delivered. LCP in
 * particular is reported from the buffer.
 */
export function initVitals() {
  if (started || typeof window === "undefined") return false
  started = true

  const send = ({ name, value, rating }) => {
    // Checked at SEND time, not at init: a visitor who accepts the banner
    // after the page has loaded should have their measurements counted, and
    // one who never does should send nothing.
    if (!hasAnalyticsConsent()) return
    // Admin traffic is excluded from the funnel for the same reason
    // AnalyticsTracker excludes it: an operator on a warm cache is not a
    // visitor, and there are few enough of them to skew a route's p75.
    const path = routePattern(window.location?.pathname)
    if (path.startsWith("/admin")) return

    trackEvent("vital", {
      path,
      meta: {
        metric: name,
        // CLS is a small ratio; rounding it to an integer would store 0 for
        // every value that is not catastrophic.
        value: name === "CLS" ? Number(value.toFixed(4)) : Math.round(value),
        rating: rating || rate(name, value),
      },
    })
  }

  import("web-vitals")
    .then(({ onLCP, onCLS, onINP }) => {
      onLCP(send)
      onCLS(send)
      onINP(send)
    })
    // A telemetry chunk that fails to load must never surface to a visitor.
    .catch(() => { /* offline, blocked by an extension, a stale cache */ })

  return true
}

/** Test seam: lets a spec re-run init against a fresh module state. */
export function __resetForTests() {
  started = false
}
