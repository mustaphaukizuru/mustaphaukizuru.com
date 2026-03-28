const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000"

export const createPaypalSession = async (orderId) => {
  const res = await fetch(`${API_BASE}/api/paypal/create-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orderId }),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data.message || "Failed to create PayPal order")
  }

  return data.id
}

export const capturePaypalSession = async (paypalOrderId, orderId) => {
  const res = await fetch(`${API_BASE}/api/paypal/capture-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      paypalOrderId,
      orderId,
    }),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data.message || "PayPal capture failed")
  }

  return data
}