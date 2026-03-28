import { apiRequest } from "../lib/api";

export async function createCheckoutSession(orderId) {
  const response = await apiRequest("/api/payments/create-checkout-session", {
    method: "POST",
    body: JSON.stringify({ orderId }),
  });

  return response.data;
}