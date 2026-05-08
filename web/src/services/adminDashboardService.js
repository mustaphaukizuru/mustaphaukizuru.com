// web/src/services/adminDashboardService.js

import { authFetch } from "../lib/api"

// ─────────────────────────────────────────────────────────────
// Admin Dashboard Service (Clean + Centralized)
// Uses shared authFetch → consistent behavior across environments
// ─────────────────────────────────────────────────────────────

export async function fetchAdminDashboardStats() {
  const response = await authFetch("/api/v1/admin/dashboard", {
    method: "GET",
  })

  return {
    stats: response?.data?.stats || response?.stats || {},
    topProducts: response?.data?.topProducts || response?.topProducts || [],
    recentOrders: response?.data?.recentOrders || response?.recentOrders || [],
  }
}