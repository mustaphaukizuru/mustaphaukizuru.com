import { authFetch } from "../lib/api"

// ─────────────────────────────────────────────────────────────
// Service-tier checkout
// Backend: POST /api/v1/services/order-by-tier (soft-auth — guests welcome)
// ─────────────────────────────────────────────────────────────

export async function orderServiceTier(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Order payload is required")
  }
  const response = await authFetch("/api/v1/services/order-by-tier", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return response?.data || response
}
