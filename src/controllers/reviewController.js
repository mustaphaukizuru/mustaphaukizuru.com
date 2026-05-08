/* ════════════════════════════════════════════════════════════════════════
   reviewController.js · public review HTTP handlers
   ────────────────────────────────────────────────────────────────────────
   Endpoints:
     GET    /api/v1/products/:slug/reviews
     POST   /api/v1/products/:slug/reviews          (auth)
     DELETE /api/v1/products/:slug/reviews/:reviewId (auth — owner or admin)

     GET    /api/v1/services/:slug/reviews
     POST   /api/v1/services/:slug/reviews          (auth)
     DELETE /api/v1/services/:slug/reviews/:reviewId (auth — owner or admin)
   ════════════════════════════════════════════════════════════════════════ */

const asyncHandler = require("../utils/asyncHandler")
const prisma = require("../lib/prisma")
const {
  getReviewsByProductId,
  getReviewsByServiceId,
  getReviewStats,
  createReview,
  deleteReview,
  toggleHelpfulVote,
  getFeaturedReviews,
} = require("../services/reviewService")
const { notifyReviewPosted } = require("../services/notificationService")

/* ─── Shared shape ─────────────────────────────────────────────────────── */

function shape(r) {
  return {
    id:                 r.id,
    rating:             r.rating,
    reviewText:         r.reviewText,
    isVerifiedPurchase: r.isVerifiedPurchase,
    helpfulCount:       r.helpfulCount ?? 0,
    featured:           Boolean(r.featured),
    adminReply:         r.adminReply || null,
    adminReplyAt:       r.adminReplyAt || null,
    adminReplyBy:       r.adminReplyBy
      ? { id: r.adminReplyBy.id, fullName: r.adminReplyBy.fullName, avatarUrl: r.adminReplyBy.avatarUrl }
      : null,
    editedAt:           r.editedAt || null,
    createdAt:          r.createdAt,
    user: {
      id:        r.user?.id,
      fullName:  r.user?.fullName || "Anonymous",
      avatarUrl: r.user?.avatarUrl || null,
    },
  }
}

/* ─── Products ─────────────────────────────────────────────────────────── */

const listProductReviews = asyncHandler(async (req, res) => {
  const product = await prisma.product.findFirst({
    where:  { slug: req.params.slug, isActive: true },
    select: { id: true, title: true },
  })
  if (!product) return res.status(404).json({ success: false, message: "Product not found" })

  const [reviews, stats] = await Promise.all([
    getReviewsByProductId(product.id),
    getReviewStats({ productId: product.id }),
  ])

  return res.status(200).json({
    success: true,
    data: {
      reviews: reviews.map(shape),
      stats,
    },
  })
})

const addProductReview = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, message: "Authentication required" })

  const product = await prisma.product.findFirst({
    where:  { slug: req.params.slug, isActive: true },
    select: { id: true, title: true },
  })
  if (!product) return res.status(404).json({ success: false, message: "Product not found" })

  const { rating, reviewText } = req.body
  const review = await createReview({ productId: product.id, userId, rating, reviewText })

  notifyReviewPosted(userId, product.title).catch(() => {})

  return res.status(201).json({
    success: true,
    message: review.status === "approved"
      ? "Thanks — your review is live."
      : "Thanks — your review is in the queue and will appear once approved.",
    data:    shape(review),
  })
})

/* ─── Services ─────────────────────────────────────────────────────────── */

const listServiceReviews = asyncHandler(async (req, res) => {
  const service = await prisma.service.findFirst({
    where:  { slug: req.params.slug, status: "published" },
    select: { id: true, title: true },
  })
  if (!service) return res.status(404).json({ success: false, message: "Service not found" })

  const [reviews, stats] = await Promise.all([
    getReviewsByServiceId(service.id),
    getReviewStats({ serviceId: service.id }),
  ])

  return res.status(200).json({
    success: true,
    data: {
      reviews: reviews.map(shape),
      stats,
    },
  })
})

const addServiceReview = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, message: "Authentication required" })

  const service = await prisma.service.findFirst({
    where:  { slug: req.params.slug, status: "published" },
    select: { id: true, title: true },
  })
  if (!service) return res.status(404).json({ success: false, message: "Service not found" })

  const { rating, reviewText } = req.body
  const review = await createReview({ serviceId: service.id, userId, rating, reviewText })

  notifyReviewPosted(userId, service.title).catch(() => {})

  return res.status(201).json({
    success: true,
    message: review.status === "approved"
      ? "Thanks — your review is live."
      : "Thanks — your review is in the queue and will appear once approved.",
    data:    shape(review),
  })
})

/* ─── Delete (owner OR admin) ──────────────────────────────────────────── */

const removeReview = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, message: "Authentication required" })

  const isAdmin = req.user?.role === "admin"
  await deleteReview(req.params.reviewId, userId, isAdmin)
  return res.status(200).json({ success: true, message: "Review deleted" })
})

/* ─── Featured (Sprint 3) ──────────────────────────────────────────────── */

const listFeatured = asyncHandler(async (req, res) => {
  const limit = req.query?.limit ? Number(req.query.limit) : 6
  const reviews = await getFeaturedReviews({ limit })
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=120")
  return res.status(200).json({
    success: true,
    data:    reviews.map((r) => ({
      ...shape(r),
      subjectType: r.subjectType,
      subject: r.product
        ? { type: "product", slug: r.product.slug, title: r.product.title, imageUrl: r.product.imageUrl }
        : r.service
          ? { type: "service", slug: r.service.slug, title: r.service.title }
          : null,
    })),
  })
})

/* ─── Helpful vote ─────────────────────────────────────────────────────── */

const voteHelpful = asyncHandler(async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ success: false, message: "Authentication required" })

  const result = await toggleHelpfulVote({ reviewId: req.params.id, userId })
  return res.status(200).json({ success: true, data: result })
})

module.exports = {
  listProductReviews,
  addProductReview,
  listServiceReviews,
  addServiceReview,
  removeReview,
  voteHelpful,
  listFeatured,
}
