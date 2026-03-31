import { apiRequest } from "../lib/api"

function normalizeArray(value) {
  return Array.isArray(value) ? value : []
}

function normalizeImages(images) {
  return normalizeArray(images)
    .filter((image) => image?.url)
    .sort((a, b) => Number(a?.sortOrder ?? 0) - Number(b?.sortOrder ?? 0))
    .slice(0, 6)
    .map((image, index) => ({
      id: image.id || `${image.url}-${index}`,
      url: image.url,
      altText: image.altText || "",
      imageRole: image.imageRole || "preview",
      isPrimary: Boolean(image.isPrimary),
      sortOrder: Number(image.sortOrder ?? index),
    }))
}

function normalizeFeatures(features) {
  return normalizeArray(features)
    .map((item) => {
      if (typeof item === "string") return item.trim()

      return (
        item?.featureText ||
        item?.label ||
        item?.title ||
        item?.name ||
        ""
      ).trim()
    })
    .filter(Boolean)
}

function normalizeFiles(files) {
  return normalizeArray(files).map((file, index) => ({
    id: file.id || `file-${index}`,
    fileName: file.fileName || file.name || "",
    fileUrl: file.fileUrl || file.url || "",
    fileType: file.fileType || file.type || "",
    fileSize:
      file.fileSize !== undefined && file.fileSize !== null
        ? Number(file.fileSize)
        : null,
    isPrimary: Boolean(file.isPrimary),
  }))
}

function getPrimaryFileType(product, files) {
  if (product?.fileType) return product.fileType

  const primaryFile = files.find((file) => file?.isPrimary) || files[0]
  return primaryFile?.fileType || null
}

function getDeliveryType(product, files) {
  if (product?.deliveryType) return product.deliveryType

  if (product?.productType === "service") {
    return "Scheduled service"
  }

  if (files.length > 0) {
    return "Instant access"
  }

  return "Digital delivery"
}

function normalizeProduct(product) {
  if (!product || typeof product !== "object") return null

  const files = normalizeFiles(product.files)
  const features = normalizeFeatures(product.features)
  const images = normalizeImages(product.images)

  return {
    ...product,
    id: product.id,
    slug: product.slug || "",
    title: product.title || "Untitled Product",
    shortDescription: product.shortDescription || product.summary || "",
    description: product.description || product.fullDescription || "",
    category: product.category || "General",
    price:
      product.price !== undefined && product.price !== null
        ? Number(product.price)
        : 0,
    currency: product.currency || "USD",
    productType: product.productType || "downloadable",
    deliveryType: getDeliveryType(product, files),
    fileType: getPrimaryFileType(product, files),
    fileSize:
      product.fileSize !== undefined && product.fileSize !== null
        ? Number(product.fileSize)
        : null,
    isActive: Boolean(product.isActive ?? true),
    isFeatured: Boolean(product.isFeatured),
    isNew: Boolean(product.isNew),
    isBestSeller: Boolean(product.isBestSeller),
    createdAt: product.createdAt || null,
    updatedAt: product.updatedAt || null,
    images,
    files,
    features,
    highlights:
      normalizeArray(product.highlights).length > 0
        ? normalizeArray(product.highlights).filter(Boolean)
        : features,
  }
}

export async function fetchProducts(category = "") {
  const normalizedCategory = String(category || "").trim()
  const query = normalizedCategory
    ? `?category=${encodeURIComponent(normalizedCategory)}`
    : ""

  const response = await apiRequest(`/api/products${query}`)
  const products = Array.isArray(response?.data) ? response.data : []

  return products.map(normalizeProduct).filter(Boolean)
}

export async function fetchProductBySlug(slug) {
  if (!slug) {
    throw new Error("Product slug is required")
  }

  const response = await apiRequest(`/api/products/${slug}`)
  return normalizeProduct(response?.data)
}

export async function fetchCategories() {
  const response = await apiRequest("/api/products/categories")
  return Array.isArray(response?.data) ? response.data : []
}