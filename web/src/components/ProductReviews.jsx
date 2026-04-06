import { useCallback, useEffect, useState } from "react"
import { Star, CheckCircle2, MessageSquare, ThumbsUp, Trash2 } from "lucide-react"
import { fetchProductReviews, submitProductReview, deleteProductReview } from "../services/reviewService"
import { getStoredUser, getStoredToken } from "../lib/api"

function StarRating({ rating, size = 16, interactive = false, onChange }) {
  const [hover, setHover] = useState(0)

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = interactive ? star <= (hover || rating) : star <= rating
        return (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            className={`transition ${interactive ? "cursor-pointer hover:scale-110" : "cursor-default"}`}
            onMouseEnter={() => interactive && setHover(star)}
            onMouseLeave={() => interactive && setHover(0)}
            onClick={() => interactive && onChange?.(star)}
          >
            <Star
              style={{ width: size, height: size }}
              className={filled ? "fill-[#FFCCAF] text-[#FFCCAF]" : "text-[#634F40]/20"}
            />
          </button>
        )
      })}
    </div>
  )
}

function RatingBar({ label, count, total }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <span className="w-4 text-right font-semibold text-[#420060]">{label}</span>
      <Star className="h-3 w-3 fill-[#FFCCAF] text-[#FFCCAF]" />
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#634F40]/8">
        <div
          className="h-full rounded-full bg-[#FFCCAF] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-6 text-right text-[#634F40]/50">{count}</span>
    </div>
  )
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

function getInitials(name = "") {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?"
}

export default function ProductReviews({ slug, productTitle }) {
  const [reviews, setReviews] = useState([])
  const [stats, setStats] = useState({ averageRating: 0, totalReviews: 0, distribution: {} })
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [formRating, setFormRating] = useState(0)
  const [formText, setFormText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState("")
  const [formSuccess, setFormSuccess] = useState("")

  const currentUser = getStoredUser()
  const isLoggedIn = Boolean(getStoredToken())

  const loadReviews = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchProductReviews(slug)
      setReviews(data.reviews || [])
      setStats(data.stats || { averageRating: 0, totalReviews: 0, distribution: {} })
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    loadReviews()
  }, [loadReviews])

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError("")
    setFormSuccess("")

    if (formRating < 1) {
      setFormError("Please select a rating.")
      return
    }

    try {
      setSubmitting(true)
      await submitProductReview(slug, { rating: formRating, reviewText: formText.trim() })
      setFormSuccess("Your review has been posted!")
      setFormRating(0)
      setFormText("")
      setShowForm(false)
      await loadReviews()
    } catch (err) {
      setFormError(err.message || "Failed to submit review.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(reviewId) {
    if (!window.confirm("Delete this review?")) return
    try {
      await deleteProductReview(slug, reviewId)
      await loadReviews()
    } catch {
      // silent
    }
  }

  const alreadyReviewed = reviews.some((r) => r.user?.id === currentUser?.id)
  const dist = stats.distribution || {}

  return (
    <div className="space-y-6">
      {/* ── Stats summary ── */}
      <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl bg-[#faf7fb] px-8 py-6">
          <div className="text-[2.8rem] font-bold leading-none text-[#420060]">
            {stats.averageRating.toFixed(1)}
          </div>
          <StarRating rating={Math.round(stats.averageRating)} size={18} />
          <div className="mt-1 text-[12px] text-[#634F40]/50">
            {stats.totalReviews} {stats.totalReviews === 1 ? "review" : "reviews"}
          </div>
        </div>

        <div className="flex flex-col justify-center gap-1.5">
          {[5, 4, 3, 2, 1].map((n) => (
            <RatingBar key={n} label={n} count={dist[n] || 0} total={stats.totalReviews} />
          ))}
        </div>
      </div>

      {/* ── Write review button / form ── */}
      {formSuccess && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {formSuccess}
        </div>
      )}

      {isLoggedIn && !alreadyReviewed && !showForm && (
        <button
          type="button"
          onClick={() => { setShowForm(true); setFormSuccess("") }}
          className="flex items-center gap-2 rounded-xl border border-[#420060]/15 px-5 py-3 text-sm font-semibold text-[#420060] transition hover:bg-[#faf7fb]"
        >
          <MessageSquare className="h-4 w-4" />
          Write a Review
        </button>
      )}

      {!isLoggedIn && (
        <div className="rounded-xl border border-[#634F40]/10 bg-[#faf7fb] px-5 py-4 text-sm text-[#634F40]/70">
          <a href="/login" className="font-semibold text-[#420060] underline">Sign in</a> to leave a review.
        </div>
      )}

      {alreadyReviewed && !formSuccess && (
        <div className="rounded-xl border border-[#420060]/10 bg-[#faf7fb] px-5 py-3 text-sm text-[#634F40]/70">
          <CheckCircle2 className="mr-1.5 inline h-4 w-4 text-[#2FA36B]" />
          You have already reviewed this product.
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-[#420060]/10 bg-white p-5 shadow-[0_4px_16px_rgba(66,0,96,0.04)]">
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#420060]">Your Rating</label>
            <StarRating rating={formRating} size={28} interactive onChange={setFormRating} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[#634F40]">
              Review (optional)
            </label>
            <textarea
              rows={4}
              value={formText}
              onChange={(e) => setFormText(e.target.value)}
              placeholder="Share your experience with this product..."
              className="w-full rounded-xl border border-[#634F40]/12 bg-[#fafafa] px-4 py-3 text-sm outline-none focus:border-[#420060]/30"
              maxLength={2000}
            />
          </div>

          {formError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[#420060] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2d003f] disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit Review"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setFormError("") }}
              className="rounded-xl border border-[#634F40]/15 px-5 py-3 text-sm font-medium text-[#634F40] transition hover:bg-[#fafafa]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── Reviews list ── */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-[#ede4ef]/50" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#634F40]/15 bg-[#fafafa] px-6 py-8 text-center text-sm text-[#634F40]/50">
          No reviews yet. Be the first to review this product!
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="rounded-xl border border-[#634F40]/8 bg-white p-5 shadow-[0_2px_8px_rgba(66,0,96,0.03)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#420060]/10 text-xs font-bold text-[#420060]">
                    {getInitials(review.user?.fullName)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#420060]">
                        {review.user?.fullName || "Anonymous"}
                      </span>
                      {review.isVerifiedPurchase && (
                        <span className="flex items-center gap-1 rounded-full bg-[#2FA36B]/10 px-2 py-0.5 text-[10px] font-bold text-[#2FA36B]">
                          <CheckCircle2 className="h-3 w-3" />
                          Verified Purchase
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <StarRating rating={review.rating} size={13} />
                      <span className="text-[11px] text-[#634F40]/40">
                        {timeAgo(review.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {currentUser && (currentUser.id === review.user?.id || currentUser.role === "admin") && (
                  <button
                    type="button"
                    onClick={() => handleDelete(review.id)}
                    className="rounded-lg p-1.5 text-[#634F40]/30 transition hover:bg-red-50 hover:text-red-500"
                    title="Delete review"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {review.reviewText && (
                <p className="mt-3 text-[13px] leading-6 text-[#634F40]/75">
                  {review.reviewText}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
