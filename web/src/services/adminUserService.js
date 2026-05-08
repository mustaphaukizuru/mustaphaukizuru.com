import { authFetch } from "../lib/api"

// ─────────────────────────────────────────────────────────────
// Admin Users Service (Frontend)
// Backend: /api/v1/admin/users
//   GET    /              list users + metrics
//   PATCH  /:id/status    suspend / activate / pending
//   PATCH  /:id/role      promote to admin / demote to member
// ─────────────────────────────────────────────────────────────

export async function fetchAdminUsers(params = {}) {
  const search = new URLSearchParams()
  if (params.page) search.set("page", params.page)
  if (params.limit) search.set("limit", params.limit)
  if (params.role) search.set("role", params.role)
  if (params.status) search.set("status", params.status)
  if (params.search) search.set("search", params.search)
  const qs = search.toString()
  const url = `/api/v1/admin/users${qs ? `?${qs}` : ""}`

  const response = await authFetch(url, { method: "GET" })
  const payload = response?.data || response || {}

  return {
    users: Array.isArray(payload.users) ? payload.users : (Array.isArray(payload) ? payload : []),
    metrics: payload.metrics || {},
    meta: payload.meta || {},
  }
}

export async function updateUserStatus(id, status) {
  if (!id) throw new Error("User id is required")
  const r = await authFetch(`/api/v1/admin/users/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  })
  return r?.data || r
}

export async function updateUserRole(id, role) {
  if (!id) throw new Error("User id is required")
  const r = await authFetch(`/api/v1/admin/users/${encodeURIComponent(id)}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  })
  return r?.data || r
}
