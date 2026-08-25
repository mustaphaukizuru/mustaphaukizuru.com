import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { m, AnimatePresence } from "framer-motion"
import {
  Plus, Search, Edit2, Trash2, Star, StarOff, Eye, AlertCircle,
  Filter, Grid3x3, X, Globe, RefreshCw,
} from "lucide-react"
import {
  adminListPortfolio,
  adminDeletePortfolio,
  adminUpdatePortfolio,
} from "../services/portfolioService"
import { MetricCard } from "../components/ui/index"
import StatusPill from "../components/admin/StatusPill"
import { useToast } from "../context/ToastContext"

/* ──────────────────────────────────────────────────────────────────────────
 *  AdminPortfolioPage · Batch 6B-4
 *
 *  Refactored to use shared StatusPill + MetricCard primitives, but
 *  preserves the visual card-grid pattern. Portfolio is visual content
 *  (case studies with cover images) — a flat data table would lose the
 *  visual richness that helps admins recognize their work at a glance.
 *
 *  What changed:
 *    - Bespoke status-color map replaced with shared <StatusPill /> on
 *      cards (published → mint, draft → amber, archived → gray)
 *    - Bespoke "Featured" tag replaced with v3-token version
 *    - Added 3-card metric strip (Total / Published / Featured)
 *    - Toolbar gets refresh button matching DataTable's pattern
 *    - Delete confirmation modal: role="dialog", aria-modal, ESC dismiss
 *    - Search clears with X button (matches DataTable convention)
 *    - All ARIA labels added on icon-only buttons
 *    - Mojibake "-" replaced with proper en-dash
 *
 *  Preserved verbatim:
 *    - adminListPortfolio / adminUpdatePortfolio / adminDeletePortfolio
 *      API contracts
 *    - Card grid layout (3 columns on desktop)
 *    - Toggle-featured + delete (archive) flows
 *    - "Edit" → /admin/portfolio/:id/edit link
 *    - "View public page" → /projects/:slug link in new tab
 *  ──────────────────────────────────────────────────────────────────── */

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
}

export default function AdminPortfolioPage() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [busyId, setBusyId] = useState(null)

  async function load() {
    setLoading(true); setError("")
    try {
      const result = await adminListPortfolio({
        status: statusFilter || undefined,
        page: 1,
        limit: 100,
      })
      setItems(result.items)
    } catch (err) {
      setError(err?.message || "Could not load portfolio")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load()   }, [statusFilter])

  const visible = useMemo(() => items.filter((it) => {
    if (!query.trim()) return true
    const q = query.trim().toLowerCase()
    return (
      it.title.toLowerCase().includes(q) ||
      it.slug.toLowerCase().includes(q) ||
      it.category?.toLowerCase().includes(q)
    )
  }), [items, query])

  const metrics = useMemo(() => ({
    total: items.length,
    published: items.filter((i) => i.status === "published").length,
    featured: items.filter((i) => i.isFeatured).length,
  }), [items])

  async function handleToggleFeatured(item) {
    setBusyId(item.id)
    try {
      await adminUpdatePortfolio(item.id, { isFeatured: !item.isFeatured })
      toast.showSuccess(item.isFeatured ? "Removed from featured" : "Marked as featured")
      try { await load() } catch (re) { console.warn("[Portfolio] reload failed:", re) }
    } catch (err) {
      console.error("[Portfolio] toggle-featured failed:", err)
      toast.showError(err?.message || "Failed to update", "Could not toggle featured")
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return
    setBusyId(confirmDelete.id)
    try {
      await adminDeletePortfolio(confirmDelete.id)
      toast.showSuccess(`Archived "${confirmDelete.title}"`)
      setConfirmDelete(null)
      try { await load() } catch (re) { console.warn("[Portfolio] reload failed:", re) }
    } catch (err) {
      console.error("[Portfolio] delete failed:", err)
      toast.showError(err?.message || "Failed to delete", "Could not delete portfolio item")
    } finally {
      setBusyId(null)
    }
  }

  // ESC dismiss on confirmation modal
  useEffect(() => {
    if (!confirmDelete) return
    function onKey(e) { if (e.key === "Escape") setConfirmDelete(null) }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [confirmDelete])

  return (
    <section className="space-y-5">
      {/* Page action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-meta text-charcoal-80/70">
          Manage your case studies, create, edit, reorder, and publish.
        </p>
        <Link
          to="/admin/portfolio/new"
          className="inline-flex items-center gap-1.5 self-start rounded-lg bg-violet px-4 py-2.5 text-micro font-semibold text-white transition hover:-translate-y-0.5 hover:bg-violet-deep hover:shadow-[0_8px_18px_rgb(var(--color-violet-rgb)/0.22)] sm:self-auto focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New project
        </Link>
      </div>

      {/* Metrics */}
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard title="Total" value={metrics.total} icon={Grid3x3} tone="purple" />
        <MetricCard title="Published" value={metrics.published} icon={Globe} tone="green" />
        <MetricCard title="Featured" value={metrics.featured} icon={Star} tone="amber" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-charcoal-80/10 bg-white p-3 shadow-[0_4px_16px_rgb(var(--color-violet-rgb)/0.04)] sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-charcoal-80/40" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, slug, or category…"
            aria-label="Search portfolio"
            className="h-9 w-full rounded-lg border border-charcoal-80/12 bg-mist pl-9 pr-7 text-micro text-violet outline-none transition focus:border-violet/40 focus:bg-white focus:ring-[3px] focus:ring-azure/20"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-charcoal-80/40 transition hover:text-violet focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-azure/40"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 rounded-lg border border-charcoal-80/12 bg-white px-2.5 py-1.5">
            <Filter className="h-3 w-3 text-charcoal-80/65" aria-hidden="true" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              className="bg-transparent text-micro font-medium text-violet outline-none"
            >
              <option value="">All statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-charcoal-80/12 bg-white text-charcoal-80/65 transition hover:border-violet/20 hover:bg-violet-pale hover:text-violet disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose/20 bg-rose/5 px-4 py-3 text-meta text-rose-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Card grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-busy="true" aria-label="Loading portfolio">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[280px] animate-pulse rounded-xl border border-charcoal-80/10 bg-white" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-charcoal-80/15 bg-white px-6 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet/15 bg-violet-pale text-violet">
            <Grid3x3 className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-card font-bold text-violet">
            {query || statusFilter ? "No matches" : "No portfolio items yet"}
          </h2>
          <p className="mt-1 max-w-sm text-meta text-charcoal-80/65">
            {query || statusFilter
              ? "Try clearing your search or filters."
              : "Create your first case study to get started."}
          </p>
          {!query && !statusFilter && (
            <Link
              to="/admin/portfolio/new"
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-violet px-4 py-2 text-micro font-semibold text-white transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              New project
            </Link>
          )}
        </div>
      ) : (
        <m.div
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {visible.map((item) => (
            <m.article
              key={item.id}
              variants={fadeUp}
              className="group overflow-hidden rounded-xl border border-charcoal-80/10 bg-white shadow-[0_4px_16px_rgb(var(--color-violet-rgb)/0.04)] transition hover:border-violet/20 hover:shadow-[0_12px_28px_rgb(var(--color-violet-rgb)/0.10)]"
            >
              {/* Cover */}
              <div className="relative aspect-[16/10] overflow-hidden bg-violet-pale">
                {item.coverImage ? (
                  <img src={item.coverImage} alt={item.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-violet/30">
                    <Grid3x3 className="h-10 w-10" aria-hidden="true" />
                  </div>
                )}
                {/* Status pill */}
                <div className="absolute left-2 top-2">
                  <StatusPill
                    status={item.status === "published" ? "active" : item.status === "draft" ? "draft" : "inactive"}
                    label={item.status}
                  />
                </div>
                {item.isFeatured && (
                  <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-inset ring-amber-300/40">
                    <Star className="h-2.5 w-2.5 fill-current" aria-hidden="true" />
                    Featured
                  </span>
                )}
              </div>

              {/* Body */}
              <div className="p-4">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-violet/70">
                  {item.category}
                  {item.year && <span className="ml-1 text-charcoal-80/40">· <span className="tabular-nums">{item.year}</span></span>}
                </div>
                <h3 className="mt-1 line-clamp-2 text-meta font-bold text-violet">{item.title}</h3>
                <p className="mt-1 line-clamp-2 text-micro text-charcoal-80/65">{item.shortDescription}</p>

                <div className="mt-3 flex items-center justify-between border-t border-charcoal-80/8 pt-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleToggleFeatured(item)}
                      disabled={busyId === item.id}
                      aria-label={item.isFeatured ? `Remove ${item.title} from featured` : `Mark ${item.title} as featured`}
                      title={item.isFeatured ? "Remove from featured" : "Mark as featured"}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-charcoal-80/65 transition hover:bg-violet-pale/60 hover:text-violet disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-azure/40"
                    >
                      {item.isFeatured ? <StarOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Star className="h-3.5 w-3.5" aria-hidden="true" />}
                    </button>
                    {item.status === "published" && (
                      <Link
                        to={`/projects/${item.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`View ${item.title} on public site`}
                        title="View public page"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-charcoal-80/65 transition hover:bg-violet-pale/60 hover:text-violet focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-azure/40"
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Link
                      to={`/admin/portfolio/${item.id}/edit`}
                      aria-label={`Edit ${item.title}`}
                      className="inline-flex items-center gap-1 rounded-md bg-violet-pale px-2.5 py-1 text-micro font-semibold text-violet transition hover:bg-violet hover:text-white focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-1"
                    >
                      <Edit2 className="h-3 w-3" aria-hidden="true" />
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(item)}
                      aria-label={`Archive ${item.title}`}
                      title="Archive"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-rose-600 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-rose-300/40"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </m.article>
          ))}
        </m.div>
      )}

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {confirmDelete && (
          <m.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => setConfirmDelete(null)}
            role="dialog"
            aria-modal="true"
            aria-label="Confirm archive"
          >
            <m.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-charcoal-80/10 bg-white p-6 shadow-[0_24px_60px_rgb(var(--color-violet-rgb)/0.18)]"
            >
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                  <AlertCircle className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-card font-bold text-violet">Archive this project?</h3>
                  <p className="mt-1 text-meta text-charcoal-80/70">
                    <strong className="text-violet">{confirmDelete.title}</strong> will be hidden from the public site and set to <strong>archived</strong>. You can restore it from the admin later.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  disabled={busyId === confirmDelete.id}
                  className="rounded-lg border border-charcoal-80/12 bg-white px-4 py-2 text-micro font-semibold text-charcoal-80/85 transition hover:border-violet/20 hover:bg-violet-pale hover:text-violet disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busyId === confirmDelete.id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-micro font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose-300/40 focus-visible:ring-offset-2"
                >
                  {busyId === confirmDelete.id ? "Archiving…" : "Archive"}
                </button>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </section>
  )
}
