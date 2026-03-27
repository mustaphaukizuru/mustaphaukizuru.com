import { useEffect, useState } from "react"
import { FileText, Plus, Pencil, Globe, EyeOff, AlertCircle } from "lucide-react"
import { EmptyState, SectionCard, StatusBadge, SkeletonCard } from "../components/ui/index"
import { authFetch } from "../lib/api"
import { useToast } from "../context/ToastContext"

// ─────────────────────────────────────────────────────────────────────────────
// Admin CMS / Pages management
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_TYPES = ["all", "legal", "content", "landing"]

function PageRow({ page, onPublish, onEdit }) {
  const isPublished = page.status === "published"

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#634F40]/10 bg-[#fafafa] p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ede4ef] text-[#420060]">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-[#420060]">{page.title}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-[#634F40]/60">
            <span>/{page.slug}</span>
            <span>·</span>
            <span className="capitalize">{page.type || "content"}</span>
            <span>·</span>
            <span>Updated {new Date(page.updatedAt || page.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge status={page.status} />

        <button
          type="button"
          onClick={() => onPublish(page)}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-medium transition ${
            isPublished
              ? "border border-[#634F40]/15 text-[#634F40] hover:bg-[#f4eef6]"
              : "border border-[#420060]/20 bg-[#f4eef6] text-[#420060] hover:bg-[#ede4ef]"
          }`}
        >
          {isPublished ? <EyeOff className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
          {isPublished ? "Unpublish" : "Publish"}
        </button>

        <button
          type="button"
          onClick={() => onEdit(page)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#634F40]/15 px-3 py-2 text-[12px] font-medium text-[#634F40] transition hover:bg-[#f4eef6] hover:text-[#420060]"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
      </div>
    </div>
  )
}

function EditModal({ page, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: page?.title || "",
    slug: page?.slug || "",
    content: page?.content || "",
    type: page?.type || "content",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const { showSuccess, showError } = useToast()
  const isNew = !page

  async function handleSave() {
    if (!form.title.trim() || !form.slug.trim()) {
      setError("Title and slug are required.")
      return
    }
    setSaving(true)
    setError("")
    try {
      const endpoint = isNew ? "/api/admin/pages" : `/api/admin/pages/${page.id}`
      const method = isNew ? "POST" : "PATCH"
      const res = await authFetch(endpoint, {
        method,
        body: JSON.stringify(form),
      })
      showSuccess(isNew ? "Page created" : "Page updated")
      onSaved(res.data)
    } catch (err) {
      setError(err.message || "Failed to save page.")
      showError("Failed to save page")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-[620px] rounded-xl border border-[#634F40]/10 bg-white p-6 shadow-[0_30px_80px_rgba(66,0,96,0.18)]">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[20px] font-bold text-[#420060]">
            {isNew ? "Create Page" : `Edit: ${page.title}`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#634F40]/10 text-[#634F40]/60 transition hover:bg-[#f4eef6]"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-[#420060]">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full rounded-xl border border-[#634F40]/20 bg-[#fafafa] px-4 py-3 text-[13px] text-[#420060] outline-none focus:border-[#420060]/40"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-[#420060]">Slug</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="e.g. privacy-policy"
                className="w-full rounded-xl border border-[#634F40]/20 bg-[#fafafa] px-4 py-3 text-[13px] text-[#420060] outline-none focus:border-[#420060]/40"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-[#420060]">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="w-full rounded-xl border border-[#634F40]/20 bg-[#fafafa] px-4 py-3 text-[13px] text-[#420060] outline-none"
            >
              <option value="legal">Legal</option>
              <option value="content">Content</option>
              <option value="landing">Landing</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-[#420060]">Content</label>
            <textarea
              rows={10}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="Page content (HTML or Markdown supported)..."
              className="w-full resize-y rounded-xl border border-[#634F40]/20 bg-[#fafafa] px-4 py-3 font-mono text-[12px] text-[#420060] outline-none focus:border-[#420060]/40"
            />
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#420060] py-3 text-[13px] font-semibold text-white transition hover:bg-[#2d003f] disabled:opacity-60"
          >
            {saving ? "Saving..." : isNew ? "Create Page" : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#634F40]/15 px-5 py-3 text-[13px] font-medium text-[#634F40] transition hover:bg-[#f4eef6]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminPagesPage() {
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [editing, setEditing] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const { showSuccess, showError } = useToast()

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError("")
      try {
        const res = await authFetch("/api/admin/pages")
        setPages(Array.isArray(res.data) ? res.data : [])
      } catch (err) {
        setError(err.message || "Failed to load pages.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handlePublishToggle(page) {
    const newStatus = page.status === "published" ? "draft" : "published"
    try {
      await authFetch(`/api/admin/pages/${page.id}/publish`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      })
      setPages((prev) => prev.map((p) => p.id === page.id ? { ...p, status: newStatus } : p))
      showSuccess(`Page ${newStatus === "published" ? "published" : "unpublished"}`)
    } catch (err) {
      showError(err.message || "Failed to update status")
    }
  }

  function handleSaved(savedPage) {
    if (editing && editing.id) {
      setPages((prev) => prev.map((p) => p.id === savedPage.id ? savedPage : p))
    } else {
      setPages((prev) => [savedPage, ...prev])
    }
    setEditing(null)
    setShowCreate(false)
  }

  const filtered = typeFilter === "all"
    ? pages
    : pages.filter((p) => p.type === typeFilter)

  const published = pages.filter((p) => p.status === "published").length
  const drafts = pages.filter((p) => p.status === "draft").length

  if (loading) {
    return (
      <section className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
        <SkeletonCard height="h-[320px]" />
      </section>
    )
  }

  return (
    <>
      {(editing || showCreate) && (
        <EditModal
          page={editing}
          onClose={() => { setEditing(null); setShowCreate(false) }}
          onSaved={handleSaved}
        />
      )}

      <section className="space-y-5">
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Metrics */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-[#634F40]/10 bg-white p-5">
            <div className="text-[12px] font-medium text-[#634F40]/70">Total Pages</div>
            <div className="mt-2 text-[28px] font-bold text-[#420060]">{pages.length}</div>
          </div>
          <div className="rounded-xl border border-[#634F40]/10 bg-white p-5">
            <div className="text-[12px] font-medium text-[#634F40]/70">Published</div>
            <div className="mt-2 text-[28px] font-bold text-[#3b8f47]">{published}</div>
          </div>
          <div className="rounded-xl border border-[#634F40]/10 bg-white p-5">
            <div className="text-[12px] font-medium text-[#634F40]/70">Drafts</div>
            <div className="mt-2 text-[28px] font-bold text-[#b46909]">{drafts}</div>
          </div>
        </div>

        <SectionCard
          title="Content Pages"
          subtitle="Manage website pages, legal content, and CMS entries."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-xl border border-[#634F40]/15 bg-[#f7f4f8] px-3 py-2 text-[12px] text-[#420060] outline-none"
              >
                {PAGE_TYPES.map((t) => (
                  <option key={t} value={t}>{t === "all" ? "All Types" : t}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#420060] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#2d003f]"
              >
                <Plus className="h-4 w-4" />
                New Page
              </button>
            </div>
          }
        >
          {filtered.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No pages found"
              description={pages.length === 0 ? "Create your first content page." : "No pages match the selected filter."}
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((page) => (
                <PageRow
                  key={page.id}
                  page={page}
                  onPublish={handlePublishToggle}
                  onEdit={setEditing}
                />
              ))}
            </div>
          )}
        </SectionCard>
      </section>
    </>
  )
}
