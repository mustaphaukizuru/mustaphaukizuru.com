/**
 * analytics.js · GA4 helper
 *
 * Direct gtag.js — no react-ga4, no GTM. The gtag global is loaded from
 * the snippet in index.html, which is gated behind VITE_GA_MEASUREMENT_ID.
 * If the var isn't set (most dev environments), every helper here is a
 * no-op so we never pollute prod analytics with localhost traffic.
 *
 * Privacy: never pass PII (email, name, address) in event params. GA4
 * enhanced ecommerce event names are used so the GA UI auto-categorises.
 */

function gtagAvailable() {
  return typeof window !== "undefined" && typeof window.gtag === "function"
}

/** SPA route changes — call from AnalyticsTracker / SeoRouteManager. */
export function trackPageView(path) {
  if (!gtagAvailable()) return
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
  if (!gtagAvailable() || !name) return
  try { window.gtag("event", name, params) } catch { /* no-op */ }
}

/* ────── GA4 enhanced ecommerce — canonical event names ────── */
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
