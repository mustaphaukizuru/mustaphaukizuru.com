import { authFetch } from "../lib/api"

// ─────────────────────────────────────────────────────────────
// Admin User Service (Frontend)
// ─────────────────────────────────────────────────────────────

export async function fetchAdminUsers() {
  const response = await authFetch("/api/admin/users", {
    method: "GET",
  })

  return Array.isArray(response?.data)
    ? response.data
    : Array.isArray(response)
    ? response
    : []
}