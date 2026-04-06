const asyncHandler = require("../utils/asyncHandler")
const {
  getReviewsByProductId,
  getReviewStats,
  createReview,
  deleteReview,
} = require("../services/reviewService")
const { notifyReviewPosted } = require("../services/notificationService")

// GET /api/products/:slug/reviews (public)
const listProductReviews = asyncHandler(async (req, res) => {
  const prisma = require("../lib/prisma")
  const product = await prisma.product.findFirst({
    where: { slug: req.params.slug, isActive: true },
    select: { id: true, title: true },
  })

  if (!product) {
    return res.status(404).json({ success: false, message: "Product not found" })
  }

  const [reviews, stats] = await Promise.all([
    getReviewsByProductId(product.id),
    getReviewStats(product.id),
  ])

  return res.status(200).json({
    success: true,
    data: {
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        reviewText: r.reviewText,
        isVerifiedPurchase: r.isVerifiedPurchase,
        createdAt: r.createdAt,
        user: {
          id: r.user?.id,
          fullName: r.user?.fullName || "Anonymous",
        },
      })),
      stats,
    },
  })
})

// POST /api/products/:slug/reviews (authenticated)
const addProductReview = asyncHandler(async (req, res) => {
  const prisma = require("../lib/prisma")
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, message: "Authentication required" })

  const product = await prisma.product.findFirst({
    where: { slug: req.params.slug, isActive: true },
    select: { id: true, title: true },
  })

  if (!product) {
    return res.status(404).json({ success: false, message: "Product not found" })
  }

  const { rating, reviewText } = req.body

  const review = await createReview(product.id, userId, { rating, reviewText })

  // In-app notification (non-blocking)
  notifyReviewPosted(userId, product.title).catch(() => {})

  return res.status(201).json({
    success: true,
    message: "Review submitted successfully",
    data: {
      id: review.id,
      rating: review.rating,
      reviewText: review.reviewText,
      isVerifiedPurchase: review.isVerifiedPurchase,
      createdAt: review.createdAt,
      user: {
        id: review.user?.id,
        fullName: review.user?.fullName || "Anonymous",
      },
    },
  })
})

// DELETE /api/products/:slug/reviews/:reviewId (authenticated)
const removeProductReview = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  const isAdmin = req.user?.role === "admin"
  if (!userId) return res.status(401).json({ success: false, message: "Authentication required" })

  await deleteReview(req.params.reviewId, userId, isAdmin)

  return res.status(200).json({ success: true, message: "Review deleted" })
})

module.exports = {
  listProductReviews,
  addProductReview,
  removeProductReview,
}
