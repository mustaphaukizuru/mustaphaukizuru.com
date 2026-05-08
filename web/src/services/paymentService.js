import { apiRequest } from "../lib/api"

export async function createCheckoutSession(orderId) {
  if (!orderId) {
    throw new Error("Order ID is required")
  }

  const response = await apiRequest("/api/v1/payments/create-checkout-session", {
    method: "POST",
    body: JSON.stringify({ orderId }),
  })

  return response?.data || response
}