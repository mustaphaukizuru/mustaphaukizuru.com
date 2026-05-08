import { authFetch } from "../lib/api"

/**
 * Service order client (#5)
 *
 * Hits /api/v1/member/service-orders — auth required.
 * Backend endpoints: GET /  (list)  ·  GET /:id  (detail)
 */

export async function fetchMyServiceOrders() {
  const r = await authFetch(`/api/v1/member/service-orders`, { method: "GET" })
  return Array.isArray(r?.data) ? r.data : []
}

export async function fetchMyServiceOrderById(id) {
  if (!id) throw new Error("Service order id is required")
  const r = await authFetch(`/api/v1/member/service-orders/${encodeURIComponent(id)}`, { method: "GET" })
  return r?.data || null
}

/* ════════════════════════════════════════════════════════════════════════
   Admin endpoints — /api/v1/admin/service-orders
   ──────────────────────────────────────────────────────────────────────
   Backend: src/routes/adminServiceOrdersRoutes.js (mounted at /admin/service-orders)
     GET    /                                  → list all service orders
     GET    /:id                               → get a single order
     PATCH  /:id                               → update status / notes / etc.
     POST   /:id/consultations                 → schedule a consultation against the order
     POST   /:id/project                       → spin up a client project
     POST   /projects/:projectId/milestones    → add milestone
     PATCH  /milestones/:milestoneId           → update milestone
   ════════════════════════════════════════════════════════════════════════ */

export async function adminListServiceOrders(filters = {}) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v))
  })
  const qs = params.toString()
  const r = await authFetch(`/api/v1/admin/service-orders${qs ? `?${qs}` : ""}`, { method: "GET" })
  // Endpoint may return either an array or { data, pagination }
  if (Array.isArray(r)) return { data: r, pagination: { total: r.length, page: 1, pageSize: r.length } }
  return r?.data ? r : { data: [], pagination: { total: 0, page: 1, pageSize: 25 } }
}

export async function adminGetServiceOrder(id) {
  if (!id) throw new Error("Service order id is required")
  const r = await authFetch(`/api/v1/admin/service-orders/${encodeURIComponent(id)}`, { method: "GET" })
  return r?.data || r || null
}

export async function adminUpdateServiceOrder(id, patch) {
  if (!id) throw new Error("Service order id is required")
  const r = await authFetch(`/api/v1/admin/service-orders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch || {}),
    headers: { "Content-Type": "application/json" },
  })
  return r?.data || r
}

export async function adminScheduleOrderConsultation(orderId, payload) {
  if (!orderId) throw new Error("Service order id is required")
  const r = await authFetch(`/api/v1/admin/service-orders/${encodeURIComponent(orderId)}/consultations`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
    headers: { "Content-Type": "application/json" },
  })
  return r?.data || r
}

export async function adminCreateOrderProject(orderId, payload) {
  if (!orderId) throw new Error("Service order id is required")
  const r = await authFetch(`/api/v1/admin/service-orders/${encodeURIComponent(orderId)}/project`, {
    method: "POST",
    body: JSON.stringify(payload || {}),
    headers: { "Content-Type": "application/json" },
  })
  return r?.data || r
}
