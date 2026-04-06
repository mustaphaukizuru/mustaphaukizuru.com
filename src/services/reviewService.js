const prisma = require("../lib/prisma")

async function getReviewsByProductId(productId) {
  return prisma.productReview.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { id: true, fullName: true },
      },
    },
    take: 50,
  })
}

async function getReviewStats(productId) {
  const reviews = await prisma.productReview.findMany({
    where: { productId },
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
    totalReviews: total,
    distribution,
  }
}

async function createReview(productId, userId, { rating, reviewText }) {
  if (!rating || rating < 1 || rating > 5) {
    throw new Error("Rating must be between 1 and 5")
  }

  // Check if user already reviewed this product
  const existing = await prisma.productReview.findFirst({
    where: { productId, userId },
  })
  if (existing) {
    throw new Error("You have already reviewed this product")
  }

  // Check if user has purchased the product (verified purchase)
  const hasPurchased = await prisma.orderItem.findFirst({
    where: {
      productId,
      order: {
        userId,
        status: "paid",
      },
    },
    select: { id: true },
  })

  const review = await prisma.productReview.create({
    data: {
      productId,
      userId,
      rating: Number(rating),
      reviewText: reviewText ? String(reviewText).trim().slice(0, 2000) : null,
      isVerifiedPurchase: Boolean(hasPurchased),
    },
    include: {
      user: { select: { id: true, fullName: true } },
    },
  })

  // Update product aggregate rating
  const stats = await getReviewStats(productId)
  await prisma.product.update({
    where: { id: productId },
    data: {
      rating: stats.averageRating,
      reviewCount: stats.totalReviews,
    },
  }).catch(() => {})

  return review
}

async function deleteReview(reviewId, userId, isAdmin = false) {
  const review = await prisma.productReview.findUnique({
    where: { id: reviewId },
  })

  if (!review) throw new Error("Review not found")
  if (!isAdmin && review.userId !== userId) throw new Error("Not authorized")

  await prisma.productReview.delete({ where: { id: reviewId } })

  // Re-calc aggregate
  const stats = await getReviewStats(review.productId)
  await prisma.product.update({
    where: { id: review.productId },
    data: {
      rating: stats.averageRating,
      reviewCount: stats.totalReviews,
    },
  }).catch(() => {})

  return true
}

module.exports = {
  getReviewsByProductId,
  getReviewStats,
  createReview,
  deleteReview,
}
