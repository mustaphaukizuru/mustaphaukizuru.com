/* ════════════════════════════════════════════════════════════════════════
   reviewService.js · public review reads, writes, stats
   ────────────────────────────────────────────────────────────────────────
   Reviews are stored in the `Review` model (table `product_reviews`,
   preserved for backward-compat via @@map). A single Review row may target
   either a Product or a Service via the `subjectType` discriminator and
   nullable `productId` / `serviceId` columns.

   Public reads always filter by status="approved" so unmoderated reviews
   never leak. Writes go through the moderation pipeline before persisting,
   so a verified-purchase clean review lands as "approved" immediately
   while everything else queues as "pending" for admin moderation.
   ════════════════════════════════════════════════════════════════════════ */

const prisma = require("../lib/prisma")
const AppError = require("../utils/AppError")
const { moderateReview } = require("./reviewModerationService")

const PUBLIC_STATUS = "approved"

const userSelect = { select: { id: true, fullName: true, avatarUrl: true } }

/* ─── Reads ────────────────────────────────────────────────────────────── */

async function getReviewsByProductId(productId) {
  return prisma.review.findMany({
    where:    { productId, subjectType: "product", status: PUBLIC_STATUS },
    orderBy:  [{ featured: "desc" }, { createdAt: "desc" }],
    include:  {
      user:        userSelect,
      adminReplyBy: userSelect,
    },
    take: 50,
  })
}

async function getReviewsByServiceId(serviceId) {
  return prisma.review.findMany({
    where:    { serviceId, subjectType: "service", status: PUBLIC_STATUS },
    orderBy:  [{ featured: "desc" }, { createdAt: "desc" }],
    include:  {
      user:        userSelect,
      adminReplyBy: userSelect,
    },
    take: 50,
  })
}

async function getReviewStats({ productId, serviceId }) {
  const where = { status: PUBLIC_STATUS }
  if (productId) Object.assign(where, { productId, subjectType: "product" })
  if (serviceId) Object.assign(where, { serviceId, subjectType: "service" })

  const reviews = await prisma.review.findMany({
    where,
    select: { rating: true },
  })

  if (reviews.length === 0) {
    return { averageRating: 0, totalReviews: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } }
  }

  const total = reviews.length
  const sum = reviews.reduce((s, r) => s + r.rating, 0)
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  for (const r of reviews) {
    distribution[r.rating] = (distribution[r.rating] || 0) + 1
  }

  return {
    averageRating: Math.round((sum / total) * 10) / 10,
    totalReviews:  total,
    distribution,
  }
}

/* ─── Aggregate sync helper ────────────────────────────────────────────── */

async function refreshProductAggregate(productId) {
  if (!productId) return
  const stats = await getReviewStats({ productId })
  await prisma.product.update({
    where: { id: productId },
    data:  { rating: stats.averageRating, reviewCount: stats.totalReviews },
  }).catch(() => {})
}

/* ─── Write ────────────────────────────────────────────────────────────── */

/**
 * Create a review on either a Product or a Service. The caller passes
 * exactly one of productId / serviceId. The function:
 *   1. Rejects duplicate reviews per user-per-subject.
 *   2. Looks up the order item that produced this review (if any) for the
 *      isVerifiedPurchase + orderItemId pin.
 *   3. Runs the moderation pipeline.
 *   4. Persists with the resulting status + flaggedReason.
 *   5. Recalculates the product aggregate when status === "approved".
 */
async function createReview({ productId, serviceId, userId, rating, reviewText, projectId = null }) {
  if (!productId && !serviceId) throw new AppError("productId or serviceId is required", { statusCode: 400, code: "VALIDATION_ERROR" })
  if (productId && serviceId)   throw new AppError("Cannot review a product and service in one row", { statusCode: 400, code: "VALIDATION_ERROR" })
  if (!Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) throw new AppError("Rating must be between 1 and 5", { statusCode: 400, code: "VALIDATION_ERROR" })

  const subjectType = productId ? "product" : "service"

  // No duplicate per (subject, user)
  const existing = await prisma.review.findFirst({
    where: { userId, ...(productId ? { productId } : { serviceId }) },
    select: { id: true },
  })
  if (existing) throw new AppError("You have already reviewed this item", { statusCode: 409, code: "CONFLICT" })

  // Verified-purchase + orderItemId lookup
  const orderItemWhere = productId
    ? { productId, order: { userId, status: "paid" } }
    : { serviceId, order: { userId, status: "paid" } }
  const orderItem = await prisma.orderItem.findFirst({
    where:  orderItemWhere,
    select: { id: true },
    orderBy: { createdAt: "desc" },
  })
  const isVerifiedPurchase = Boolean(orderItem)

  // Recent submission cooldown: max 3 / 24h to throttle spam.
  const recentCount = await prisma.review.count({
    where: {
      userId,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  })
  if (recentCount >= 3) {
    throw new AppError("You've posted several reviews recently — please try again later.", { statusCode: 429, code: "RATE_LIMITED" })
  }

  // Auto-moderation. Verified-purchase clean text → approved; else pending.
  const { status, flaggedReason } = moderateReview({
    rating,
    reviewText,
    isVerifiedPurchase,
  })

  const review = await prisma.review.create({
    data: {
      subjectType,
      productId: productId || null,
      serviceId: serviceId || null,
      userId,
      orderItemId: orderItem?.id || null,
      projectId: projectId ? String(projectId) : null,
      rating: Number(rating),
      reviewText: reviewText ? String(reviewText).trim().slice(0, 5000) : null,
      isVerifiedPurchase,
      status,
      flaggedReason,
    },
    include: { user: userSelect },
  })

  if (status === "approved" && productId) {
    await refreshProductAggregate(productId)
  }

  return review
}

/* ─── Featured reviews (Sprint 3) ──────────────────────────────────────
   Subject-agnostic top-N pulled from the moderation queue. Reviews must
   be `featured: true` AND `status: "approved"` to surface — this is a
   public endpoint, so the hidden/rejected guard is non-negotiable. */

async function getFeaturedReviews({ limit = 6 } = {}) {
  const safeLimit = Math.min(24, Math.max(1, Number(limit) || 6))
  return prisma.review.findMany({
    where: { featured: true, status: PUBLIC_STATUS },
    orderBy: [{ featuredOrder: "asc" }, { createdAt: "desc" }],
    take: safeLimit,
    include: {
      user:    userSelect,
      product: {
        select: {
          id:     true,
          slug:   true,
          title:  true,
          images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
        },
      },
      service: { select: { id: true, slug: true, title: true } },
    },
  })
}

/* ─── Helpful vote (idempotent — one vote per user per review) ────────── */

/**
 * Toggle a "helpful" vote on a review. The helpful counter on Review is the
 * source of truth for display; the ReviewVote rows give us the per-user
 * uniqueness guarantee and let us flip a vote off later if needed.
 *
 * Returns the new helpful count and whether the user's vote is now on.
 */
async function toggleHelpfulVote({ reviewId, userId }) {
  if (!reviewId) throw new AppError("reviewId is required", { statusCode: 400, code: "VALIDATION_ERROR" })
  if (!userId)   throw new AppError("authentication required", { statusCode: 401, code: "AUTH_REQUIRED" })

  // Only let users vote on visible (approved) reviews — voting on hidden
  // content is meaningless and would inflate counts after restoration.
  const review = await prisma.review.findUnique({
    where:  { id: reviewId },
    select: { id: true, status: true, userId: true, helpfulCount: true },
  })
  if (!review) throw new AppError("Review not found", { statusCode: 404, code: "NOT_FOUND" })
  if (review.status !== "approved") throw new AppError("Review is not visible", { statusCode: 404, code: "NOT_FOUND" })
  if (review.userId === userId) throw new AppError("You can't mark your own review as helpful", { statusCode: 403, code: "FORBIDDEN" })

  const existing = await prisma.reviewVote.findUnique({
    where: { reviewId_userId: { reviewId, userId } },
  })

  if (existing) {
    // Toggle off — remove the vote and decrement.
    await prisma.$transaction([
      prisma.reviewVote.delete({ where: { id: existing.id } }),
      prisma.review.update({
        where: { id: reviewId },
        data:  { helpfulCount: { decrement: 1 } },
      }),
    ])
    return { helpful: false, helpfulCount: Math.max(0, review.helpfulCount - 1) }
  }

  // Toggle on — create the vote and increment.
  await prisma.$transaction([
    prisma.reviewVote.create({ data: { reviewId, userId, helpful: true } }),
    prisma.review.update({
      where: { id: reviewId },
      data:  { helpfulCount: { increment: 1 } },
    }),
  ])
  return { helpful: true, helpfulCount: review.helpfulCount + 1 }
}

/* ─── Delete (owner OR admin) ──────────────────────────────────────────── */

async function deleteReview(reviewId, userId, isAdmin = false) {
  const review = await prisma.review.findUnique({ where: { id: reviewId } })
  if (!review) throw new AppError("Review not found", { statusCode: 404, code: "NOT_FOUND" })
  if (!isAdmin && review.userId !== userId) throw new Error("Not authorized")

  await prisma.review.delete({ where: { id: reviewId } })

  // Recalc aggregate if it was a product review
  if (review.productId) await refreshProductAggregate(review.productId)
  return true
}

module.exports = {
  getReviewsByProductId,
  getReviewsByServiceId,
  getReviewStats,
  refreshProductAggregate,
  createReview,
  deleteReview,
  toggleHelpfulVote,
  getFeaturedReviews,
}
