import { apiRequest, authFetch } from "../lib/api"

export async function fetchProductReviews(slug) {
  const response = await apiRequest(`/api/products/${slug}/reviews`)
  return response?.data || { reviews: [], stats: { averageRating: 0, totalReviews: 0, distribution: {} } }
}

export async function submitProductReview(slug, { rating, reviewText }) {
  const response = await authFetch(`/api/products/${slug}/reviews`, {
    method: "POST",
    body: JSON.stringify({ rating, reviewText }),
  })
  return response?.data
}

export async function deleteProductReview(slug, reviewId) {
  return authFetch(`/api/products/${slug}/reviews/${reviewId}`, {
    method: "DELETE",
  })
}
