/**
 * analytics.js · GA4 helper · consent-gated
 *
 * ══════════════════════════════════════════════════════════════════════════
 * GDPR / ePrivacy contract
 * ──────────────────────────────────────────────────────────────────────────
 * Until the user explicitly opts into the "analytics" category via the
 * cookie banner, NOTHING in this module makes a network request to
 * googletagmanager.com. Specifically:
 *
 *   · gtag.js is NOT loaded on page boot.
 *   · `consentSnapshot.analytics` defaults to `false`. Every public tracker
 *     (`trackEvent`, `trackPageView`, `trackAddToCart`, etc.) early-returns
 *     when this flag is false — silently, with no fallback request.
 *   · The script is injected lazily the first time `setAnalyticsConsent(true)`
 *     is called, and only if `VITE_GA_MEASUREMENT_ID` is set. Subsequent
 *     opt-in/opt-out toggles flip the snapshot without re-injecting.
 *
 * `CookieConsentContext` is the single source of truth — it calls
 * `setAnalyticsConsent(boolean)` (and the future `setMarketingConsent`)
 * whenever the user updates preferences. No React imports here — this is a
 * pure module so it's safe to import from non-React code (e.g. error
 * boundaries, the service worker glue).
 *
 * Why not Google Consent Mode v2?
 *   Consent Mode loads gtag.js immediately with default-denied flags and
 *   relies on Google to skip the network call. That's "compliant in spirit"
 *   but still ships ~70 KB of third-party JS to users who said no, and a
 *   careful regulator (CNIL, Garante) has historically squinted at it.
 *   Lazy injection sidesteps the argument entirely: a user who clicked
 *   "Reject all" sends ZERO bytes to Google.
 * ══════════════════════════════════════════════════════════════════════════
 */

// ── Consent state ──────────────────────────────────────────────────────────
// Module-scoped snapshot. Mirrors the user's choice in CookieConsentContext.
// Defaults to all-denied so any tracker call that fires BEFORE the consent
// context has had a chance to sync is treated as "no consent yet".
const consentSnapshot = {
  analytics: false,
  marketing: false,
}

// Has gtag.js been injected yet? One-shot; once true, never goes back.
let gtagInjected = false

function getMeasurementId() {
  // import.meta.env is provided by Vite at build time. Reading it here (not
  // at module top-level) keeps Jest/Node-side imports of this file safe.
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env.VITE_GA_MEASUREMENT_ID || ""
  }
  return ""
}

function injectGtagOnce() {
  if (gtagInjected) return
  if (typeof window === "undefined" || typeof document === "undefined") return
  const gaId = getMeasurementId()
  if (!gaId) return // No GA configured — nothing to load, all calls remain no-ops.
  gtagInjected = true

  // Bootstrap the dataLayer + gtag shim BEFORE the script loads so any
  // event we queue immediately survives the round-trip.
  window.dataLayer = window.dataLayer || []
   
  window.gtag = function gtag() { window.dataLayer.push(arguments) }
  window.gtag("js", new Date())
  window.gtag("config", gaId, { send_page_view: false })

  // Lazy-load the GA4 script. Async + no SRI required — Google's CDN
  // doesn't publish stable hashes for this asset.
  const s = document.createElement("script")
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`
  document.head.appendChild(s)
}

/**
 * Public consent toggles — called by CookieConsentContext only.
 * Idempotent: passing the same value twice in a row is a no-op.
 */
export function setAnalyticsConsent(allowed) {
  consentSnapshot.analytics = Boolean(allowed)
  if (consentSnapshot.analytics) injectGtagOnce()
  // On revoke we don't tear gtag.js down — the script may have already
  // initialised its own state; instead, every tracker early-returns and
  // no further events flow. This is what regulators care about.
}

export function setMarketingConsent(allowed) {
  consentSnapshot.marketing = Boolean(allowed)
  // Reserved for future marketing pixels (Meta, LinkedIn, etc.). Currently
  // unused by any tracker; declared here so the context can call it
  // symmetrically alongside setAnalyticsConsent and we keep one wiring path.
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function canTrack() {
  return consentSnapshot.analytics
    && typeof window !== "undefined"
    && typeof window.gtag === "function"
}

/** SPA route changes — call from AnalyticsTracker / SeoRouteManager. */
export function trackPageView(path) {
  if (!canTrack()) return
  try {
    window.gtag("event", "page_view", {
      page_path: path,
      page_location: typeof window !== "undefined" ? window.location.href : undefined,
      page_title: typeof document !== "undefined" ? document.title : undefined,
    })
  } catch { /* no-op */ }
}

/** Generic event — prefer named helpers below for ecommerce flows. */
export function trackEvent(name, params = {}) {
  if (!canTrack() || !name) return
  try { window.gtag("event", name, params) } catch { /* no-op */ }
}

/* ────── GA4 enhanced ecommerce — canonical event names ──────
 *
 * Privacy: never pass PII (email, name, address) in event params. GA4
 * enhanced ecommerce event names are used so the GA UI auto-categorises.
 *
 * All routes through trackEvent above, which checks consent on every call.
 */
export function trackAddToCart(item, currency = "MXN") {
  trackEvent("add_to_cart", {
    currency,
    value: Number(item?.price || 0),
    items: [{
      item_id:   item?.id,
      item_name: item?.title,
      price:     Number(item?.price || 0),
      quantity:  Number(item?.quantity || 1),
    }],
  })
}

export function trackBeginCheckout(cart, currency = "MXN") {
  if (!cart || !Array.isArray(cart.items)) return
  trackEvent("begin_checkout", {
    currency,
    value: Number(cart.totalAmount || cart.subtotal || 0),
    items: cart.items.map((it) => ({
      item_id:   it.productId || it.id,
      item_name: it.title || it.titleSnapshot,
      price:     Number(it.price || 0),
      quantity:  Number(it.quantity || 1),
    })),
  })
}

export function trackPurchase(order) {
  if (!order) return
  trackEvent("purchase", {
    transaction_id: order.orderNumber || order.id,
    value:          Number(order.totalAmount || 0),
    currency:       order.currency || "MXN",
    tax:            Number(order.taxAmount || 0),
    shipping:       0,
    coupon:         order.couponCode || undefined,
    items: (order.items || []).map((it) => ({
      item_id:   it.productId,
      item_name: it.titleSnapshot || it.title,
      price:     Number(it.unitPrice || it.price || 0),
      quantity:  Number(it.quantity || 1),
    })),
  })
}

export function trackNewsletterSignup(source = "footer") {
  trackEvent("newsletter_signup", { source })
}

export function trackContactSubmit() {
  trackEvent("contact_submit")
}

export function trackServiceOrder(serviceSlug, packageName) {
  trackEvent("service_order", { service_slug: serviceSlug, package: packageName })
}
