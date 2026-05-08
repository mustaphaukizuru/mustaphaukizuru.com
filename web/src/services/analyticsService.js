import { apiRequest, authFetch } from "../lib/api"

/* ────────────────────────────────────────────────────────────────────────────
 * M14 · Analytics · public tracking (fire-and-forget)
 * Always returns 204 from the API; we swallow errors so analytics never
 * impacts the user-visible page render.
 * ──────────────────────────────────────────────────────────────────────────── */

export async function trackPageView({ path, referrer, country } = {}) {
  try {
    await apiRequest(`/api/v1/analytics/pageview`, {
      method: "POST",
      body: JSON.stringify({ path, referrer, country }),
    })
  } catch {
    /* analytics must never throw upstream — silent fail */
  }
}

export async function trackEvent(name, payload = {}) {
  if (!name) return
  try {
    await apiRequest(`/api/v1/analytics/event`, {
      method: "POST",
      body: JSON.stringify({ name, ...payload }),
    })
  } catch {
    /* silent */
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * M14 · Admin reads
 * ──────────────────────────────────────────────────────────────────────────── */

export async function adminFetchAnalyticsDashboard({ days = 30 } = {}) {
  const r = await authFetch(`/api/v1/admin/analytics/dashboard?days=${encodeURIComponent(days)}`, { method: "GET" })
  return r?.data || {
    kpis: { pageviews: 0, sessions: 0, addToCart: 0, beginCheckout: 0, purchases: 0, revenue: 0, conversionRate: 0 },
    topPaths: [],
    daily: [],
    devices: [],
    daysBack: days,
  }
}

export async function adminFetchAnalyticsEvents({ days = 7, limit = 100 } = {}) {
  const r = await authFetch(
    `/api/v1/admin/analytics/events?days=${encodeURIComponent(days)}&limit=${encodeURIComponent(limit)}`,
    { method: "GET" }
  )
  return Array.isArray(r?.data) ? r.data : []
}
