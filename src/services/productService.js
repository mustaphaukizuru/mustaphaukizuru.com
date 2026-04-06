const prisma = require("../lib/prisma")

function safeNum(val, fallback = 0) {
  const n = Number(val)
  return Number.isFinite(n) ? n : fallback
}

function normalizeBoolean(value) {
  return value === true || value === "true"
}

function serializeProduct(product) {
  if (!product) return null

  const images = Array.isArray(product.images)
    ? [...product.images]
        .sort((a, b) => safeNum(a.sortOrder) - safeNum(b.sortOrder))
        .map((img) => ({
          id:        img.id,
          url:       img.url || "",
          altText:   img.altText || "",
          imageRole: img.imageRole || "preview",
          isPrimary: Boolean(img.isPrimary),
          sortOrder: safeNum(img.sortOrder),
        }))
    : []

  const features = Array.isArray(product.features)
    ? product.features.map((f) => ({
        id:          f.id,
        featureText: f.featureText || f.label || f.title || "",
        sortOrder:   safeNum(f.sortOrder),
      }))
    : []

  const files = Array.isArray(product.files)
    ? product.files.map((f) => ({
        id:        f.id,
        fileName:  f.fileName || f.name || "",
        fileType:  f.fileType || "",
        fileSize:  f.fileSize != null ? safeNum(f.fileSize) : null,
        isPrimary: Boolean(f.isPrimary),
        version:   f.version || null,
      }))
    : []

  const reviews = Array.isArray(product.reviews)
    ? product.reviews.map((r) => ({
        id:                 r.id,
        rating:             r.rating,
        reviewText:         r.reviewText || "",
        isVerifiedPurchase: Boolean(r.isVerifiedPurchase),
        createdAt:          r.createdAt,
        user: {
          id:       r.user?.id,
          fullName: r.user?.fullName || "Anonymous",
        },
      }))
    : []

  const primaryFile = files.find((f) => f.isPrimary) || files[0] || null

  return {
    ...product,
    price:        safeNum(product.price),
    fileSize:     product.fileSize != null ? safeNum(product.fileSize) : null,
    currency:     product.currency || "USD",
    images,
    features,
    files,
    reviews,
    fileType:     primaryFile?.fileType || product.fileType || null,
    deliveryType: product.deliveryType || (product.productType === "service" ? "Scheduled service" : "Instant access"),
  }
}

async function getAllProducts(filters = {}) {
  const where = { isActive: true }

  const categoryFilter = typeof filters === "string" ? filters : (filters.category || "")
  if (categoryFilter) where.category = categoryFilter

  if (typeof filters === "object") {
    if (normalizeBoolean(filters.featured)) where.isFeatured = true
    if (normalizeBoolean(filters.new))      where.isNew      = true

    if (filters.search?.trim()) {
      const q = filters.search.trim()
      // MySQL: no `mode: "insensitive"` — use contains without mode
      where.OR = [
        { title:            { contains: q } },
        { description:      { contains: q } },
        { shortDescription: { contains: q } },
        { category:         { contains: q } },
      ]
    }
  }

  const products = await prisma.product.findMany({
    where,
    include: {
      images:   { orderBy: { sortOrder: "asc" }, take: 3  },  // limit images for listing
      features: { orderBy: { sortOrder: "asc" }, take: 5  },
      files:    { orderBy: { isPrimary: "desc" }, select: { id: true, fileName: true, fileType: true, fileSize: true, isPrimary: true, version: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,  // safety cap — paginate at the store level for large catalogs
  })

  return products.map(serializeProduct)
}

async function getProductBySlug(slug) {
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true },
    include: {
      images:   { orderBy: { sortOrder: "asc" }  },
      features: { orderBy: { sortOrder: "asc" }  },
      files:    { orderBy: { isPrimary: "desc" } },
      reviews:  {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          user: { select: { id: true, fullName: true } },
        },
      },
    },
  })
  return serializeProduct(product)
}

async function getCategories() {
  const rows = await prisma.product.findMany({
    where:    { isActive: true, category: { not: null } },
    select:   { category: true },
    distinct: ["category"],
    orderBy:  { category: "asc" },
  })
  return rows.map((r) => r.category).filter(Boolean)
}

module.exports = { getAllProducts, getProductBySlug, getCategories }
