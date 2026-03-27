import { getStoredToken } from "./authService"

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000"

async function orderFetch(path, options = {}) {
  const token = getStoredToken()

  if (!token) {
    throw new Error("Not authorized, token missing")
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || "Request failed")
  }

  return data
}

export async function createOrder(payload) {
  const response = await orderFetch("/api/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  })

  return response.data
}

export async function fetchMyOrders() {
  const response = await orderFetch("/api/orders/my")
  return response.data || []
}

export async function fetchMyOrderById(orderId) {
  const response = await orderFetch(`/api/orders/${orderId}`)
  return response.data
}