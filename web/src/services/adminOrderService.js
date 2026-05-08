import { authFetch } from "../lib/api"

// ─────────────────────────────────────────────────────────────
// Admin Order Service (Frontend)
// ─────────────────────────────────────────────────────────────

export async function fetchAdminOrders() {
  const response = await authFetch("/api/v1/admin/orders", {
    method: "GET",
  })

  return Array.isArray(response?.data)
    ? response.data
    : Array.isArray(response)
    ? response
    : []
}

export async function fetchAdminOrderById(orderId) {
  if (!orderId) {
    throw new Error("Order ID is required")
  }

  const response = await authFetch(`/api/v1/admin/orders/${orderId}`, {
    method: "GET",
  })

  return response?.data || response
}

export async function updateAdminOrderStatus(orderId, status) {
  if (!orderId) {
    throw new Error("Order ID is required")
  }

  if (!status) {
    throw new Error("Status is required")
  }

  const response = await authFetch(
    `/api/v1/admin/orders/${orderId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }
  )

  return response?.data || response
}