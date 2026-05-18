import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  FileText, Plus, Pencil, Globe, EyeOff, X, AlertCircle, Filter, Trash2,
} from "lucide-react"
import { authFetch } from "../lib/api"
import { useToast } from "../context/ToastContext"
import { MetricCard, SkeletonCard } from "../components/ui/index"
import DataTable from "../components/admin/DataTable"
import StatusPill from "../components/admin/StatusPill"
import { Field, FormInput, FormSelect } from "../components/admin/Field"
import { inputClass } from "../components/admin/Field"
import useUnsavedChangesPrompt, { computeIsDirty } from "../hooks/useUnsavedChangesPrompt"

/* ──────────────────────────────────────────────────────────────────────────
 *  AdminPagesPage · Option B · CRUD complete
 *
 *  Endpoints:
 *    GET    /api/admin/pages                  list
 *    POST   /api/admin/pages                  create
 *    PATCH  /api/admin/pages/:id              update
 *    PATCH  /api/admin/pages/:id/publish      publish toggle
 *    DELETE /api/admin/pages/:id              delete
 *  ──────────────────────────────────────────────────────────────────── */

const PAGE_TYPES = ["all", "legal", "content", "landing"]

function EditModal({ page, onClose, onSaved }) {
  const initial = useMemo(() => ({
    title:    page?.title    || "",
    titleEs:  page?.titleEs  || "",                      // I18N06 · Spanish title
    slug:     page?.slug     || "",                      // shared (non-localizable)
    content:  page?.content  || "",
    contentEs: page?.contentEs || "",                    // I18N06 · Spanish body
    type:     page?.type     || "content",
  }), [page])

  const [form, setForm] = useState(initial)
  const [savedSnapshot, setSnapshot] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState({})
  // I18N06 · which locale is the admin currently viewing/editing?
  // Both locales live in `form` simultaneously — this only drives which
  // input rows display. Saving sends both locales' fields together.
  const [locale, setLocale] = useState("en")
  const { showSuccess, showError } = useToast()

  const isNew = !page
  const isDirty = useMemo(() => computeIsDirty(form, savedSnapshot), [form, savedSnapshot])
  useUnsavedChangesPrompt(isDirty && !saving)

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") handleClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, saving])

  function handleClose() {
    if (isDirty && !window.confirm("Discard unsaved changes?")) return
    onClose()
  }

  function patch(changes) {
    setForm((f) => ({ ...f, ...changes }))
    if (Object.keys(fieldErrors).length > 0) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        Object.keys(changes).forEach((k) => delete next[k])
        return next
      })
    }
  }

  function validate() {
    const errors = {}
    if (!form.title.trim()) errors.title = "Title is required"
    if (!form.slug.trim()) errors.slug = "Slug is required"
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSave(e) {
    e?.preventDefault?.()
    if (!validate()) return
    setSaving(true); setError("")
    try {
      const endpoint = isNew ? "/api/admin/pages" : `/api/admin/pages/${page.id}`
      const method = isNew ? "POST" : "PATCH"
      const res = await authFetch(endpoint, { method, body: JSON.stringify(form) })
      showSuccess(isNew ? "Page created" : "Page updated")
      setSnapshot(form)
      onSaved(res.data)
    } catch (err) {
      setError(err.message || "Failed to save page.")
      showError("Failed to save page")
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={handleClose}
      role="dialog" aria-modal="true"
      aria-label={isNew ? "Create page" : `Edit page: ${page?.title}`}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[640px] overflow-y-auto rounded-2xl border border-charcoal-80/10 bg-white p-6 shadow-[0_24px_60px_rgba(93,63,211,0.18)] max-h-[90vh]"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-card font-bold text-violet">
            {isNew ? "Create Page" : `Edit: ${page.title}`}
          </h2>
          <button type="button" onClick={handleClose} aria-label="Close dialog"
            className="rounded-lg p-1.5 text-charcoal-80/55 transition hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose/20 bg-rose/5 px-3 py-2 text-meta text-rose-700" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

        {/* I18N06 · EN/ES locale tabs · only the localizable fields swap. */}
        <div role="tablist" aria-label="Edit locale" className="mb-4 inline-flex items-center gap-0.5 rounded-full border border-charcoal-80/15 bg-white p-0.5">
          {[{ value: "en", label: "EN" }, { value: "es", label: "ES" }].map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={locale === opt.value}
              disabled={saving}
              onClick={() => setLocale(opt.value)}
              className={`rounded-full px-3 py-1 text-[12px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 disabled:cursor-not-allowed disabled:opacity-50 ${
                locale === opt.value
                  ? "bg-violet text-white shadow-[0_2px_6px_rgba(93,63,211,0.18)]"
                  : "text-charcoal-80/70 hover:bg-violet-pale hover:text-violet"
              }`}
            >{opt.label}</button>
          ))}
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormInput
              label={locale === "es" ? "Título (Español)" : "Title"}
              required={locale === "en"}
              value={locale === "es" ? form.titleEs : form.title}
              onChange={(e) => patch(locale === "es" ? { titleEs: e.target.value } : { title: e.target.value })}
              error={locale === "es" ? undefined : fieldErrors.title}
              placeholder={locale === "es" ? "Título en español" : "Page title"}
            />
            <FormInput label="Slug" required value={form.slug}
              onChange={(e) => patch({ slug: e.target.value })}
              placeholder="e.g. privacy-policy" error={fieldErrors.slug} />
          </div>

          <FormSelect label="Type" value={form.type}
            onChange={(e) => patch({ type: e.target.value })}
            options={[
              { value: "legal", label: "Legal" },
              { value: "content", label: "Content" },
              { value: "landing", label: "Landing" },
            ]} />

          <Field
            label={locale === "es" ? "Contenido (Español)" : "Content"}
            hint={locale === "es"
              ? "HTML o Markdown · si está vacío, la versión en inglés se mostrará."
              : "HTML or Markdown supported."}
          >
            {(id) => (
              <textarea
                id={id}
                rows={10}
                value={locale === "es" ? form.contentEs : form.content}
                onChange={(e) => patch(locale === "es" ? { contentEs: e.target.value } : { content: e.target.value })}
                placeholder={locale === "es"
                  ? "Contenido de la página en español (HTML o Markdown)…"
                  : "Page content (HTML or Markdown supported)..."}
                className={inputClass({ className: "resize-y font-mono text-micro" })}
              />
            )}
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={handleClose}
              className="rounded-lg border border-charcoal-80/12 bg-white px-4 py-2 text-micro font-semibold text-charcoal-80/85 transition hover:border-violet/20 hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2">
              Cancel
            </button>
            <button type="submit" disabled={saving} aria-busy={saving ? "true" : "false"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-4 py-2 text-micro font-semibold text-white transition hover:bg-violet-deep disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2">
              {saving ? "Saving…" : isNew ? "Create Page" : "Save Changes"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
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
      setLoading(true); setError("")
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

  async function reload() {
    try {
      const res = await authFetch("/api/admin/pages")
      setPages(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      setError(err.message || "Failed to load pages.")
    }
  }

  async function handlePublishToggle(page) {
    const newStatus = page.status === "published" ? "draft" : "published"
    try {
      await authFetch(`/api/admin/pages/${page.id}/publish`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      })
      if (import.meta.env.DEV) console.info("[Pages] publish toggled", page.id, "->", newStatus)
      setPages((prev) => prev.map((p) => p.id === page.id ? { ...p, status: newStatus } : p))
      showSuccess(`Page ${newStatus === "published" ? "published" : "unpublished"}`)
    } catch (err) {
      console.error("[Pages] publish toggle failed:", err)
      showError(err.message || "Failed to update status")
    }
  }

  async function handleDelete(page) {
    if (!page?.id) return
    const ok = window.confirm(
      `Delete "${page.title}"?\n\nThis removes the page permanently. Visitors will see a 404.`
    )
    if (!ok) return
    try {
      await authFetch(`/api/admin/pages/${page.id}`, { method: "DELETE" })
      if (import.meta.env.DEV) console.info("[Pages] deleted", page.id)
      setPages((prev) => prev.filter((p) => p.id !== page.id))
      showSuccess(`Page "${page.title}" deleted`)
    } catch (err) {
      console.error("[Pages] delete failed:", err)
      showError(err.message || "Failed to delete page", "Could not delete")
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

  const filtered = useMemo(
    () => typeFilter === "all" ? pages : pages.filter((p) => p.type === typeFilter),
    [pages, typeFilter]
  )

  const published = useMemo(() => pages.filter((p) => p.status === "published").length, [pages])
  const drafts = useMemo(() => pages.filter((p) => p.status === "draft").length, [pages])

  const columns = useMemo(() => [
    {
      key: "title", label: "Page", sortable: true, searchable: true, width: "1.6fr",
      getValue: (row) => row.title || "",
      render: (row) => (
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-violet-pale text-violet">
            <FileText className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-meta font-semibold text-violet">{row.title}</div>
            <div className="mt-0.5 truncate font-mono text-[11px] text-charcoal-80/55">/{row.slug}</div>
          </div>
        </div>
      ),
    },
    {
      key: "type", label: "Type", sortable: true, searchable: true, width: "0.7fr",
      getValue: (row) => row.type || "content",
      render: (row) => (
        <span className="text-meta capitalize text-charcoal-80/85">{row.type || "content"}</span>
      ),
    },
    {
      key: "status", label: "Status", sortable: true, width: "0.7fr",
      getValue: (row) => row.status || "draft",
      render: (row) => <StatusPill status={row.status === "published" ? "active" : row.status} label={row.status} />,
    },
    {
      key: "updatedAt", label: "Updated", sortable: true, width: "0.9fr", align: "right",
      getValue: (row) => row.updatedAt || row.createdAt || "",
      render: (row) => (
        <span className="font-mono text-micro tabular-nums text-charcoal-80/65">
          {new Date(row.updatedAt || row.createdAt).toLocaleDateString(undefined, {
            year: "numeric", month: "short", day: "numeric",
          })}
        </span>
      ),
    },
    {
      key: "actions", label: "", width: "1.4fr", align: "right",
      render: (row) => {
        const isPublished = row.status === "published"
        return (
          <div className="flex items-center justify-end gap-1.5">
            <button type="button"
              onClick={(e) => { e.stopPropagation(); handlePublishToggle(row) }}
              aria-label={isPublished ? `Unpublish ${row.title}` : `Publish ${row.title}`}
              title={isPublished ? "Unpublish" : "Publish"}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-micro font-semibold transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2 ${
                isPublished
                  ? "border border-charcoal-80/12 bg-white text-charcoal-80/85 hover:border-violet/20 hover:bg-violet-pale hover:text-violet"
                  : "border border-violet/20 bg-violet-pale text-violet hover:bg-violet hover:text-white"
              }`}>
              {isPublished ? <EyeOff className="h-3 w-3" aria-hidden="true" /> : <Globe className="h-3 w-3" aria-hidden="true" />}
              {isPublished ? "Unpublish" : "Publish"}
            </button>
            <button type="button"
              onClick={(e) => { e.stopPropagation(); setEditing(row) }}
              aria-label={`Edit ${row.title}`} title="Edit"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-charcoal-80/12 bg-white text-charcoal-80/70 transition hover:border-violet/20 hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2">
              <Pencil className="h-3 w-3" aria-hidden="true" />
            </button>
            <button type="button"
              onClick={(e) => { e.stopPropagation(); handleDelete(row) }}
              aria-label={`Delete ${row.title}`} title="Delete"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose/20 bg-rose/5 text-rose-600 transition hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose-300/40 focus-visible:ring-offset-2">
              <Trash2 className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        )
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [])

  const toolbar = (
    <label className="flex items-center gap-1.5 rounded-lg border border-charcoal-80/12 bg-white px-2.5 py-1.5">
      <Filter className="h-3 w-3 text-charcoal-80/45" aria-hidden="true" />
      <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
        aria-label="Filter by type"
        className="bg-transparent text-micro font-medium text-violet outline-none">
        {PAGE_TYPES.map((t) => (
          <option key={t} value={t}>{t === "all" ? "All types" : t}</option>
        ))}
      </select>
    </label>
  )

  if (loading && pages.length === 0) {
    return (
      <section className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
        <SkeletonCard height="h-[400px]" />
      </section>
    )
  }

  return (
    <>
      <AnimatePresence>
        {(editing || showCreate) && (
          <EditModal page={editing}
            onClose={() => { setEditing(null); setShowCreate(false) }}
            onSaved={handleSaved} />
        )}
      </AnimatePresence>

      <section className="space-y-5">
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-rose/20 bg-rose/5 px-4 py-3 text-meta text-rose-700" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard title="Total Pages" value={pages.length} icon={FileText} tone="purple" />
          <MetricCard title="Published" value={published} icon={Globe} tone="green" />
          <MetricCard title="Drafts" value={drafts} icon={EyeOff} tone="amber" />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-meta text-charcoal-80/70">
            Manage website pages, legal content, and CMS entries.
          </p>
          <button type="button" onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-4 py-2.5 text-micro font-semibold text-white transition hover:-translate-y-0.5 hover:bg-violet-deep hover:shadow-[0_8px_18px_rgba(93,63,211,0.22)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Page
          </button>
        </div>

        <DataTable
          columns={columns} rows={filtered} rowKey={(row) => row.id} loading={loading}
          onRefresh={reload} initialSort={{ key: "updatedAt", dir: "desc" }}
          searchPlaceholder="Search title, slug, type…"
          toolbar={toolbar}
          emptyState={{
            icon: FileText,
            title: pages.length === 0 ? "No pages yet" : "No matches",
            description: pages.length === 0
              ? "Create your first content page to get started."
              : "No pages match the selected filter.",
            action: pages.length === 0 ? (
              <button type="button" onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-4 py-2 text-micro font-semibold text-white transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40">
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                New Page
              </button>
            ) : undefined,
          }} />
      </section>
    </>
  )
}
