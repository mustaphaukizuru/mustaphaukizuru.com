import { getStoredToken } from "./authService"

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000"

export async function fetchAdminDashboardStats() {
  const token = getStoredToken()

  if (!token) {
    throw new Error("Not authorized, token missing")
  }

  const response = await fetch(`${API_BASE_URL}/api/admin/dashboard`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || "Failed to load dashboard stats")
  }

  return data.data
}