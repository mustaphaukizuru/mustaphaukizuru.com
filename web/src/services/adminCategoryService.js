import { authFetch } from "../lib/api"

// ─────────────────────────────────────────────────────────────
// Admin Category Service (Frontend)
// Backend: /api/v1/admin/categories
//   GET    /         list all (real ProductCategory + legacy buckets)
//   POST   /         create new ProductCategory
//   PATCH  /:id      update name/slug/description/icon/sortOrder/isActive
//   DELETE /:id      delete ProductCategory + null products' categoryId
// ─────────────────────────────────────────────────────────────

export async function fetchAdminCategories() {
  const response = await authFetch("/api/v1/admin/categories", { method: "GET" })
  return Array.isArray(response?.data)
    ? response.data
    : Array.isArray(response)
    ? response
    : []
}

export async function createAdminCategory(payload) {
  const r = await authFetch("/api/v1/admin/categories", {
    method: "POST",
    body: JSON.stringify(payload || {}),
  })
  return r?.data || r
}

export async function updateAdminCategory(id, payload) {
  if (!id) throw new Error("Category id is required")
  const r = await authFetch(`/api/v1/admin/categories/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload || {}),
  })
  return r?.data || r
}

export async function deleteAdminCategory(id) {
  if (!id) throw new Error("Category id is required")
  const r = await authFetch(`/api/v1/admin/categories/${encodeURIComponent(id)}`, { method: "DELETE" })
  return r?.data || r
}
