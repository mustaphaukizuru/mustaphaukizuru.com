import { apiRequest } from "../lib/api"

// ─────────────────────────────────────────────────────────────
// PayPal Service
// Public checkout-related PayPal requests
// Uses centralized API utility for environment-safe requests
// ─────────────────────────────────────────────────────────────

export async function createPaypalSession(orderId) {
  if (!orderId) {
    throw new Error("Order ID is required")
  }

  const response = await apiRequest("/api/v1/paypal/create-order", {
    method: "POST",
    body: JSON.stringify({ orderId }),
  })

  return response?.id || response?.data?.id || null
}

export async function capturePaypalSession(paypalOrderId, orderId) {
  if (!paypalOrderId) {
    throw new Error("PayPal order ID is required")
  }

  if (!orderId) {
    throw new Error("Order ID is required")
  }

  return apiRequest("/api/v1/paypal/capture-order", {
    method: "POST",
    body: JSON.stringify({
      paypalOrderId,
      orderId,
    }),
  })
}