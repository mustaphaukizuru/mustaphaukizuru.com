import { apiRequest, authFetch } from "../lib/api"

/**
 * Frontend cart service — wraps every member cart + coupon endpoint.
 * All authenticated calls use authFetch; coupon validation uses apiRequest
 * (public endpoint, honors JWT if present).
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────────────────── */

function unwrap(response) {
  return response?.data ?? null
}

/* ────────────────────────────────────────────────────────────────────────────
 * Cart (authenticated)
 * ──────────────────────────────────────────────────────────────────────────── */

/** GET /api/v1/member/cart */
export async function fetchCart() {
  const response = await authFetch("/api/v1/member/cart", { method: "GET" })
  return unwrap(response)
}

/**
 * POST /api/v1/member/cart/items
 * @param {{ productId?: string, serviceId?: string, quantity?: number }} payload
 */
export async function addCartItem(payload) {
  const response = await authFetch("/api/v1/member/cart/items", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return unwrap(response)
}

/** PATCH /api/v1/member/cart/items/:itemId */
export async function updateCartItem(itemId, quantity) {
  const response = await authFetch(`/api/v1/member/cart/items/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    body: JSON.stringify({ quantity }),
  })
  return unwrap(response)
}

/** DELETE /api/v1/member/cart/items/:itemId */
export async function removeCartItem(itemId) {
  const response = await authFetch(`/api/v1/member/cart/items/${encodeURIComponent(itemId)}`, {
    method: "DELETE",
  })
  return unwrap(response)
}

/** DELETE /api/v1/member/cart */
export async function clearServerCart() {
  const response = await authFetch("/api/v1/member/cart", { method: "DELETE" })
  return unwrap(response)
}

/**
 * POST /api/v1/member/cart/merge
 * Merge a guest localStorage cart into the user's server cart on login.
 * @param {Array<{ productId?: string, serviceId?: string, quantity?: number, id?: string }>} items
 */
export async function mergeGuestCart(items) {
  const response = await authFetch("/api/v1/member/cart/merge", {
    method: "POST",
    body: JSON.stringify({ items: Array.isArray(items) ? items : [] }),
  })
  return {
    cart: response?.data ?? null,
    merged: response?.merged ?? 0,
    skipped: response?.skipped ?? 0,
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Coupon
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * POST /api/v1/coupons/validate — public precheck before applying.
 * @param {string} code
 * @param {number} cartTotal
 * @returns {Promise<{ valid: boolean, discount: number, message: string, coupon: object | null }>}
 */
export async function validateCoupon(code, cartTotal) {
  const response = await apiRequest("/api/v1/coupons/validate", {
    method: "POST",
    body: JSON.stringify({ code, cartTotal }),
  })
  return response?.data ?? { valid: false, discount: 0, message: "Unknown response", coupon: null }
}

/** POST /api/v1/member/cart/coupon — apply a coupon to the server cart. */
export async function applyCartCoupon(code) {
  const response = await authFetch("/api/v1/member/cart/coupon", {
    method: "POST",
    body: JSON.stringify({ code }),
  })
  return unwrap(response)
}

/** DELETE /api/v1/member/cart/coupon — remove the applied coupon. */
export async function removeCartCoupon() {
  const response = await authFetch("/api/v1/member/cart/coupon", { method: "DELETE" })
  return unwrap(response)
}
