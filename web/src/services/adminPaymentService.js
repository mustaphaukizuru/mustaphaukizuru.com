import { authFetch } from "../lib/api"

// ─────────────────────────────────────────────────────────────
// Admin Payment Service (Frontend)
// ─────────────────────────────────────────────────────────────

export async function fetchAdminPayments() {
  const response = await authFetch("/api/admin/payments", {
    method: "GET",
  })

  return Array.isArray(response?.data)
    ? response.data
    : Array.isArray(response)
    ? response
    : []
}