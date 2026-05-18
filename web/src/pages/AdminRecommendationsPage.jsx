/* ════════════════════════════════════════════════════════════════════════
   AdminRecommendationsPage.jsx · admin CRUD for Recommendations
   ────────────────────────────────────────────────────────────────────────
   Mirror of the AdminServicePlansPage pattern: filter chips, search,
   list of cards, modal create/edit, delete confirm.

   Brand: #5D3FD3 / #1A1B23 · Framer Motion fade/stagger · Lucide icons.
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Sparkles, Plus, RefreshCw, Pencil, Trash2, Save, X, Loader2,
  AlertCircle, Search, ExternalLink, Star, Tag, BookOpen, GraduationCap,
  Layers, Users, Briefcase, FileText,
} from "lucide-react"
import { useToast } from "../context/ToastContext"
import {
  listAdminRecommendations,
  createAdminRecommendation,
  updateAdminRecommendation,
  deleteAdminRecommendation,
} from "../services/recommendationService"

/* ── Constants ────────────────────────────────────────────────────────── */

const STATUSES = ["draft", "published", "archived"]
const CATEGORIES = [
  { value: "tool", label: "Tool", Icon: Sparkles },
  { value: "book", label: "Book", Icon: BookOpen },
  { value: "course", label: "Course", Icon: GraduationCap },
  { value: "template", label: "Template", Icon: Layers },
  { value: "service", label: "Service", Icon: Briefcase },
  { value: "partner", label: "Partner", Icon: Users },
]

const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } }
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } }

const inputClass =
  "w-full rounded-xl border border-charcoal/15 bg-white px-3.5 py-2.5 text-[13px] text-violet outline-none transition focus:border-violet focus:ring-2 focus:ring-violet/10"

function statusTone(status) {
  switch (status) {
    case "published": return "bg-mint-100 text-mint-800"
    case "draft": return "bg-amber/15 text-amber-700"
    case "archived": return "bg-slate-100 text-steel"
    default: return "bg-violet-pale text-violet"
  }
}

function CategoryIcon({ category, className = "h-3.5 w-3.5" }) {
  const def = CATEGORIES.find((c) => c.value === category)
  const Icon = def?.Icon || Tag
  return <Icon className={className} />
}

/* ── Field atoms ──────────────────────────────────────────────────────── */

function Field({ label, required, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-violet">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-charcoal/55">{hint}</span>}
    </label>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   Form modal — create or edit
   ════════════════════════════════════════════════════════════════════════ */

function RecommendationModal({ open, onClose, initial, onSaved }) {
  const { showSuccess, showError } = useToast()
  const isEdit = Boolean(initial?.id)

  const [form, setForm] = useState(() => emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function emptyForm() {
    return {
      title: "", slug: "", summary: "", body: "",
      imageUrl: "", category: "tool", priority: 0, status: "draft",
      productId: "", serviceId: "", externalUrl: "",
      isAffiliate: false,
      metaTitle: "", metaDescription: "",
    }
  }

  useEffect(() => {
    if (open && initial) {
      setForm({
        title: initial.title || "",
        slug: initial.slug || "",
        summary: initial.summary || "",
        body: initial.body || "",
        imageUrl: initial.imageUrl || "",
        category: initial.category || "tool",
        priority: Number(initial.priority ?? 0),
        status: initial.status || "draft",
        productId: initial.productId || "",
        serviceId: initial.serviceId || "",
        externalUrl: initial.externalUrl || "",
        isAffiliate: Boolean(initial.isAffiliate),
        metaTitle: initial.metaTitle || "",
        metaDescription: initial.metaDescription || "",
      })
    } else if (open && !initial) {
      setForm(emptyForm())
    }
    setError("")
  }, [open, initial])

  function update(field, value) { setForm((f) => ({ ...f, [field]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    if (!form.title.trim()) { setError("Title is required."); return }
    if (!form.summary.trim()) { setError("Summary is required."); return }

    // Enforce single-link rule client-side too
    const linkCount = [form.productId, form.serviceId, form.externalUrl]
      .filter((v) => v && String(v).trim().length > 0).length
    if (linkCount > 1) {
      setError("Pick at most one of: linked product, linked service, or external URL.")
      return
    }

    setSaving(true)
    try {
      const payload = { ...form, priority: Number(form.priority) || 0 }
      const result = isEdit
        ? await updateAdminRecommendation(initial.id, payload)
        : await createAdminRecommendation(payload)
      const saved = result?.data || result
      showSuccess(isEdit ? `"${saved.title}" updated` : `"${saved.title}" created`)
      onSaved?.(saved)
      onClose()
    } catch (err) {
      setError(err?.message || "Could not save.")
      showError?.(err?.message || "Save failed", "Recommendation save")
    } finally { setSaving(false) }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed left-1/2 top-1/2 z-[121] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-charcoal/15 bg-white shadow-[0_30px_80px_rgba(93,63,211,0.25)]"
          >
            <form onSubmit={handleSubmit} className="flex max-h-[90vh] flex-col">
              <header className="flex items-start justify-between border-b border-charcoal/10 px-6 py-5">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-pale px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-violet">
                    <Sparkles className="h-3 w-3" /> {isEdit ? "Edit recommendation" : "New recommendation"}
                  </span>
                  <h2 className="mt-2 text-[20px] font-bold text-violet">
                    {isEdit ? form.title || "Untitled" : "Add a new recommendation"}
                  </h2>
                </div>
                <button type="button" onClick={onClose} aria-label="Close"
                  className="-mt-1 -mr-1 flex h-9 w-9 items-center justify-center rounded-xl text-charcoal/55 transition hover:bg-violet-ghost hover:text-violet"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              <div className="overflow-y-auto px-6 py-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Title" required>
                    <input className={inputClass} value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="e.g., Notion for solo consultants" />
                  </Field>
                  <Field label="Slug" hint="Auto-generated if left blank">
                    <input className={inputClass} value={form.slug} onChange={(e) => update("slug", e.target.value)} placeholder="notion-for-solo-consultants" />
                  </Field>

                  <Field label="Summary" required hint="One or two sentences shown on the public listing card">
                    <textarea rows={2} className={inputClass} value={form.summary} onChange={(e) => update("summary", e.target.value)} />
                  </Field>
                  <Field label="Category">
                    <select className={inputClass} value={form.category} onChange={(e) => update("category", e.target.value)}>
                      {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </Field>

                  <Field label="Body (optional, markdown)" hint="Long-form copy on the detail page">
                    <textarea rows={6} className={inputClass} value={form.body} onChange={(e) => update("body", e.target.value)} />
                  </Field>

                  <div className="space-y-4">
                    <Field label="Image URL" hint="Square or 16:9 image · CDN preferred">
                      <input className={inputClass} value={form.imageUrl} onChange={(e) => update("imageUrl", e.target.value)} placeholder="https://…/image.png" />
                    </Field>
                    <Field label="Status">
                      <select className={inputClass} value={form.status} onChange={(e) => update("status", e.target.value)}>
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </Field>
                    <Field label="Priority" hint="Higher = appears earlier on the public page">
                      <input type="number" className={inputClass} value={form.priority} onChange={(e) => update("priority", e.target.value)} />
                    </Field>
                  </div>

                  <Field label="Linked product ID" hint="Pick one: product, service, or URL">
                    <input className={inputClass} value={form.productId} onChange={(e) => update("productId", e.target.value)} placeholder="(optional)" />
                  </Field>
                  <Field label="Linked service ID" hint=" ">
                    <input className={inputClass} value={form.serviceId} onChange={(e) => update("serviceId", e.target.value)} placeholder="(optional)" />
                  </Field>
                  <Field label="External URL" hint="Affiliate or partner link">
                    <input className={inputClass} value={form.externalUrl} onChange={(e) => update("externalUrl", e.target.value)} placeholder="https://example.com" />
                  </Field>
                  <Field label="Affiliate disclosure">
                    <button type="button" onClick={() => update("isAffiliate", !form.isAffiliate)}
                      className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] font-semibold transition ${
                        form.isAffiliate ? "border-violet bg-violet-pale text-violet" : "border-charcoal/15 bg-white text-charcoal/65"
                      }`}
                    >
                      <Star className={`h-4 w-4 ${form.isAffiliate ? "fill-violet" : ""}`} />
                      {form.isAffiliate ? "Marked as affiliate" : "Not an affiliate link"}
                    </button>
                  </Field>

                  <Field label="Meta title" hint="SEO · optional">
                    <input className={inputClass} value={form.metaTitle} onChange={(e) => update("metaTitle", e.target.value)} />
                  </Field>
                  <Field label="Meta description" hint="SEO · optional">
                    <input className={inputClass} value={form.metaDescription} onChange={(e) => update("metaDescription", e.target.value)} />
                  </Field>
                </div>
              </div>

              {error && (
                <div className="mx-6 mb-4 flex items-start gap-2 rounded-xl border border-rose/20 bg-rose/5 px-3 py-2 text-[12.5px] font-semibold text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}
                </div>
              )}

              <footer className="flex items-center justify-end gap-2 border-t border-charcoal/10 bg-violet-pale/40 px-6 py-4">
                <button type="button" onClick={onClose}
                  className="rounded-xl border border-violet/20 bg-white px-4 py-2.5 text-[12.5px] font-semibold text-violet transition hover:bg-violet-pale"
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet px-5 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_8px_22px_rgba(93,63,211,0.25)] transition hover:bg-violet-deep disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                    : <><Save className="h-4 w-4" /> {isEdit ? "Save changes" : "Create"}</>}
                </button>
              </footer>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   Card row
   ════════════════════════════════════════════════════════════════════════ */

function RecommendationCard({ rec, onEdit, onDelete }) {
  const link = rec.product
    ? { label: rec.product.title, href: `/store/${rec.product.slug}` }
    : rec.service
      ? { label: rec.service.title, href: `/services/${rec.service.slug}` }
      : rec.externalUrl
        ? { label: rec.externalUrl, href: rec.externalUrl, external: true }
        : null

  return (
    <motion.article
      variants={fadeUp}
      className="flex flex-wrap items-start gap-4 rounded-2xl border border-charcoal/10 bg-white p-5 shadow-[0_4px_14px_rgba(93,63,211,0.04)]"
    >
      {/* Image */}
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-violet-pale">
        {rec.imageUrl ? (
          <img src={rec.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-violet">
            <CategoryIcon category={rec.category} className="h-7 w-7" />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[15px] font-bold text-violet">{rec.title}</h3>
          <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold capitalize ${statusTone(rec.status)}`}>
            {rec.status}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-pale px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet">
            <CategoryIcon category={rec.category} className="h-2.5 w-2.5" />
            {rec.category}
          </span>
          {rec.isAffiliate && (
            <span className="rounded-full bg-amber/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Affiliate</span>
          )}
          <span className="font-mono text-[10px] text-charcoal/55">priority {rec.priority}</span>
        </div>
        <p className="mt-1 line-clamp-2 text-[12.5px] text-charcoal/70">{rec.summary}</p>
        {link && (
          <a
            href={link.href}
            target={link.external ? "_blank" : undefined}
            rel={link.external ? "noopener noreferrer" : undefined}
            className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-violet hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> {link.label}
          </a>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onEdit(rec)} aria-label="Edit"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-violet transition hover:bg-violet-pale"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => onDelete(rec)} aria-label="Delete"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-rose-600 transition hover:bg-rose-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </motion.article>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   Page
   ════════════════════════════════════════════════════════════════════════ */

export default function AdminRecommendationsPage() {
  const { showSuccess, showError } = useToast()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [q, setQ] = useState("")
  const [editing, setEditing] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const res = await listAdminRecommendations({
        status: statusFilter, category: categoryFilter, q, limit: 100,
      })
      const arr = res?.data || res?.items || []
      setItems(Array.isArray(arr) ? arr : [])
    } catch (err) {
      setError(err?.message || "Could not load recommendations.")
      showError?.(err?.message || "Load failed", "Recommendations")
    } finally { setLoading(false) }
  }, [statusFilter, categoryFilter, q, showError])

  useEffect(() => { load() }, [load])

  function handleCreate() { setEditing(null); setModalOpen(true) }
  function handleEdit(rec) { setEditing(rec); setModalOpen(true) }

  async function handleDelete(rec) {
    if (!window.confirm(`Delete "${rec.title}" permanently?\nUse status=archived instead if you might bring it back.`)) return
    try {
      await deleteAdminRecommendation(rec.id)
      showSuccess(`"${rec.title}" deleted`)
      await load()
    } catch (err) {
      showError(err?.message || "Could not delete recommendation")
    }
  }

  const visible = useMemo(() => items, [items])

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-pale px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-violet">
            <Sparkles className="h-3 w-3" /> Recommendations
          </span>
          <h1 className="mt-2 text-[24px] font-bold text-violet sm:text-[28px]">Recommendations</h1>
          <p className="mt-1 max-w-2xl text-[13px] text-charcoal/70">
            Hand-picked tools, books, services, and partners. Published recommendations appear on the public
            <span className="mx-1 font-mono text-[12px] text-violet">/recommendations</span> page and contextually
            next to related content.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load}
            className="inline-flex items-center gap-1.5 rounded-xl border border-violet/20 bg-white px-3.5 py-2.5 text-[12.5px] font-semibold text-violet transition hover:bg-violet-pale"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button type="button" onClick={handleCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_8px_22px_rgba(93,63,211,0.25)] transition hover:bg-violet-deep"
          >
            <Plus className="h-4 w-4" /> New recommendation
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-charcoal/10 bg-white p-3 shadow-[0_2px_10px_rgba(93,63,211,0.04)]">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal/40" />
          <input
            type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, summary, slug…"
            className={`${inputClass} pl-10`}
          />
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setStatusFilter("")}
            className={`rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition ${statusFilter === "" ? "bg-violet text-white" : "bg-violet-pale text-violet hover:bg-violet-pale"}`}
          >
            All
          </button>
          {STATUSES.map((s) => (
            <button key={s} type="button" onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1.5 text-[11.5px] font-semibold capitalize transition ${statusFilter === s ? "bg-violet text-white" : "bg-violet-pale text-violet hover:bg-violet-pale"}`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setCategoryFilter("")}
            className={`rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition ${categoryFilter === "" ? "bg-charcoal text-white" : "bg-violet-ghost text-charcoal/65 hover:bg-violet-pale"}`}
          >
            All categories
          </button>
          {CATEGORIES.map((c) => (
            <button key={c.value} type="button" onClick={() => setCategoryFilter(c.value)}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11.5px] font-semibold capitalize transition ${categoryFilter === c.value ? "bg-charcoal text-white" : "bg-violet-ghost text-charcoal/65 hover:bg-violet-pale"}`}
            >
              <c.Icon className="h-3 w-3" /> {c.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose/20 bg-rose/5 px-4 py-3 text-[13px] text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-violet-ghost" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-charcoal/20 bg-white p-10 text-center">
          <Sparkles className="mx-auto h-7 w-7 text-charcoal/40" />
          <h2 className="mt-3 text-[15px] font-bold text-violet">No recommendations yet</h2>
          <p className="mt-1 text-[12.5px] text-charcoal/60">
            {items.length === 0 ? "Add your first recommendation to start building the public list." : "Try clearing the filters."}
          </p>
          {items.length === 0 && (
            <button type="button" onClick={handleCreate}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-violet px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_8px_22px_rgba(93,63,211,0.25)] transition hover:bg-violet-deep"
            >
              <Plus className="h-4 w-4" /> Add recommendation
            </button>
          )}
        </div>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-3">
          {visible.map((rec) => (
            <RecommendationCard key={rec.id} rec={rec} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
        </motion.div>
      )}

      <RecommendationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initial={editing}
        onSaved={load}
      />
    </div>
  )
}
