import { getStoredToken } from "./authService"

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000"

async function adminOrderFetch(path, options = {}) {
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

export async function fetchAdminOrders() {
  const response = await adminOrderFetch("/api/admin/orders")
  return response.data || []
}

export async function fetchAdminOrderById(orderId) {
  const response = await adminOrderFetch(`/api/admin/orders/${orderId}`)
  return response.data
}

export async function updateAdminOrderStatus(orderId, status) {
  const response = await adminOrderFetch(`/api/admin/orders/${orderId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  })

  return response.data
}