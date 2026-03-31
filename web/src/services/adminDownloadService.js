import { authFetch } from "../lib/api"

// ─────────────────────────────────────────────────────────────
// Admin Download Service (Frontend)
// ─────────────────────────────────────────────────────────────

export async function fetchAdminDownloads() {
  const response = await authFetch("/api/admin/downloads", {
    method: "GET",
  })

  return Array.isArray(response?.data)
    ? response.data
    : Array.isArray(response)
    ? response
    : []
}