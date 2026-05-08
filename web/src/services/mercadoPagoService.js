import { authFetch } from "../lib/api"

// ─────────────────────────────────────────────────────────────────────────────
// Mercado Pago frontend service
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a Checkout Pro preference and return the redirect payload
 * @param {string} orderId
 * @returns {Promise<{ preferenceId?: string, initPoint?: string, sandboxPoint?: string }>}
 */
export async function createMercadoPagoPreference(orderId) {
  if (!orderId) {
    throw new Error("Order ID is required")
  }

  const response = await authFetch("/api/v1/mercadopago/create-preference", {
    method: "POST",
    body: JSON.stringify({ orderId }),
  })

  return response?.data || response
}

/**
 * Poll order payment status after redirect back from Mercado Pago
 * @param {string} orderId
 */
export async function getMercadoPagoStatus(orderId) {
  if (!orderId) {
    throw new Error("Order ID is required")
  }

  const response = await authFetch(`/api/v1/mercadopago/status/${orderId}`, {
    method: "GET",
  })

  return response?.data || response
}