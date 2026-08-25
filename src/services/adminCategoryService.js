// @ts-check
const prisma = require("../lib/prisma")

/* ────────────────────────────────────────────────────────────────────────
   slugify · safe URL-friendly slug from any string.
   Lower-case · alphanumeric + dash only · max 60 chars · trimmed.
   ──────────────────────────────────────────────────────────────────── */
function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

/* ────────────────────────────────────────────────────────────────────────
   List all categories (proper ProductCategory rows + the legacy string-
   based bucket for any products not yet linked to a category).
   ──────────────────────────────────────────────────────────────────── */
async function getAdminCategories() {
  // 1) Real categories from the ProductCategory table
  const categories = await prisma.productCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { products: true } },
    },
    take: 200,
  })

  // 2) Legacy string-based categories (Product.category) not yet linked
  const products = await prisma.product.findMany({
    where: { categoryId: null },
    select: { id: true, category: true, isActive: true },
    take:   500,
  })

  const legacyBucket = new Map()
  for (const p of products) {
    const key = p.category || "Uncategorized"
    if (!legacyBucket.has(key)) {
      legacyBucket.set(key, { name: key, totalProducts: 0, activeProducts: 0, isLegacy: true })
    }
    const item = legacyBucket.get(key)
    item.totalProducts += 1
    if (p.isActive) item.activeProducts += 1
  }

  // 3) Shape the unified response
  const real = categories.map((c) => ({
    id:             c.id,
    name:           c.name,
    slug:           c.slug,
    description:    c.description,
    icon:           c.icon,
    isActive:       c.isActive,
    sortOrder:      c.sortOrder,
    totalProducts:  c._count?.products || 0,
    activeProducts: 0, // computed below if needed
    isLegacy:       false,
  }))

  // Compute activeProducts for real categories with one extra grouped query
  if (real.length > 0) {
    const counts = await prisma.product.groupBy({
      by: ["categoryId"],
      where: { categoryId: { in: real.map((r) => r.id) }, isActive: true },
      _count: { _all: true },
    })
    const map = new Map(counts.map((c) => [c.categoryId, c._count._all]))
    real.forEach((r) => { r.activeProducts = map.get(r.id) || 0 })
  }

  return [...real, ...Array.from(legacyBucket.values())]
}

/* ────────────────────────────────────────────────────────────────────────
   CRUD on ProductCategory
   ──────────────────────────────────────────────────────────────────── */

async function createAdminCategory(data) {
  const name = String(data.name || "").trim()
  if (!name) throw new Error("Category name is required")
  const slug = data.slug ? slugify(data.slug) : slugify(name)
  return prisma.productCategory.create({
    data: {
      name,
      slug,
      description: data.description?.trim() || null,
      icon:        data.icon?.trim() || null,
      isActive:    data.isActive !== false,
      sortOrder:   Number(data.sortOrder ?? 0),
    },
  })
}

async function updateAdminCategory(id, data) {
  if (!id) throw new Error("Category id is required")
  const patch = {}
  if ("name"        in data) patch.name        = String(data.name).trim()
  if ("slug"        in data) patch.slug        = slugify(data.slug || patch.name || "")
  if ("description" in data) patch.description = data.description?.trim() || null
  if ("icon"        in data) patch.icon        = data.icon?.trim() || null
  if ("isActive"    in data) patch.isActive    = Boolean(data.isActive)
  if ("sortOrder"   in data) patch.sortOrder   = Number(data.sortOrder)
  return prisma.productCategory.update({ where: { id: String(id) }, data: patch })
}

async function deleteAdminCategory(id) {
  if (!id) throw new Error("Category id is required")
  // Detach any products from this category before deleting (don't delete products)
  await prisma.product.updateMany({
    where: { categoryId: String(id) },
    data:  { categoryId: null },
  })
  await prisma.productCategory.delete({ where: { id: String(id) } })
  return { id: String(id), deleted: true }
}

module.exports = {
  getAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
}