import { authFetch } from "../lib/api"

// ─────────────────────────────────────────────────────────────
// Order Service (Authenticated)
// Uses centralized authFetch → consistent across environments
// ─────────────────────────────────────────────────────────────

export async function createOrder(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Order payload is required")
  }

  const response = await authFetch("/api/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  })

  return response?.data || response
}

export async function fetchMyOrders() {
  const response = await authFetch("/api/orders/my", {
    method: "GET",
  })

  return Array.isArray(response?.data)
    ? response.data
    : Array.isArray(response)
    ? response
    : []
}

export async function fetchMyOrderById(orderId) {
  if (!orderId) {
    throw new Error("Order ID is required")
  }

  const response = await authFetch(`/api/orders/${orderId}`, {
    method: "GET",
  })

  return response?.data || response
}