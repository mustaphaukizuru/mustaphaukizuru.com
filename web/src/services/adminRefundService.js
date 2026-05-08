// ─────────────────────────────────────────────────────────────────────────────
// Admin Refund Service · Frontend (M15)
//
// Thin client over /api/v1/admin/refunds + /api/v1/admin/orders/:id/refund*.
// Mirrors the shape of services/adminOrderService.js so AdminOrderDetailPage
// can import these symmetrically.
// ─────────────────────────────────────────────────────────────────────────────

import { authFetch } from "../lib/api"

/**
 * Fetch the refund eligibility report for an order (read-only).
 * Returned data drives the "Refund" modal in AdminOrderDetailPage.
 */
export async function fetchRefundEligibility(orderId) {
  if (!orderId) throw new Error("Order ID is required")
  const response = await authFetch(`/api/v1/admin/orders/${orderId}/refund-eligibility`, {
    method: "GET",
  })
  return response?.data || response
}

/**
 * Issue a refund against an order.
 *
 * @param {string} orderId
 * @param {object} payload
 * @param {number}  [payload.amount]          null/undefined ⇒ full refund
 * @param {string[]} [payload.orderItemIds]   restrict to specific items
 * @param {string}  [payload.reason]          shown in audit + email body
 * @param {boolean} [payload.force]           override Option A download gate
 */
export async function issueAdminRefund(orderId, payload = {}) {
  if (!orderId) throw new Error("Order ID is required")
  const response = await authFetch(`/api/v1/admin/orders/${orderId}/refund`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return response?.data || response
}

/**
 * Fetch refund history for a single order (admin view).
 * The same data is available to members via /member/orders/:id/refunds.
 */
export async function fetchRefundsForOrder(orderId) {
  if (!orderId) throw new Error("Order ID is required")
  const response = await authFetch(`/api/v1/admin/refunds?orderId=${encodeURIComponent(orderId)}`, {
    method: "GET",
  })
  return Array.isArray(response?.data) ? response.data : []
}

/**
 * Paginated list of all refunds across the platform (admin AdminPayments page).
 *
 * @param {object} [params]
 * @param {string} [params.status]
 * @param {number} [params.page]
 * @param {number} [params.limit]
 */
export async function fetchAdminRefunds({ status, page, limit } = {}) {
  const qs = new URLSearchParams()
  if (status) qs.set("status", status)
  if (page) qs.set("page", String(page))
  if (limit) qs.set("limit", String(limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  const response = await authFetch(`/api/v1/admin/refunds${suffix}`, { method: "GET" })
  return {
    refunds: Array.isArray(response?.data) ? response.data : [],
    meta: response?.meta || null,
  }
}
