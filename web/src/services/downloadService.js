import { authFetch } from "../lib/api"

// ─────────────────────────────────────────────────────────────
// Download Service (Authenticated)
// Uses centralized authFetch for protected download access
// ─────────────────────────────────────────────────────────────

export async function getDownload(productId) {
  if (!productId) {
    throw new Error("Product ID is required")
  }

  const response = await authFetch(`/api/v1/downloads/${productId}`, {
    method: "GET",
  })

  return response?.data || response
}