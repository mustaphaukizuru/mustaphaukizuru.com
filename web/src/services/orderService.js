import { authFetch } from "../lib/api"

// ─────────────────────────────────────────────────────────────
// Order Service (Authenticated)
// Uses centralized authFetch → consistent across environments
// ─────────────────────────────────────────────────────────────

/**
 * One key per checkout ATTEMPT, not per page load.
 *
 * The server treats a repeated Idempotency-Key from the same user as "give
 * me the order I already created" — which is exactly right when a flaky
 * mobile connection drops the response and the browser (or the user) retries.
 * It would be exactly wrong if two genuinely different purchases shared a
 * key, so the key is minted fresh for each createOrder() call and never
 * persisted. `crypto.randomUUID` is available in every browser this app
 * supports; the fallback only exists for very old WebViews and is still
 * unguessable enough for a value scoped to the caller's own account.
 */
function mintIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

export async function createOrder(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Order payload is required")
  }

  const response = await authFetch("/api/v1/orders", {
    method: "POST",
    headers: { "Idempotency-Key": mintIdempotencyKey() },
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