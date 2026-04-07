import { authFetch } from "../lib/api"

export async function fetchAdminDownloads() {
  const response = await authFetch("/api/admin/downloads", { method: "GET" })

  // Backend returns { success, data: { downloads, topProducts, totalDownloads } }
  const payload = response?.data || response || {}

  return {
    downloads: Array.isArray(payload.downloads) ? payload.downloads : (Array.isArray(payload) ? payload : []),
    topProducts: Array.isArray(payload.topProducts) ? payload.topProducts : [],
    totalDownloads: payload.totalDownloads || 0,
  }
}