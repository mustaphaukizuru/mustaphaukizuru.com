import { authFetch } from "../lib/api"

// ─────────────────────────────────────────────────────────────
// Admin Category Service (Frontend)
// ─────────────────────────────────────────────────────────────

export async function fetchAdminCategories() {
  const response = await authFetch("/api/admin/categories", {
    method: "GET",
  })

  return Array.isArray(response?.data)
    ? response.data
    : Array.isArray(response)
    ? response
    : []
}