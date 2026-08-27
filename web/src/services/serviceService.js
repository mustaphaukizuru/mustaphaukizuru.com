/* ════════════════════════════════════════════════════════════════════════
   serviceService.js · Frontend client for /api/services (and admin CRUD)
   ────────────────────────────────────────────────────────────────────────
   Resilient by design:
     · listServices()             → full services index (graceful fallback)
     · fetchFeaturedServices()    → 4 flagship services for the home page
     · getServiceBySlug()         → service detail by slug
     · listAdminServices()        → admin CRUD list (auth-required)
     · createAdminService()       → admin create
     · updateAdminService()       → admin update
     · deleteAdminService()       → admin soft-delete

   The public read paths do not yet exist in the backend (B05). On API
   failure, the public read functions fall back to the static catalogue at
   "../data/servicesCatalogue.js" so consuming pages still render.
   ════════════════════════════════════════════════════════════════════════ */

import { apiGet, authGet, authPost, authPatch, authDelete } from "../lib/api"
import { getFlagshipServices, SERVICES, CATEGORIES } from "../data/servicesCatalogue"

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function safeArray(payload, key = "services") {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload[key])) return payload[key]
  if (Array.isArray(payload?.data?.[key])) return payload.data[key]
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

function shapeCatalogueService(s) {
  if (!s) return null
  const category = CATEGORIES.find((c) => c.code === s.categoryCode)
  return {
    id: s.id,
    slug: (s.slug || s.id || "").toLowerCase(),
    title: s.name,
    name: s.name,
    shortDescription: s.outcome,
    fullDescription: s.outcome,
    outcome: s.outcome,
    audience: s.audience,
    engagement: s.engagement,
    duration: s.duration,
    pricingModel: s.pricingModel,
    tier: s.tier,
    status: s.status,
    deliverables: s.deliverables,
    categoryCode: s.categoryCode,
    categoryName: category?.name || null,
  }
}

/* ── Public reads ────────────────────────────────────────────────────────── */

export async function listServices(opts = {}) {
  const { limit = 24, cursor } = opts
  const qs = new URLSearchParams()
  qs.set("limit", String(limit))
  if (cursor) qs.set("cursor", cursor)

  try {
    const res = await apiGet(`/api/services?${qs.toString()}`)
    const services = safeArray(res, "services")
    if (services.length > 0) {
      return {
        services,
        total: Number(res?.total ?? res?.data?.total ?? services.length),
        hasMore: Boolean(res?.hasMore ?? res?.data?.hasMore ?? false),
      }
    }
  } catch (err) {
    if (typeof console !== "undefined") {
      console.info("[serviceService] /api/services unavailable, using static catalogue.", err?.code)
    }
  }

  const all = SERVICES.slice(0, limit).map(shapeCatalogueService).filter(Boolean)
  return { services: all, total: SERVICES.length, hasMore: SERVICES.length > limit }
}

export async function fetchFeaturedServices(optsOrLimit = {}) {
  const limit = typeof optsOrLimit === "number" ? optsOrLimit : (optsOrLimit?.limit || 4)

  try {
    const qs = new URLSearchParams()
    qs.set("featured", "true")
    qs.set("limit", String(limit))
    const res = await apiGet(`/api/services?${qs.toString()}`)
    const live = safeArray(res, "services")
    if (live.length > 0) return live.slice(0, limit)
  } catch (err) {
    if (typeof console !== "undefined") {
      console.info("[serviceService] featured services unavailable, using flagship catalogue.", err?.code)
    }
  }

  return getFlagshipServices().slice(0, limit).map(shapeCatalogueService).filter(Boolean)
}

/* ────────────────────────────────────────────────────────────────────────
   Public · Audience pricing matrix
   Backend: GET /api/v1/services/audience-plans
   Returns { plans: { [audience]: {...UI shape} }, order: [...] }

   The shape lines up with the static AUDIENCE_PRICING_PLANS in
   web/src/data/servicesCatalogue.js so consumers can swap with no churn.
   ──────────────────────────────────────────────────────────────────────── */
export async function fetchAudiencePlans() {
  try {
    const res = await apiGet("/api/v1/services/audience-plans")
    const payload = res?.data || res
    if (payload?.plans && Object.keys(payload.plans).length > 0) {
      return { plans: payload.plans, order: payload.order || Object.keys(payload.plans) }
    }
    // Empty result → fall through to caller's fallback
    return null
  } catch (err) {
    if (typeof console !== "undefined") {
      console.info("[serviceService] /audience-plans unavailable, caller should fall back.", err?.code)
    }
    return null
  }
}

/* ────────────────────────────────────────────────────────────────────────
   Public · DB prices + tier availability (T1 source of truth)
   Backend: GET /api/v1/services/plans
   Returns { audiences: [{ code, serviceSlug, tiers: [{ tierKey, name,
             price, currency, period, popular, saveLabel, packageId }] }] }

   Marketing copy stays in web/src/data/servicesCatalogue.js; callers overlay
   these prices onto the static matrix by (audience, tierKey). Throws on
   failure so useApiQuery can surface `error` and the caller can fall back.
   ──────────────────────────────────────────────────────────────────────── */
export async function fetchServicePlans(options = {}) {
  const res = await apiGet("/api/v1/services/plans", options)
  const payload = res?.data || res
  return { audiences: Array.isArray(payload?.audiences) ? payload.audiences : [] }
}

/** { [audience]: { [tierKey]: tier } } lookup built from fetchServicePlans(). */
export function indexServicePlans(plans) {
  const map = {}
  for (const aud of plans?.audiences || []) {
    if (!aud?.code) continue
    map[aud.code] = {}
    for (const tier of aud.tiers || []) {
      if (tier?.tierKey) map[aud.code][tier.tierKey] = tier
    }
  }
  return map
}

export async function getServiceBySlug(slug) {
  if (!slug) return null
  try {
    const res = await apiGet(`/api/services/${encodeURIComponent(slug)}`)
    if (res) return res?.service || res?.data || res
  } catch (err) {
    if (typeof console !== "undefined") {
      console.info(`[serviceService] /api/services/${slug} unavailable.`, err?.code)
    }
  }
  const needle = String(slug).toLowerCase()
  const hit = SERVICES.find((s) => s.id.toLowerCase() === needle)
  return hit ? shapeCatalogueService(hit) : null
}

/* Alias kept for ServiceDetailPage and any other older callers that
 * imported the function under its previous name. */
export const fetchServiceBySlug = getServiceBySlug

/* ────────────────────────────────────────────────────────────────────────
 * Public · place a service-package order from the detail page.
 *
 * Hits POST /api/services/:slug/order when authenticated (the route is
 * planned in src/routes/serviceRoutes.js, comment block). The handler
 * is expected to create a ServiceOrder row and return either:
 *   { redirectUrl: "/checkout/service?token=…" }  for paid tiers, or
 *   { redirectUrl: "/dashboard/service-orders" } for $0/free intake.
 *
 * If the route 404s (backend not yet implementing it), we gracefully
 * fall back to the guest-friendly /api/services/order-by-tier endpoint
 * with a similar payload shape so the page can still complete the flow.
 * ──────────────────────────────────────────────────────────────────────── */
export async function orderServicePackage(slug, payload = {}) {
  if (!slug) throw new Error("orderServicePackage: slug is required")
  const body = {
    serviceSlug: slug,
    packageId: payload.packageId,
    requirements: payload.requirements || undefined,
    preferredStartDate: payload.preferredStartDate || undefined,
    audience: payload.audience || undefined,
    tier: payload.tier || undefined,
  }
  // First attempt — slug-scoped, authenticated route.
  try {
    return await authPost(`/api/services/${encodeURIComponent(slug)}/order`, body)
  } catch (err) {
    const code = err?.status || err?.code
    if (code !== 404 && code !== 405) throw err
    // Fall through to legacy guest-friendly endpoint.
  }
  return authPost(`/api/services/order-by-tier`, body)
}

/* ── Admin (auth-required) ──────────────────────────────────────────────── */

export async function listAdminServices(opts = {}) {
  const { limit = 50, cursor } = opts
  const qs = new URLSearchParams()
  qs.set("limit", String(limit))
  if (cursor) qs.set("cursor", cursor)
  return authGet(`/api/admin/services?${qs.toString()}`)
}

export async function createAdminService(payload) {
  return authPost("/api/admin/services", payload)
}

export async function updateAdminService(id, payload) {
  if (!id) throw new Error("updateAdminService: id is required")
  return authPatch(`/api/admin/services/${encodeURIComponent(id)}`, payload)
}

export async function deleteAdminService(id) {
  if (!id) throw new Error("deleteAdminService: id is required")
  return authDelete(`/api/admin/services/${encodeURIComponent(id)}`)
}

export async function getAdminService(id) {
  if (!id) throw new Error("getAdminService: id is required")
  return authGet(`/api/admin/services/${encodeURIComponent(id)}`)
}

/* ────────────────────────────────────────────────────────────────────────
   Admin · Packages (pricing plans on a Service)
   Backend: src/routes/adminServiceRoutes.js
     POST   /admin/services/:id/packages
     PATCH  /admin/services/:id/packages/:pid
     DELETE /admin/services/:id/packages/:pid
   ──────────────────────────────────────────────────────────────────────── */

export async function addAdminServicePackage(serviceId, payload) {
  if (!serviceId) throw new Error("addAdminServicePackage: serviceId is required")
  return authPost(`/api/admin/services/${encodeURIComponent(serviceId)}/packages`, payload)
}

export async function updateAdminServicePackage(serviceId, packageId, payload) {
  if (!serviceId || !packageId) throw new Error("updateAdminServicePackage: serviceId + packageId required")
  return authPatch(
    `/api/admin/services/${encodeURIComponent(serviceId)}/packages/${encodeURIComponent(packageId)}`,
    payload
  )
}

export async function removeAdminServicePackage(serviceId, packageId) {
  if (!serviceId || !packageId) throw new Error("removeAdminServicePackage: serviceId + packageId required")
  return authDelete(
    `/api/admin/services/${encodeURIComponent(serviceId)}/packages/${encodeURIComponent(packageId)}`
  )
}

/* ────────────────────────────────────────────────────────────────────────
   Admin · Features (bullet-point inclusions on a Service)
   Backend:
     POST   /admin/services/:id/features
     DELETE /admin/services/:id/features/:fid
   ──────────────────────────────────────────────────────────────────────── */

export async function addAdminServiceFeature(serviceId, payload) {
  if (!serviceId) throw new Error("addAdminServiceFeature: serviceId is required")
  return authPost(`/api/admin/services/${encodeURIComponent(serviceId)}/features`, payload)
}

export async function removeAdminServiceFeature(serviceId, featureId) {
  if (!serviceId || !featureId) throw new Error("removeAdminServiceFeature: serviceId + featureId required")
  return authDelete(
    `/api/admin/services/${encodeURIComponent(serviceId)}/features/${encodeURIComponent(featureId)}`
  )
}
