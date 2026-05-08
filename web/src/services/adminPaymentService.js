import { authFetch } from "../lib/api"

export async function fetchAdminPayments() {
  const response = await authFetch("/api/v1/admin/payments", { method: "GET" })

  // Backend returns { success, data: { payments, meta, metrics } }
  const payload = response?.data || response || {}

  return {
    payments: Array.isArray(payload.payments) ? payload.payments : (Array.isArray(payload) ? payload : []),
    metrics: payload.metrics || {},
    meta: payload.meta || {},
  }
}