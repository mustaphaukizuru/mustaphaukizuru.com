import { authFetch } from "../lib/api"

// ─────────────────────────────────────────────────────────────
// Order Service (Authenticated)
// Uses centralized authFetch → consistent across environments
// ─────────────────────────────────────────────────────────────

export async function createOrder(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Order payload is required")
  }

  const response = await authFetch("/api/v1/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  })

  return response?.data || response
}

export async function fetchMyOrders() {
  const response = await authFetch("/api/v1/orders/my", {
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

  const response = await authFetch(`/api/v1/orders/${orderId}`, {
    method: "GET",
  })

  return response?.data || response
}

/**
 * Member-facing refund history for a single order. Returns []
 * when no refunds exist. Backend enforces owner-or-admin access.
 */
export async function fetchMyOrderRefunds(orderId) {
  if (!orderId) throw new Error("Order ID is required")
  const response = await authFetch(`/api/v1/member/orders/${orderId}/refunds`, {
    method: "GET",
  })
  return Array.isArray(response?.data) ? response.data : []
}

/**
 * Open a refund-request support ticket for an order. Returns the new
 * ticket reference + an eligibility snapshot (so the dashboard can
 * already explain the likely outcome to the customer).
 *
 * M16 — backend creates a SupportTicket with category='refund_request'
 * and links it to the order. Admins can then act from AdminSupportPage.
 */
export async function requestOrderRefund(orderId, { reason }) {
  if (!orderId) throw new Error("Order ID is required")
  const response = await authFetch(`/api/v1/member/orders/${orderId}/refund-request`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })
  return response?.data || response
}