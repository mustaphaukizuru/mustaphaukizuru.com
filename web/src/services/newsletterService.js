import { apiRequest, authFetch } from "../lib/api"

/**
 * Public newsletter endpoints (B07).
 */

export async function subscribeNewsletter({ email, name, source }) {
  return apiRequest("/api/v1/newsletter/subscribe", {
    method: "POST",
    body: JSON.stringify({ email, name, source }),
  })
}

/**
 * Admin newsletter management.
 */

export async function adminListSubscribers({ status, q, page = 1, limit = 50 } = {}) {
  const params = new URLSearchParams()
  if (status) params.append("status", String(status))
  if (q) params.append("q", String(q))
  params.append("page", String(page))
  params.append("limit", String(limit))
  const res = await authFetch(`/api/v1/admin/newsletter/subscribers?${params.toString()}`, { method: "GET" })
  return {
    items: Array.isArray(res?.data) ? res.data : [],
    pagination: res?.pagination || null,
  }
}

export async function adminDeleteSubscriber(id) {
  const res = await authFetch(`/api/v1/admin/newsletter/subscribers/${encodeURIComponent(id)}`, { method: "DELETE" })
  return res?.data || null
}
