import { API_BASE_URL } from "../lib/api"
import { getStoredToken } from "./authService"

export async function getDownload(productId) {
  const token = getStoredToken()

  const response = await fetch(`${API_BASE_URL}/api/downloads/${productId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || "Failed to get download.")
  }

  return data.data
}
