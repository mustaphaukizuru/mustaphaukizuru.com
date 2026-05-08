import { authFetch } from "../lib/api"

// ─────────────────────────────────────────────────────────────────────────────
// Admin Product Service
// Centralized admin product operations
// Uses authFetch from the shared API utility
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchAdminProducts() {
  const response = await authFetch("/api/v1/admin/products", {
    method: "GET",
  })

  return response.data || []
}

export async function fetchAdminProductById(id) {
  if (!id) {
    throw new Error("Product ID is required")
  }

  const response = await authFetch(`/api/v1/admin/products/${id}`, {
    method: "GET",
  })

  return response.data
}

export async function createAdminProduct(payload) {
  const response = await authFetch("/api/v1/admin/products", {
    method: "POST",
    body: JSON.stringify(payload),
  })

  return response.data
}

export async function updateAdminProduct(id, payload) {
  if (!id) {
    throw new Error("Product ID is required")
  }

  const response = await authFetch(`/api/v1/admin/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })

  return response.data
}

export async function deleteAdminProduct(id) {
  if (!id) {
    throw new Error("Product ID is required")
  }

  return authFetch(`/api/v1/admin/products/${id}`, {
    method: "DELETE",
  })
}

export async function uploadAdminProductFile(productId, formData) {
  if (!productId) {
    throw new Error("Product ID is required")
  }

  if (!(formData instanceof FormData)) {
    throw new Error("A valid FormData object is required")
  }

  const response = await authFetch(`/api/v1/admin/products/${productId}/files`, {
    method: "POST",
    body: formData,
  })

  return response.data
}

export async function setAdminPrimaryProductFile(productId, fileId) {
  if (!productId) {
    throw new Error("Product ID is required")
  }

  if (!fileId) {
    throw new Error("File ID is required")
  }

  const response = await authFetch(
    `/api/v1/admin/products/${productId}/files/${fileId}/primary`,
    {
      method: "PATCH",
    }
  )

  return response.data
}

export async function deleteAdminProductFile(productId, fileId) {
  if (!productId) {
    throw new Error("Product ID is required")
  }

  if (!fileId) {
    throw new Error("File ID is required")
  }

  return authFetch(`/api/v1/admin/products/${productId}/files/${fileId}`, {
    method: "DELETE",
  })
}

export async function uploadAdminProductImage(productId, formData) {
  if (!productId) {
    throw new Error("Product ID is required")
  }

  if (!(formData instanceof FormData)) {
    throw new Error("A valid FormData object is required")
  }

  const response = await authFetch(`/api/v1/admin/products/${productId}/images`, {
    method: "POST",
    body: formData,
  })

  return response.data
}

export async function deleteAdminProductImage(productId, imageId) {
  if (!productId) {
    throw new Error("Product ID is required")
  }

  if (!imageId) {
    throw new Error("Image ID is required")
  }

  return authFetch(`/api/v1/admin/products/${productId}/images/${imageId}`, {
    method: "DELETE",
  })
}