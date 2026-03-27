import { authFetch } from "../lib/api"

// ─────────────────────────────────────────────────────────────────────────────
// Mercado Pago frontend service
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a Checkout Pro preference and return the redirect URL
 * @param {string} orderId
 * @returns {{ preferenceId, initPoint, sandboxPoint }}
 */
export async function createMercadoPagoPreference(orderId) {
  const response = await authFetch("/api/mercadopago/create-preference", {
    method: "POST",
    body:   JSON.stringify({ orderId }),
  })
  return response.data
}

/**
 * Poll order payment status after redirect back from MP
 * @param {string} orderId
 */
export async function getMercadoPagoStatus(orderId) {
  const response = await authFetch(`/api/mercadopago/status/${orderId}`)
  return response.data
}
