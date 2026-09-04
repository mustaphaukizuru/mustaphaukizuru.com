import { authFetch } from "../lib/api"

// ─────────────────────────────────────────────────────────────
// PayPal Service
// Authenticated checkout-related PayPal requests
//
// Endpoint contract (matches src/routes/paypalRoutes.js):
//   POST /api/v1/paypal/create-order/:orderId    → create PayPal Order
//   POST /api/v1/paypal/capture/:paypalOrderId   → capture after approval
//
// Both routes mount the `protect` middleware on the backend, so the
// frontend MUST send a Bearer token. `authFetch` injects the stored
// JWT into the Authorization header automatically — `apiRequest`
// does not, which is why a pre-fix version of this file produced the
// "Authentication token required" error in the PayPal modal even
// after the route paths were corrected. MercadoPago's service uses
// the same `authFetch` pattern; keep them aligned.
//
// The orderId / paypalOrderId travel in the URL path, not the body.
// (Pre-fix versions POSTed to bare /create-order and /capture-order
// paths, which 404'd against the live backend — the checkout PayPal
// flow was never fully wired.)
// ─────────────────────────────────────────────────────────────

export async function createPaypalSession(orderId) {
  if (!orderId) {
    throw new Error("Order ID is required")
  }

  const response = await authFetch(
    `/api/v1/paypal/create-order/${encodeURIComponent(orderId)}`,
    { method: "POST" },
  )

  return response?.data?.paypalOrderId || response?.paypalOrderId || response?.data?.id || response?.id || null
}

export async function capturePaypalSession(paypalOrderId, orderId) {
  if (!paypalOrderId) {
    throw new Error("PayPal order ID is required")
  }

  // `orderId` is kept as a defensive parameter but no longer required by
  // the backend — the capture controller derives the local order id from
  // the PayPal capture response's reference_id/custom_id. Callers that
  // already pass it are unaffected; new callers can omit it.

  return authFetch(
    `/api/v1/paypal/capture/${encodeURIComponent(paypalOrderId)}`,
    {
      method: "POST",
      body: JSON.stringify({ orderId }),
    },
  )
}