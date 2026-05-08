/* ════════════════════════════════════════════════════════════════════════
   recommendationService.js · public reads + admin CRUD client
   ════════════════════════════════════════════════════════════════════════ */

import { apiGet, authGet, authPost, authPatch, authDelete } from "../lib/api"

/* ── Public ───────────────────────────────────────────────────────────── */

export async function fetchRecommendations({ category, limit = 24 } = {}) {
  const qs = new URLSearchParams()
  if (category) qs.set("category", category)
  if (limit) qs.set("limit", String(limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  const res = await apiGet(`/api/v1/recommendations${suffix}`)
  return res?.data || []
}

export async function fetchRecommendationBySlug(slug) {
  if (!slug) return null
  const res = await apiGet(`/api/v1/recommendations/${encodeURIComponent(slug)}`)
  return res?.data || null
}

/* ── Admin ────────────────────────────────────────────────────────────── */

export async function listAdminRecommendations(params = {}) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v))
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  return authGet(`/api/v1/admin/recommendations${suffix}`)
}

export async function getAdminRecommendation(id) {
  if (!id) throw new Error("id is required")
  return authGet(`/api/v1/admin/recommendations/${encodeURIComponent(id)}`)
}

export async function createAdminRecommendation(payload) {
  return authPost("/api/v1/admin/recommendations", payload)
}

export async function updateAdminRecommendation(id, payload) {
  if (!id) throw new Error("id is required")
  return authPatch(`/api/v1/admin/recommendations/${encodeURIComponent(id)}`, payload)
}

export async function deleteAdminRecommendation(id) {
  if (!id) throw new Error("id is required")
  return authDelete(`/api/v1/admin/recommendations/${encodeURIComponent(id)}`)
}
