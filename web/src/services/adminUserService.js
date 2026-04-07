import { authFetch } from "../lib/api"

export async function fetchAdminUsers() {
  const response = await authFetch("/api/admin/users", { method: "GET" })

  // Backend returns { success, data: { users, meta, metrics } }
  const payload = response?.data || response || {}

  return {
    users: Array.isArray(payload.users) ? payload.users : (Array.isArray(payload) ? payload : []),
    metrics: payload.metrics || {},
    meta: payload.meta || {},
  }
}