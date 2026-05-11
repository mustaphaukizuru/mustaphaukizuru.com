import { apiRequest } from "../lib/api"

// ─────────────────────────────────────────────────────────────
// PayPal Service
// Public checkout-related PayPal requests
// Uses centralized API utility for environment-safe requests
//
// Endpoint contract (matches src/routes/paypalRoutes.js):
//   POST /api/v1/paypal/create-order/:orderId    → create PayPal Order
//   POST /api/v1/paypal/capture/:paypalOrderId   → capture after approval
//
// The orderId / paypalOrderId travel in the URL path, not the body.
// (Pre-fix versions of this file POSTed to the bare /create-order and
// /capture-order paths, which 404'd against the live backend — the
// checkout PayPal flow was never wired correctly.)
// ─────────────────────────────────────────────────────────────

export async function createPaypalSession(orderId) {
  if (!orderId) {
    throw new Error("Order ID is required")
  }

  const response = await apiRequest(
    `/api/v1/paypal/create-order/${encodeURIComponent(orderId)}`,
    { method: "POST" },
  )

  return response?.id || response?.data?.id || null
}

export async function capturePaypalSession(paypalOrderId, orderId) {
  if (!paypalOrderId) {
    throw new Error("PayPal order ID is required")
  }

  // `orderId` is kept as a defensive parameter but no longer required by
  // the backend — the capture controller derives the local order id from
  // the PayPal capture response's reference_id/custom_id. Callers that
  // already pass it are unaffected; new callers can omit it.

  return apiRequest(
    `/api/v1/paypal/capture/${encodeURIComponent(paypalOrderId)}`,
    {
      method: "POST",
      body: JSON.stringify({ orderId }),
    },
  )
}