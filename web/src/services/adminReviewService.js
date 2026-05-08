/* ════════════════════════════════════════════════════════════════════════
   adminReviewService.js · frontend client for /api/v1/admin/reviews
   ════════════════════════════════════════════════════════════════════════ */

import { authGet, authPost, authPatch, authDelete } from "../lib/api"

export async function fetchAdminReviewStats() {
  return authGet("/api/v1/admin/reviews/stats")
}

export async function fetchAdminReviews(params = {}) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v))
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return authGet(`/api/v1/admin/reviews${suffix}`)
}

export async function getAdminReview(id) {
  if (!id) throw new Error("id is required")
  return authGet(`/api/v1/admin/reviews/${encodeURIComponent(id)}`)
}

export async function updateAdminReview(id, payload) {
  if (!id) throw new Error("id is required")
  return authPatch(`/api/v1/admin/reviews/${encodeURIComponent(id)}`, payload)
}

export async function bulkAdminReviewAction(ids, action) {
  if (!Array.isArray(ids) || ids.length === 0) throw new Error("ids[] required")
  return authPost("/api/v1/admin/reviews/bulk", { ids, action })
}

export async function deleteAdminReview(id) {
  if (!id) throw new Error("id is required")
  return authDelete(`/api/v1/admin/reviews/${encodeURIComponent(id)}`)
}
