/* ════════════════════════════════════════════════════════════════════════
   ProductReviews.jsx · public review surface for the product detail page
   ────────────────────────────────────────────────────────────────────────
   Sprint-2 additions over the original component:
     · Admin replies render under each review when present.
     · "Helpful" vote button — idempotent, optimistic, login-gated.
     · Submission feedback distinguishes "live now" from "in the queue".
     · The component name and props stay the same so existing imports
       (`<ProductReviews slug={...} productTitle={...} />`) keep working.

   Keeps the original visual language: terracotta stars, violet headings.
   ════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react"
import {
  Star, CheckCircle2, MessageSquare, ThumbsUp, Trash2, Clock3, Sparkles,
} from "lucide-react"
import {
  fetchProductReviews,
  submitProductReview,
  deleteProductReview,
  markReviewHelpful,
} from "../services/reviewService"
import { getStoredUser } from "../lib/api"

import { useTranslation } from "react-i18next"
/* ─── atoms ───────────────────────────────────────────────────────────── */

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
            aria-label={interactive ? `Rate ${star} of 5` : undefined}
          >
            <Star
              style={{ width: size, height: size }}
              className={filled ? "fill-terracotta text-terracotta" : "text-charcoal-80/20"}
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
    <div className="flex items-center gap-2 text-micro">
      <span className="w-4 text-right font-semibold text-violet">{label}</span>
      <Star className="h-3 w-3 fill-terracotta text-terracotta" />
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-charcoal-80/8">
        <div className="h-full rounded-full bg-terracotta transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 text-right text-charcoal-80/65">{count}</span>
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

/* ─── helpful button — local optimistic state ─────────────────────────── */

function HelpfulButton({ review, isLoggedIn, isOwner }) {
  const [count, setCount] = useState(review.helpfulCount || 0)
  const [voted, setVoted] = useState(false)
  const [busy, setBusy] = useState(false)

  // Owners can't vote on their own review; logged-out users see a disabled
  // button and a softer label so they understand why.
  const disabled = busy || !isLoggedIn || isOwner

  async function handleClick() {
    if (disabled) return
    setBusy(true)
    // Optimistic toggle so the UI feels instant.
    const wasVoted = voted
    setVoted(!wasVoted)
    setCount((n) => n + (wasVoted ? -1 : 1))
    try {
      const result = await markReviewHelpful(review.id)
      // Server is the source of truth; reconcile if it disagreed.
      if (typeof result?.helpfulCount === "number") setCount(result.helpfulCount)
      if (typeof result?.helpful === "boolean") setVoted(result.helpful)
    } catch {
      setVoted(wasVoted)
      setCount((n) => n + (wasVoted ? 1 : -1))
    } finally { setBusy(false) }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={
        !isLoggedIn ? "Sign in to mark this helpful"
        : isOwner ? "You can't vote on your own review"
        : voted ? "You found this helpful, click to undo"
        : "Mark as helpful"
      }
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-micro font-semibold transition ${
        voted
          ? "bg-violet text-white"
          : "bg-violet-pale/60 text-violet hover:bg-violet-pale"
      } ${disabled && !voted ? "opacity-60" : ""}`}
    >
      <ThumbsUp className={`h-3 w-3 ${voted ? "fill-white" : ""}`} />
      <span>Helpful</span>
      {count > 0 && (
        <span className={`font-mono tabular-nums ${voted ? "text-white" : "text-violet"}`}>
          · {count}
        </span>
      )}
    </button>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   Page-level component
   ════════════════════════════════════════════════════════════════════════ */

export default function ProductReviews({ slug, productTitle }) {
  const { t } = useTranslation("product")
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
  const isLoggedIn = Boolean(getStoredUser())

  const loadReviews = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchProductReviews(slug)
      setReviews(data.reviews || [])
      setStats(data.stats || { averageRating: 0, totalReviews: 0, distribution: {} })
    } catch {
      // silent — keep prior state
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { loadReviews() }, [loadReviews])

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError("")
    setFormSuccess("")
    if (formRating < 1) { setFormError("Please select a rating."); return }

    try {
      setSubmitting(true)
      const result = await submitProductReview(slug, { rating: formRating, reviewText: formText.trim() })
      // Distinguish auto-approved vs queued. Backend returns a tailored
      // message string + the new review's status.
      setFormSuccess(
        result?.message
          || (result?.status === "approved"
                ? "Thanks, your review is live."
                : "Thanks, your review is in the queue and will appear once approved.")
      )
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
    } catch { /* silent */ }
  }

  const alreadyReviewed = reviews.some((r) => r.user?.id === currentUser?.id)
  const dist = stats.distribution || {}

  return (
    <div className="space-y-6">
      {/* ── Stats summary ── */}
      <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl bg-violet-ghost px-8 py-6">
          <div className="text-page font-bold leading-none text-violet">
            {stats.averageRating.toFixed(1)}
          </div>
          <StarRating rating={Math.round(stats.averageRating)} size={18} />
          <div className="mt-1 text-micro text-charcoal-80/65">
            {stats.totalReviews} {stats.totalReviews === 1 ? "review" : "reviews"}
          </div>
        </div>

        <div className="flex flex-col justify-center gap-1.5">
          {[5, 4, 3, 2, 1].map((n) => (
            <RatingBar key={n} label={n} count={dist[n] || 0} total={stats.totalReviews} />
          ))}
        </div>
      </div>

      {/* ── Submit feedback ── */}
      {formSuccess && (
        <div className="flex items-start gap-2 rounded-xl border border-mint/20 bg-mint/10 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{formSuccess}</span>
        </div>
      )}

      {/* ── Write review CTA / form ── */}
      {isLoggedIn && !alreadyReviewed && !showForm && (
        <button
          type="button"
          onClick={() => { setShowForm(true); setFormSuccess("") }}
          className="flex items-center gap-2 rounded-xl border border-violet/15 px-5 py-3 text-sm font-semibold text-violet transition hover:bg-violet-ghost"
        >
          <MessageSquare className="h-4 w-4" /> {t("reviews.writeTitle")}
        </button>
      )}

      {!isLoggedIn && (
        <div className="rounded-xl border border-charcoal-80/10 bg-violet-ghost px-5 py-4 text-sm text-charcoal-80/70">
          <a href="/login" className="font-semibold text-violet underline">{t("reviews.signIn")}</a> to leave a review.
        </div>
      )}

      {alreadyReviewed && !formSuccess && (
        <div className="rounded-xl border border-violet/10 bg-violet-ghost px-5 py-3 text-sm text-charcoal-80/70">
          <CheckCircle2 className="mr-1.5 inline h-4 w-4 text-mint-600" />
          {t("reviews.alreadyReviewed")} {productTitle ? <em>{productTitle}</em> : "this product"}.
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-violet/10 bg-white p-5 shadow-[var(--shadow-e3)]"
        >
          <div>
            <label className="mb-2 block text-sm font-semibold text-violet">{t("reviews.yourRating")}</label>
            <StarRating rating={formRating} size={28} interactive onChange={setFormRating} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-charcoal-80">Review (optional)</label>
            <textarea
              rows={4}
              value={formText}
              onChange={(e) => setFormText(e.target.value)}
              placeholder={t("reviews.placeholder")}
              className="w-full rounded-xl border border-charcoal-80/12 bg-mist px-4 py-3 text-sm outline-none focus:border-violet/30"
              maxLength={5000}
            />
          </div>

          {formError && (
            <div className="rounded-xl border border-rose/20 bg-rose/10 px-4 py-2.5 text-sm text-rose-700">
              {formError}
            </div>
          )}

          <p className="text-micro text-charcoal-80/65">
            {t("reviews.moderationNote")}
          </p>

          <div className="flex gap-3">
            <button
              type="submit" disabled={submitting}
              className="rounded-xl bg-violet px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-deep disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit Review"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setFormError("") }}
              className="rounded-xl border border-charcoal-80/15 px-5 py-3 text-sm font-medium text-charcoal-80 transition hover:bg-mist"
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
            <div key={i} className="h-24 animate-pulse rounded-xl bg-violet-pale/50" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-charcoal-80/15 bg-mist px-6 py-8 text-center text-sm text-charcoal-80/65">
          {t("reviews.noneYet")}
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => {
            const isOwner = currentUser?.id === review.user?.id
            const canDelete = currentUser && (isOwner || currentUser.role === "admin")
            return (
              <article
                key={review.id}
                className="rounded-xl border border-charcoal-80/8 bg-white p-5 shadow-[var(--shadow-e2)]"
              >
                <header className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet/10 text-xs font-bold text-violet">
                      {getInitials(review.user?.fullName)}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-violet">
                          {review.user?.fullName || "Anonymous"}
                        </span>
                        {review.isVerifiedPurchase && (
                          <span className="flex items-center gap-1 rounded-full bg-mint-600/10 px-2 py-0.5 text-micro font-bold text-mint-600">
                            <CheckCircle2 className="h-3 w-3" /> {t("reviews.verifiedPurchase")}
                          </span>
                        )}
                        {review.featured && (
                          <span className="flex items-center gap-1 rounded-full bg-violet px-2 py-0.5 text-micro font-bold uppercase tracking-wide text-white">
                            <Sparkles className="h-3 w-3" /> Featured
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <StarRating rating={review.rating} size={13} />
                        <span className="text-micro text-charcoal-80/40">
                          {timeAgo(review.createdAt)}
                          {review.editedAt && " · edited"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleDelete(review.id)}
                      className="rounded-lg p-1.5 text-charcoal-80/30 transition hover:bg-rose/10 hover:text-red-500"
                      title={t("reviews.deleteTitle")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </header>

                {review.reviewText && (
                  <p className="mt-3 text-meta leading-6 text-charcoal-80/75">{review.reviewText}</p>
                )}

                {/* Owner's "Pending" badge — only visible to the author so the
                    public can't see the queue length, but the reviewer knows
                    why their review isn't yet visible to others. */}
                {isOwner && review.status && review.status !== "approved" && (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber/10 px-3 py-1 text-micro font-semibold text-amber-700">
                    <Clock3 className="h-3 w-3" /> {t("reviews.awaitingModeration")}
                  </div>
                )}

                {/* Engagement row */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <HelpfulButton review={review} isLoggedIn={isLoggedIn} isOwner={isOwner} />
                </div>

                {/* Admin reply */}
                {review.adminReply && (
                  <div className="mt-4 rounded-xl border-l-4 border-violet bg-violet-pale/40 p-4">
                    <div className="flex items-center gap-2 text-micro font-bold uppercase tracking-wide text-violet">
                      <MessageSquare className="h-3 w-3" />
                      {t("reviews.replyFrom")} {review.adminReplyBy?.fullName || "the team"}
                      {review.adminReplyAt && (
                        <span className="font-normal text-charcoal-80/65 normal-case tracking-normal">
                          · {timeAgo(review.adminReplyAt)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-meta leading-6 text-charcoal-80/85">
                      {review.adminReply}
                    </p>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
