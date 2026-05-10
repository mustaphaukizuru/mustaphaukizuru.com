/* ════════════════════════════════════════════════════════════════════════
   AdminReviewsPage.jsx · review moderation queue
   ────────────────────────────────────────────────────────────────────────
   UX shape:
     · Top: filter chips (Pending / Flagged / Approved / Hidden / Rejected)
            with live counts pulled from /admin/reviews/stats.
     · Centre: review feed cards. Click a card → slide-in detail panel.
     · Detail panel: full body, reviewer + verified-purchase badge,
                     subject (product/service), reply composer, action row.

   Patterns:
     · Optimistic UI on Approve / Hide / Reject — the card disappears from
       the current filter immediately; rollback + toast on failure.
     · Bulk select: shift-click range, click-to-toggle. Bulk action bar
       appears when ≥ 1 selected.
     · Keyboard shortcuts: J/K to navigate, A approve, H hide.
     · Empty state nudges admin toward something to do.

   Brand tokens: #5D3FD3 / #1A1B23 throughout. Framer Motion fade/stagger.
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Star, RefreshCw, CheckCircle2, EyeOff, X, Trash2, MessageSquare,
  AlertTriangle, ShieldCheck, Search, ExternalLink, Loader2,
  Send, Flag, Briefcase, Package, User as UserIcon, Sparkles,
} from "lucide-react"
import { useToast } from "../context/ToastContext"
import {
  fetchAdminReviewStats,
  fetchAdminReviews,
  updateAdminReview,
  bulkAdminReviewAction,
  deleteAdminReview,
} from "../services/adminReviewService"

/* ─── Small UI atoms ──────────────────────────────────────────────────── */

const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } }
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } }

const STATUSES = [
  { key: "pending", label: "Pending", Icon: AlertTriangle, tone: "bg-[#fff3e2] text-[#b46909]" },
  { key: "flagged", label: "Flagged", Icon: Flag, tone: "bg-[#fee2e2] text-[#b91c1c]" },
  { key: "approved", label: "Approved", Icon: CheckCircle2, tone: "bg-[#e5f4e8] text-[#3b8f47]" },
  { key: "hidden", label: "Hidden", Icon: EyeOff, tone: "bg-[#f2f2f2] text-[#666]" },
  { key: "rejected", label: "Rejected", Icon: X, tone: "bg-[#fee2e2] text-[#7f1d1d]" },
]

function timeAgo(iso) {
  if (!iso) return ""
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return "just now"
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

function StarRow({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-3.5 w-3.5 ${s <= rating ? "fill-terracotta text-terracotta" : "text-charcoal/20"}`}
        />
      ))}
    </div>
  )
}

function StatusPill({ status }) {
  const def = STATUSES.find((s) => s.key === status)
  if (!def) return null
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${def.tone}`}>
      <def.Icon className="h-2.5 w-2.5" />
      {def.label}
    </span>
  )
}

/* ─── Filter chip row ──────────────────────────────────────────────────── */

function FilterChips({ active, onSelect, stats }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {STATUSES.map((s) => {
        const count = stats?.[s.key] ?? 0
        const isActive = active === s.key
        return (
          <button
            key={s.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(s.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 ${
              isActive
                ? "bg-violet text-white shadow-[0_8px_22px_rgba(93,63,211,0.20)]"
                : "bg-violet-pale text-violet hover:bg-[#DCD4F4]"
            }`}
          >
            <s.Icon className="h-3.5 w-3.5" />
            {s.label}
            <span className={`min-w-[20px] rounded-full px-1.5 py-0.5 text-center font-mono text-[10px] tabular-nums ${
              isActive ? "bg-white/20 text-white" : "bg-white text-violet"
            }`}>
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ─── Review card ─────────────────────────────────────────────────────── */

function ReviewCard({ review, selected, onSelect, onOpen, onQuickAction }) {
  const subject = review.product || review.service
  const SubjectIcon = review.subjectType === "service" ? Briefcase : Package

  return (
    <motion.article
      variants={fadeUp}
      className={`group relative flex items-start gap-3 rounded-2xl border bg-white p-4 transition hover:border-violet/30 hover:shadow-[0_8px_22px_rgba(93,63,211,0.06)] ${
        selected ? "border-violet shadow-[0_8px_22px_rgba(93,63,211,0.10)]" : "border-charcoal/12"
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => onSelect(review.id, e.shiftKey)}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Select review ${review.id}`}
        className="mt-1 h-4 w-4 shrink-0 rounded border-charcoal/30 accent-violet"
      />

      <button
        type="button"
        onClick={() => onOpen(review)}
        className="flex-1 min-w-0 text-left"
      >
        <div className="flex flex-wrap items-center gap-2">
          <StarRow rating={review.rating} />
          <span className="text-[13px] font-bold text-violet">{review.rating}.0</span>
          <StatusPill status={review.status} />
          {review.isVerifiedPurchase && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#e5f4e8] px-2 py-0.5 text-[10px] font-semibold text-[#3b8f47]">
              <ShieldCheck className="h-2.5 w-2.5" /> Verified
            </span>
          )}
          {review.featured && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              <Sparkles className="h-2.5 w-2.5" /> Featured
            </span>
          )}
          {review.flaggedReason && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
              <Flag className="h-2.5 w-2.5" /> {review.flaggedReason}
            </span>
          )}
        </div>

        <p className="mt-2 line-clamp-3 text-[13px] leading-snug text-charcoal/85">
          {review.reviewText || <span className="italic text-charcoal/55">, no body, stars only,</span>}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-charcoal/60">
          <span className="inline-flex items-center gap-1">
            <UserIcon className="h-3 w-3" />
            <span className="font-semibold text-violet">{review.user?.fullName || "Anonymous"}</span>
            {review.user?.email && <span className="text-charcoal/45">· {review.user.email}</span>}
          </span>
          <span className="text-charcoal/30">•</span>
          {subject && (
            <>
              <span className="inline-flex items-center gap-1">
                <SubjectIcon className="h-3 w-3" />
                <span>{subject.title}</span>
              </span>
              <span className="text-charcoal/30">•</span>
            </>
          )}
          <span>{timeAgo(review.createdAt)}</span>
          {review.adminReply && (
            <>
              <span className="text-charcoal/30">•</span>
              <span className="inline-flex items-center gap-1 text-violet">
                <MessageSquare className="h-3 w-3" /> Reply sent
              </span>
            </>
          )}
        </div>
      </button>

      <div className="flex shrink-0 flex-col gap-1.5 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
        {review.status !== "approved" && (
          <button type="button" onClick={() => onQuickAction(review, "approve")} aria-label="Approve"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e5f4e8] text-[#3b8f47] transition hover:bg-[#d4ebd9]"
          >
            <CheckCircle2 className="h-4 w-4" />
          </button>
        )}
        {review.status !== "hidden" && (
          <button type="button" onClick={() => onQuickAction(review, "hide")} aria-label="Hide"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-ghost text-violet transition hover:bg-violet-pale"
          >
            <EyeOff className="h-4 w-4" />
          </button>
        )}
        <button type="button" onClick={() => onQuickAction(review, "reject")} aria-label="Reject"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 transition hover:bg-rose-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.article>
  )
}

/* ─── Slide-in detail panel ────────────────────────────────────────────── */

function DetailPanel({ review, onClose, onUpdated }) {
  const { showSuccess, showError } = useToast()
  const [reply, setReply] = useState("")
  const [busy, setBusy] = useState(false)
  const [featured, setFeatured] = useState(false)

  useEffect(() => {
    if (review) {
      setReply(review.adminReply || "")
      setFeatured(Boolean(review.featured))
    }
  }, [review?.id])

  if (!review) return null

  async function setStatus(status) {
    setBusy(true)
    try {
      const res = await updateAdminReview(review.id, { status })
      onUpdated?.(res?.data || res)
      showSuccess(`Marked as ${status}`)
    } catch (e) { showError(e?.message || "Could not update review") }
    finally { setBusy(false) }
  }

  async function saveReply() {
    setBusy(true)
    try {
      const res = await updateAdminReview(review.id, { adminReply: reply.trim() })
      onUpdated?.(res?.data || res)
      showSuccess(reply.trim() ? "Reply posted" : "Reply removed")
    } catch (e) { showError(e?.message || "Could not save reply") }
    finally { setBusy(false) }
  }

  async function toggleFeatured() {
    setBusy(true)
    try {
      const next = !featured
      const res = await updateAdminReview(review.id, { featured: next })
      setFeatured(next)
      onUpdated?.(res?.data || res)
      showSuccess(next ? "Pinned as Featured" : "Unpinned")
    } catch (e) { showError(e?.message || "Could not update featured flag") }
    finally { setBusy(false) }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this review permanently? This cannot be undone.")) return
    setBusy(true)
    try {
      await deleteAdminReview(review.id)
      showSuccess("Review deleted")
      onUpdated?.({ id: review.id, deleted: true })
      onClose()
    } catch (e) { showError(e?.message || "Could not delete review") }
    finally { setBusy(false) }
  }

  const subject = review.product || review.service

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[110] bg-black/40"
        aria-hidden="true"
      />
      <motion.aside
        key="panel"
        role="dialog"
        aria-modal="true"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="fixed right-0 top-0 z-[111] flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-charcoal/12 bg-white shadow-[-30px_0_80px_rgba(93,63,211,0.15)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-charcoal/10 bg-[#faf7fb] px-6 py-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StarRow rating={review.rating} />
              <span className="text-[13px] font-bold text-violet">{review.rating}.0</span>
              <StatusPill status={review.status} />
              {review.isVerifiedPurchase && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#e5f4e8] px-2 py-0.5 text-[10px] font-semibold text-[#3b8f47]">
                  <ShieldCheck className="h-2.5 w-2.5" /> Verified
                </span>
              )}
            </div>
            <h2 className="mt-2 text-[16px] font-bold text-violet">
              Review by {review.user?.fullName || "Anonymous"}
            </h2>
            <p className="mt-0.5 text-[12px] text-charcoal/65">
              {timeAgo(review.createdAt)} · {new Date(review.createdAt).toLocaleString()}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="-mt-1 -mr-1 flex h-9 w-9 items-center justify-center rounded-xl text-charcoal/55 transition hover:bg-white hover:text-violet"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {subject && (
            <section className="mb-5 rounded-xl border border-charcoal/10 bg-mist p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-charcoal/55">
                {review.subjectType === "service" ? "Service" : "Product"}
              </div>
              <a
                href={review.subjectType === "service"
                  ? `/services/${subject.slug}`
                  : `/store/${subject.slug}`}
                target="_blank" rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 text-[14px] font-bold text-violet hover:underline"
              >
                {subject.title}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              {review.orderItem && (
                <div className="mt-1 font-mono text-[10.5px] text-charcoal/55">
                  Order line: {String(review.orderItem.id).slice(0, 12)}…
                </div>
              )}
            </section>
          )}

          <section className="mb-5">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-charcoal/55">Reviewer</div>
            <div className="flex items-center gap-3 rounded-xl border border-charcoal/10 bg-white p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-pale text-violet">
                <UserIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-bold text-violet">
                  {review.user?.fullName || "Anonymous"}
                </div>
                <div className="truncate text-[11.5px] text-charcoal/65">{review.user?.email || "-"}</div>
              </div>
            </div>
          </section>

          <section className="mb-5">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-charcoal/55">Review body</div>
            <div className="whitespace-pre-wrap rounded-xl border border-charcoal/10 bg-white p-4 text-[13.5px] leading-relaxed text-charcoal/85">
              {review.reviewText || <span className="italic text-charcoal/45">No text, stars only.</span>}
            </div>
            {review.flaggedReason && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700">
                <Flag className="h-3 w-3" /> Flagged: {review.flaggedReason}
              </div>
            )}
          </section>

          <section className="mb-5">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-charcoal/55">
              Public reply
              <span className="ml-2 text-charcoal/40">{reply.length}/2000</span>
            </div>
            <textarea
              rows={4}
              maxLength={2000}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Thank the reviewer, address concerns, or share next steps. Visible publicly under the review."
              className="w-full rounded-xl border border-charcoal/15 bg-white px-3.5 py-2.5 text-[13px] text-violet outline-none transition focus:border-violet focus:ring-2 focus:ring-violet/10"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" onClick={saveReply} disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet px-4 py-2 text-[12px] font-semibold text-white shadow-[0_8px_22px_rgba(93,63,211,0.20)] transition hover:bg-violet-deep disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {review.adminReply ? "Update reply" : "Post reply"}
              </button>
              {review.adminReply && (
                <button type="button" onClick={() => setReply("")}
                  className="rounded-xl border border-violet/20 bg-white px-3 py-2 text-[12px] font-semibold text-violet transition hover:bg-violet-pale"
                >
                  Clear draft
                </button>
              )}
            </div>
          </section>
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-charcoal/10 bg-[#faf7fb] px-6 py-4">
          <div className="flex flex-wrap gap-1.5">
            {review.status !== "approved" && (
              <button type="button" onClick={() => setStatus("approved")} disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#e5f4e8] px-3.5 py-2 text-[12px] font-semibold text-[#3b8f47] transition hover:bg-[#d4ebd9] disabled:opacity-60"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Approve
              </button>
            )}
            {review.status !== "hidden" && (
              <button type="button" onClick={() => setStatus("hidden")} disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-ghost px-3.5 py-2 text-[12px] font-semibold text-violet transition hover:bg-violet-pale disabled:opacity-60"
              >
                <EyeOff className="h-3.5 w-3.5" /> Hide
              </button>
            )}
            {review.status !== "rejected" && (
              <button type="button" onClick={() => setStatus("rejected")} disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 px-3.5 py-2 text-[12px] font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
              >
                <X className="h-3.5 w-3.5" /> Reject
              </button>
            )}
            <button type="button" onClick={toggleFeatured} disabled={busy}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-semibold transition disabled:opacity-60 ${
                featured ? "bg-violet text-white hover:bg-violet-deep" : "bg-violet-pale text-violet hover:bg-[#DCD4F4]"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" /> {featured ? "Featured" : "Feature"}
            </button>
          </div>
          <button type="button" onClick={handleDelete} disabled={busy} aria-label="Delete review"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </footer>
      </motion.aside>
    </AnimatePresence>
  )
}

/* ─── Bulk-action bar ─────────────────────────────────────────────────── */

function BulkBar({ count, onAction, onClear, busy }) {
  if (count === 0) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
      className="sticky bottom-4 z-20 mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet/15 bg-white p-3 shadow-[0_12px_36px_rgba(93,63,211,0.15)]"
    >
      <span className="text-[12.5px] font-semibold text-violet">
        {count} selected
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => onAction("approve")} disabled={busy} className="inline-flex items-center gap-1 rounded-xl bg-[#e5f4e8] px-3 py-1.5 text-[12px] font-semibold text-[#3b8f47] hover:bg-[#d4ebd9] disabled:opacity-60">
          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
        </button>
        <button onClick={() => onAction("hide")} disabled={busy} className="inline-flex items-center gap-1 rounded-xl bg-violet-ghost px-3 py-1.5 text-[12px] font-semibold text-violet hover:bg-violet-pale disabled:opacity-60">
          <EyeOff className="h-3.5 w-3.5" /> Hide
        </button>
        <button onClick={() => onAction("reject")} disabled={busy} className="inline-flex items-center gap-1 rounded-xl bg-rose-50 px-3 py-1.5 text-[12px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60">
          <X className="h-3.5 w-3.5" /> Reject
        </button>
        <button onClick={onClear} className="rounded-xl border border-violet/20 bg-white px-3 py-1.5 text-[12px] font-semibold text-violet hover:bg-violet-pale">
          Clear
        </button>
      </div>
    </motion.div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   Page
   ════════════════════════════════════════════════════════════════════════ */
export default function AdminReviewsPage() {
  const { showSuccess, showError } = useToast()

  const [stats, setStats] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [activeStatus, setActive] = useState("pending")
  const [q, setQ] = useState("")
  const [selected, setSelected] = useState(new Set())
  const [open, setOpen] = useState(null)
  const [busy, setBusy] = useState(false)

  const lastSelectedRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const [statRes, listRes] = await Promise.all([
        fetchAdminReviewStats(),
        fetchAdminReviews({ status: activeStatus, q, limit: 100 }),
      ])
      setStats(statRes?.data || statRes)
      const data = listRes?.data || listRes?.items || []
      setItems(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e?.message || "Could not load reviews")
      showError?.(e?.message || "Could not load reviews", "Load failed")
    } finally {
      setLoading(false)
    }
  }, [activeStatus, q, showError])

  useEffect(() => { load() }, [load])

  function toggleOne(id, isShift) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (isShift && lastSelectedRef.current) {
        const last = lastSelectedRef.current
        const ids = items.map((r) => r.id)
        const a = ids.indexOf(last)
        const b = ids.indexOf(id)
        if (a >= 0 && b >= 0) {
          const [from, to] = [Math.min(a, b), Math.max(a, b)]
          for (let i = from; i <= to; i += 1) next.add(ids[i])
        }
      } else {
        if (next.has(id)) next.delete(id); else next.add(id)
      }
      lastSelectedRef.current = id
      return next
    })
  }
  function clearSelection() { setSelected(new Set()); lastSelectedRef.current = null }

  async function handleQuickAction(review, action) {
    setBusy(true)
    const prev = items
    setItems((cur) => cur.filter((r) => r.id !== review.id))
    try {
      await updateAdminReview(review.id, {
        status: action === "approve" ? "approved" : action === "hide" ? "hidden" : "rejected",
      })
      showSuccess(`Review ${action}d`)
      fetchAdminReviewStats().then((s) => setStats(s?.data || s)).catch(() => {})
    } catch (e) {
      setItems(prev)
      showError(e?.message || `Could not ${action} review`)
    } finally { setBusy(false) }
  }

  async function handleBulk(action) {
    if (selected.size === 0) return
    setBusy(true)
    const ids = Array.from(selected)
    const prev = items
    setItems((cur) => cur.filter((r) => !selected.has(r.id)))
    try {
      await bulkAdminReviewAction(ids, action)
      showSuccess(`${ids.length} review(s) ${action}d`)
      clearSelection()
      fetchAdminReviewStats().then((s) => setStats(s?.data || s)).catch(() => {})
    } catch (e) {
      setItems(prev)
      showError(e?.message || `Bulk ${action} failed`)
    } finally { setBusy(false) }
  }

  function handleUpdated(updated) {
    if (updated?.deleted) {
      setItems((cur) => cur.filter((r) => r.id !== updated.id))
      setOpen(null)
    } else if (updated?.id) {
      setItems((cur) => cur.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)))
      if (updated.status && updated.status !== activeStatus) {
        setItems((cur) => cur.filter((r) => r.id !== updated.id))
        setOpen(null)
      }
    }
    fetchAdminReviewStats().then((s) => setStats(s?.data || s)).catch(() => {})
  }

  useEffect(() => {
    function onKey(e) {
      if (e.target?.tagName === "INPUT" || e.target?.tagName === "TEXTAREA") return
      if (!items.length) return
      const idx = open ? items.findIndex((r) => r.id === open.id) : -1
      if (e.key === "j") setOpen(items[Math.min(items.length - 1, Math.max(0, idx + 1))] || items[0])
      if (e.key === "k") setOpen(items[Math.max(0, idx - 1)] || items[0])
      if (e.key === "a" && open) handleQuickAction(open, "approve")
      if (e.key === "h" && open) handleQuickAction(open, "hide")
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [items, open]) // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => items, [items])

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-pale px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-violet">
            <Star className="h-3 w-3" /> Moderation queue
          </span>
          <h1 className="mt-2 text-[24px] font-bold text-violet sm:text-[28px]">Customer reviews</h1>
          <p className="mt-1 max-w-2xl text-[13px] text-charcoal/70">
            Approve, hide, reject, reply to, or feature reviews on your products and services.
            Verified-purchase clean reviews are auto-approved; everything else lands here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load}
            className="inline-flex items-center gap-1.5 rounded-xl border border-violet/20 bg-white px-3.5 py-2.5 text-[12.5px] font-semibold text-violet transition hover:bg-violet-pale"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </header>

      {stats && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-charcoal/10 bg-white p-3 shadow-[0_2px_10px_rgba(93,63,211,0.04)]">
          <FilterChips active={activeStatus} onSelect={(s) => { clearSelection(); setActive(s) }} stats={stats} />
          <div className="ml-auto flex items-center gap-2 text-[12px] text-charcoal/65">
            <Star className="h-3.5 w-3.5 fill-terracotta text-terracotta" />
            <span><strong className="text-violet">{stats.avgRating}</strong> avg of {stats.approved} approved</span>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal/40" />
        <input
          type="search" value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by review text, reviewer name, or email…"
          className="w-full rounded-2xl border border-charcoal/12 bg-white py-3 pl-10 pr-4 text-[13px] text-violet outline-none transition focus:border-violet focus:ring-2 focus:ring-violet/10"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-violet-ghost" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-charcoal/20 bg-white p-10 text-center">
          <CheckCircle2 className="mx-auto h-7 w-7 text-[#3b8f47]" />
          <h2 className="mt-3 text-[15px] font-bold text-violet">All clear</h2>
          <p className="mt-1 text-[12.5px] text-charcoal/60">
            Nothing in <strong>{activeStatus}</strong> right now.
          </p>
        </div>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-3">
          {visible.map((r) => (
            <ReviewCard
              key={r.id}
              review={r}
              selected={selected.has(r.id)}
              onSelect={toggleOne}
              onOpen={setOpen}
              onQuickAction={handleQuickAction}
            />
          ))}
        </motion.div>
      )}

      <AnimatePresence>
        {selected.size > 0 && (
          <BulkBar count={selected.size} onAction={handleBulk} onClear={clearSelection} busy={busy} />
        )}
      </AnimatePresence>

      <DetailPanel
        review={open}
        onClose={() => setOpen(null)}
        onUpdated={handleUpdated}
      />

      <p className="pt-2 text-center text-[10.5px] text-charcoal/50">
        Pro tips: shift-click checkboxes to range-select · J / K navigate · A approve · H hide
      </p>
    </div>
  )
}
