import { getStoredToken } from "./authService"

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000"

async function adminFetch(path, options = {}) {
  const token = getStoredToken()

  if (!token) {
    throw new Error("Not authorized, token missing")
  }

  const isFormData = options.body instanceof FormData

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || "Request failed")
  }

  return data
}

export async function fetchAdminProducts() {
  const response = await adminFetch("/api/admin/products")
  return response.data || []
}

export async function fetchAdminProductById(id) {
  const response = await adminFetch(`/api/admin/products/${id}`)
  return response.data
}

export async function createAdminProduct(payload) {
  const response = await adminFetch("/api/admin/products", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return response.data
}

export async function updateAdminProduct(id, payload) {
  const response = await adminFetch(`/api/admin/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
  return response.data
}

export async function deleteAdminProduct(id) {
  return adminFetch(`/api/admin/products/${id}`, {
    method: "DELETE",
  })
}

export async function uploadAdminProductFile(productId, formData) {
  const response = await adminFetch(`/api/admin/products/${productId}/files`, {
    method: "POST",
    body: formData,
  })
  return response.data
}

export async function setAdminPrimaryProductFile(productId, fileId) {
  const response = await adminFetch(
    `/api/admin/products/${productId}/files/${fileId}/primary`,
    {
      method: "PATCH",
    }
  )
  return response.data
}

export async function deleteAdminProductFile(productId, fileId) {
  return adminFetch(`/api/admin/products/${productId}/files/${fileId}`, {
    method: "DELETE",
  })
}

export async function uploadAdminProductImage(productId, formData) {
  const response = await adminFetch(`/api/admin/products/${productId}/images`, {
    method: "POST",
    body: formData,
  })
  return response.data
}

export async function deleteAdminProductImage(productId, imageId) {
  return adminFetch(`/api/admin/products/${productId}/images/${imageId}`, {
    method: "DELETE",
  })
}