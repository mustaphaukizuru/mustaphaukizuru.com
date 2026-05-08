import { authFetch } from "../lib/api"

/**
 * Wishlist client service (B08)
 *
 * Thin wrapper around /api/v1/member/wishlist. All calls require auth; the
 * authFetch helper in lib/api.js attaches the token and dispatches session
 * expiry on 401.
 *
 * Caller responsibility for optimistic UI:
 *   - On toggle-add   → update local state immediately, then call addItem()
 *   - On toggle-off   → update local state immediately, then call removeItem()
 *   - On failure      → revert local state (show a toast)
 */

/* ── Read ────────────────────────────────────────────────────────────── */

export async function fetchWishlist() {
  const res = await authFetch("/api/v1/member/wishlist", { method: "GET" })
  return Array.isArray(res?.data) ? res.data : []
}

/* ── Write ───────────────────────────────────────────────────────────── */

export async function addToWishlist(productId) {
  const res = await authFetch("/api/v1/member/wishlist/items", {
    method: "POST",
    body: JSON.stringify({ productId }),
  })
  return res?.data || null
}

export async function removeFromWishlist(itemId) {
  const res = await authFetch(`/api/v1/member/wishlist/items/${encodeURIComponent(itemId)}`, {
    method: "DELETE",
  })
  return res?.data || null
}

/**
 * Server removes the wishlist item + returns the product payload so the
 * client can push it into the local cart (CartContext.addToCart).
 */
export async function moveWishlistItemToCart(itemId) {
  const res = await authFetch(
    `/api/v1/member/wishlist/items/${encodeURIComponent(itemId)}/move-to-cart`,
    { method: "POST" }
  )
  return res?.data?.product || null
}
