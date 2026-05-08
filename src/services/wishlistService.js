const prisma = require("../lib/prisma")

/**
 * Wishlist service (B08)
 *
 * One `Wishlist` row per user, created lazily on first add. Items reference
 * `Product` — deletes cascade when the user or product is removed. The API
 * exposes the wishlist as a flat array of items (each one enriched with a
 * minimal product snapshot) so the frontend doesn't need to navigate through
 * the parent wishlist wrapper.
 *
 * BUG FIX (V2): The previous version selected `displayOrder` on
 * `ProductImage`, but the column in `prisma/schema.prisma` is named
 * `sortOrder`. Prisma rejected the query and the raw error (with ANSI
 * escape codes) leaked to the frontend. This file now uses `sortOrder`
 * everywhere and is the single source of truth for the ProductImage select.
 *
 * Exports:
 *   listItems(userId)                → Promise<Array<WishlistItem>>
 *   addItem(userId, productId)       → Promise<WishlistItem>
 *   removeItem(userId, itemId)       → Promise<{ id, removed: true }>
 *   getItemById(userId, itemId)      → Promise<WishlistItem>   (move-to-cart)
 */

/* ────────────────────────────────────────────────────────────────────────
 * Image select shape — must match the canonical ProductImage columns:
 *   id, productId, url, altText, imageRole, isPrimary, sortOrder, createdAt
 * Order: primary first, then by sortOrder ascending.
 * ──────────────────────────────────────────────────────────────────────── */
const PRODUCT_IMAGE_SELECT = {
  id: true,
  url: true,
  altText: true,
  imageRole: true,
  isPrimary: true,
  sortOrder: true,
}

const PRODUCT_IMAGE_ORDER_BY = [{ isPrimary: "desc" }, { sortOrder: "asc" }]

const PRODUCT_SNAPSHOT = {
  id: true,
  slug: true,
  title: true,
  shortDescription: true,
  price: true,
  currency: true,
  isActive: true,
  isFeatured: true,
  isNew: true,
  createdAt: true,
  images: {
    select: PRODUCT_IMAGE_SELECT,
    orderBy: PRODUCT_IMAGE_ORDER_BY,
    take: 6,
  },
}

async function ensureWishlist(userId) {
  const existing = await prisma.wishlist.findUnique({ where: { userId } })
  if (existing) return existing
  return prisma.wishlist.create({ data: { userId } })
}

async function listItems(userId) {
  const wishlist = await prisma.wishlist.findUnique({
    where: { userId },
    include: {
      items: {
        orderBy: { addedAt: "desc" },
        include: { product: { select: PRODUCT_SNAPSHOT } },
      },
    },
  })
  if (!wishlist) return []
  // Cascade deletion is enforced by Prisma; defensive filter kept for
  // belt-and-braces against orphaned items. Inactive products are still
  // returned so the user can see what they had saved (the UI disables
  // "move to cart" for them).
  return wishlist.items
}

async function addItem(userId, productId) {
  if (!productId) throw validationError("`productId` is required")

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, isActive: true, status: true },
  })
  if (!product) throw validationError("Product not found", 404)

  const wishlist = await ensureWishlist(userId)

  // Rely on @@unique([wishlistId, productId]) — catch the duplicate error
  try {
    const item = await prisma.wishlistItem.create({
      data: { wishlistId: wishlist.id, productId },
      include: { product: { select: PRODUCT_SNAPSHOT } },
    })
    return item
  } catch (err) {
    if (err?.code === "P2002") {
      // Already wishlisted — return the existing item so the frontend can
      // treat it as success.
      const existing = await prisma.wishlistItem.findFirst({
        where: { wishlistId: wishlist.id, productId },
        include: { product: { select: PRODUCT_SNAPSHOT } },
      })
      return existing
    }
    throw err
  }
}

async function removeItem(userId, itemId) {
  // Look up the item via the user's wishlist to enforce ownership.
  const item = await prisma.wishlistItem.findFirst({
    where: { id: itemId, wishlist: { userId } },
  })
  if (!item) return null

  await prisma.wishlistItem.delete({ where: { id: item.id } })
  return { id: item.id, removed: true }
}

async function getItemById(userId, itemId) {
  return prisma.wishlistItem.findFirst({
    where: { id: itemId, wishlist: { userId } },
    include: { product: { select: PRODUCT_SNAPSHOT } },
  })
}

function validationError(message, statusCode = 400) {
  const err = new Error(message)
  err.code = "VALIDATION_ERROR"
  err.statusCode = statusCode
  return err
}

module.exports = {
  listItems,
  addItem,
  removeItem,
  getItemById,
}
