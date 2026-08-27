/* ════════════════════════════════════════════════════════════════════════
   reviewService.js · frontend client for public review endpoints
   ────────────────────────────────────────────────────────────────────────
   Surfaces both product and service reviews behind the same shape, plus
   the subject-agnostic helpful-vote endpoint.
   ════════════════════════════════════════════════════════════════════════ */

import { apiRequest, authFetch } from "../lib/api"

const EMPTY = { reviews: [], stats: { averageRating: 0, totalReviews: 0, distribution: {} } }

/* ── Products ──────────────────────────────────────────────────────────── */

export async function fetchProductReviews(slug) {
  const response = await apiRequest(`/api/v1/products/${encodeURIComponent(slug)}/reviews`)
  return response?.data || EMPTY
}

export async function submitProductReview(slug, { rating, reviewText }) {
  const response = await authFetch(`/api/v1/products/${encodeURIComponent(slug)}/reviews`, {
    method: "POST",
    body: JSON.stringify({ rating, reviewText }),
  })
  // Surface the message + status alongside the review so the UI can
  // distinguish "live now" from "in the queue".
  return {
    review: response?.data || null,
    message: response?.message || null,
    status: response?.data?.status || null,
  }
}

export async function deleteProductReview(slug, reviewId) {
  return authFetch(`/api/v1/products/${encodeURIComponent(slug)}/reviews/${encodeURIComponent(reviewId)}`, {
    method: "DELETE",
  })
}

/* ── Services ──────────────────────────────────────────────────────────── */

export async function fetchServiceReviews(slug) {
  const response = await apiRequest(`/api/v1/services/${encodeURIComponent(slug)}/reviews`)
  return response?.data || EMPTY
}

export async function submitServiceReview(slug, { rating, reviewText }) {
  const response = await authFetch(`/api/v1/services/${encodeURIComponent(slug)}/reviews`, {
    method: "POST",
    body: JSON.stringify({ rating, reviewText }),
  })
  return {
    review: response?.data || null,
    message: response?.message || null,
    status: response?.data?.status || null,
  }
}

export async function deleteServiceReview(slug, reviewId) {
  return authFetch(`/api/v1/services/${encodeURIComponent(slug)}/reviews/${encodeURIComponent(reviewId)}`, {
    method: "DELETE",
  })
}

/* ── Public · Featured reviews ─────────────────────────────────────────── */

/**
 * Fetch the top-N admin-curated featured reviews across products + services.
 * Used by the FeaturedReviewsRibbon on Home / About pages.
 */
export async function fetchFeaturedReviews({ limit = 6, signal } = {}) {
  const response = await apiRequest(
    `/api/v1/reviews/featured?limit=${encodeURIComponent(limit)}`,
    signal ? { signal } : {},
  )
  return response?.data || []
}

/* ── Subject-agnostic actions ──────────────────────────────────────────── */

/**
 * Toggle a "helpful" vote on a review. Idempotent — calling twice removes
 * the vote. Returns { helpful, helpfulCount } so the UI can re-render.
 */
export async function markReviewHelpful(reviewId) {
  const response = await authFetch(`/api/v1/reviews/${encodeURIComponent(reviewId)}/helpful`, {
    method: "POST",
  })
  return response?.data || { helpful: false, helpfulCount: 0 }
}
