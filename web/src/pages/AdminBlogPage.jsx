/* ════════════════════════════════════════════════════════════════════════
   AdminBlogPage.jsx · /admin/blog
   ────────────────────────────────────────────────────────────────────────
   Lists every blog post with full visibility (drafts + published +
   archived). Admins can search, filter by status, edit, delete, and
   bounce to the form for new posts. The form lives at
   /admin/blog/new and /admin/blog/:id/edit (AdminBlogFormPage).
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  Plus, Search, Edit2, Trash2, X, Globe, RefreshCw, AlertCircle,
  FileText, CheckCircle2, Archive, Star,
} from "lucide-react"
import { authFetch as apiRequest } from "../lib/api"
import { useToast } from "../context/ToastContext"

const STATUS_PILLS = {
  draft: { label: "Draft", bg: "bg-amber/10", text: "text-amber-700", ring: "ring-amber/20" },
  published: { label: "Published", bg: "bg-mint/10", text: "text-emerald-800", ring: "ring-mint/20" },
  archived: { label: "Archived", bg: "bg-charcoal-80/[0.06]", text: "text-charcoal-80/65", ring: "ring-charcoal-80/15" },
}

function StatusPill({ status }) {
  const s = STATUS_PILLS[status] || STATUS_PILLS.draft
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.14em] ring-1 ${s.bg} ${s.text} ${s.ring}`}>
      {s.label}
    </span>
  )
}

function formatDate(iso) {
  if (!iso) return "-"
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

export default function AdminBlogPage() {
  const toast = useToast()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("") // "" · draft · published · archived
  const [pendingDelete, setPendingDelete] = useState(null)

  async function load() {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (status) params.set("status", status)
      if (search) params.set("q", search)
      const res = await apiRequest(`/api/v1/admin/blog/posts?${params.toString()}`)
      setPosts(res.posts || [])
    } catch (err) {
      setError(err?.message || "Failed to load posts.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status])

  async function confirmDelete() {
    if (!pendingDelete) return
    try {
      await apiRequest(`/api/v1/admin/blog/posts/${pendingDelete.id}`, { method: "DELETE" })
      toast?.success?.("Post deleted")
      setPendingDelete(null)
      load()
    } catch (err) {
      toast?.error?.(err?.message || "Delete failed")
    }
  }

  const counts = useMemo(() => ({
    total: posts.length,
    published: posts.filter((p) => p.status === "published").length,
    drafts: posts.filter((p) => p.status === "draft").length,
    archived: posts.filter((p) => p.status === "archived").length,
  }), [posts])

  return (
    <div className="flex flex-col gap-6">
      {/* Metric strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={FileText} label="Total" value={counts.total} accent="violet" />
        <Metric icon={CheckCircle2} label="Published" value={counts.published} accent="emerald" />
        <Metric icon={Edit2} label="Drafts" value={counts.drafts} accent="amber" />
        <Metric icon={Archive} label="Archived" value={counts.archived} accent="charcoal" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <form
            onSubmit={(e) => { e.preventDefault(); load() }}
            className="relative w-full sm:max-w-xs"
          >
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-80/40" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title or slug…"
              className="w-full rounded-lg border border-charcoal-80/15 bg-white py-2 pl-9 pr-9 text-[13px] outline-none transition focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15"
            />
            {search ? (
              <button
                type="button"
                onClick={() => { setSearch(""); load() }}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-charcoal-80/45 hover:bg-charcoal-80/[0.06]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </form>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter by status"
            className="rounded-lg border border-charcoal-80/15 bg-white px-3 py-2 text-[13px] outline-none transition focus:border-violet/40 focus:ring-[3px] focus:ring-violet/15"
          >
            <option value="">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
            <option value="archived">Archived</option>
          </select>

          <button
            type="button"
            onClick={load}
            aria-label="Reload"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-charcoal-80/15 bg-white text-charcoal-80/65 hover:border-violet/40 hover:text-violet"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <Link
          to="/admin/blog/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-3.5 py-2 text-[13px] font-semibold text-white shadow-[0_8px_22px_-8px_rgba(93,63,211,0.50)] transition hover:bg-violet-deep"
        >
          <Plus className="h-4 w-4" /> New post
        </Link>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-charcoal-80/10 bg-white">
        <table className="min-w-full divide-y divide-charcoal-80/10 text-left text-[13px]">
          <thead className="bg-charcoal-80/[0.03] text-[11px] font-bold uppercase tracking-[0.14em] text-charcoal-80/55">
            <tr>
              <th scope="col" className="px-4 py-3">Title</th>
              <th scope="col" className="hidden px-4 py-3 sm:table-cell">Category</th>
              <th scope="col" className="hidden px-4 py-3 lg:table-cell">Status</th>
              <th scope="col" className="hidden px-4 py-3 lg:table-cell">Updated</th>
              <th scope="col" className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-80/[0.06]">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-charcoal-80/55">Loading posts…</td></tr>
            ) : error ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-rose-700">{error}</td></tr>
            ) : posts.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-charcoal-80/55">
                No posts match. <Link to="/admin/blog/new" className="font-semibold text-violet hover:underline">Create one</Link>.
              </td></tr>
            ) : posts.map((p) => (
              <tr key={p.id} className="transition hover:bg-violet-pale/30">
                <td className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    {p.featured ? <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Featured" /> : null}
                    <div>
                      <div className="font-semibold text-violet">{p.title}</div>
                      <div className="font-mono text-[11px] text-charcoal-80/45">/{p.slug}</div>
                    </div>
                  </div>
                </td>
                <td className="hidden px-4 py-3 text-charcoal-80/70 sm:table-cell">
                  {p.category || "-"}
                </td>
                <td className="hidden px-4 py-3 lg:table-cell"><StatusPill status={p.status} /></td>
                <td className="hidden px-4 py-3 text-charcoal-80/55 lg:table-cell">{formatDate(p.updatedAt)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    {p.status === "published" ? (
                      <a
                        href={`/blog/${p.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="View public"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-charcoal-80/55 transition hover:bg-violet-pale hover:text-violet"
                      >
                        <Globe className="h-4 w-4" />
                      </a>
                    ) : null}
                    <Link
                      to={`/admin/blog/${p.id}/edit`}
                      aria-label="Edit post"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-charcoal-80/55 transition hover:bg-violet-pale hover:text-violet"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(p)}
                      aria-label="Delete post"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-charcoal-80/55 transition hover:bg-rose/10 hover:text-rose-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation modal */}
      {pendingDelete ? (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose/10 text-rose-700">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h2 className="text-[16px] font-bold text-charcoal-80">Delete this post?</h2>
                <p className="mt-1 text-[13px] text-charcoal-80/65">
                  <strong className="text-charcoal-80">{pendingDelete.title}</strong> will be permanently
                  removed. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="rounded-lg border border-charcoal-80/15 bg-white px-4 py-2 text-[13px] font-semibold text-charcoal-80 hover:bg-charcoal-80/[0.04]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Metric({ icon: Icon, label, value, accent }) {
  const ringMap = {
    violet: "bg-violet-pale text-violet",
    emerald: "bg-mint/10 text-emerald-700",
    amber: "bg-amber/10 text-amber-700",
    charcoal: "bg-charcoal-80/[0.06] text-charcoal-80/70",
  }
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-charcoal-80/10 bg-white p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${ringMap[accent] || ringMap.violet}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-charcoal-80/55">{label}</div>
        <div className="text-[20px] font-extrabold tabular-nums text-charcoal-80">{value}</div>
      </div>
    </div>
  )
}
