import { useEffect, useMemo, useState } from "react"
import {
  BookOpen, Cpu, FlaskConical, Wrench, Briefcase, Sparkles,
  Package, TrendingUp, AlertCircle, Plus, Pencil, Trash2, X, Save, Loader2,
} from "lucide-react"
import {
  fetchAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
} from "../services/adminCategoryService"
import { useToast } from "../context/ToastContext"
import { MetricCard, SkeletonCard } from "../components/ui/index"

/* ──────────────────────────────────────────────────────────────────────────
 *  AdminCategoriesPage · v2 · full CRUD on ProductCategory
 *  ──────────────────────────────────────────────────────────────────── */

// Brand v3 §05 — every category tint maps to a sanctioned semantic
// tier: Templates = info (azure), Digital & IT = warning (amber),
// CS = success (mint), STEM = warm accent (amber-300 retains pop),
// Digital Business = action (azure). Replaced ad-hoc #eef3fb / #f6efe3
// / #2f5ea8 with brand-aligned alternatives.
const VISUAL_STYLES = {
  "Templates": { icon: BookOpen, tint: "bg-azure-pale text-azure", border: "border-azure/20" },
  "Digital & IT Toolkits": { icon: Cpu, tint: "bg-amber/12 text-amber-700", border: "border-amber/20" },
  "Computer Science Resources": { icon: FlaskConical, tint: "bg-mint/15 text-mint", border: "border-mint/20" },
  "STEM & Robotics Kits": { icon: Wrench, tint: "bg-amber/10 text-amber-700", border: "border-amber-300/30" },
  "Digital Business Resources": { icon: Briefcase, tint: "bg-azure/10 text-azure", border: "border-azure/20" },
}
const DEFAULT_STYLE = { icon: Sparkles, tint: "bg-violet-pale text-violet", border: "border-violet/15" }

function styleFor(name) {
  return VISUAL_STYLES[name] || DEFAULT_STYLE
}

export default function AdminCategoriesPage() {
  const { showSuccess, showError } = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState(null)

  async function load() {
    setLoading(true); setError("")
    try {
      const result = await fetchAdminCategories()
      const arr = Array.isArray(result) ? result : []
      if (import.meta.env.DEV) console.info("[Categories] loaded", arr.length, "rows", arr)
      setItems(arr)
    } catch (err) {
      console.error("[Categories] load failed:", err)
      const msg = err.message || "Failed to load categories."
      setError(msg)
      showError(msg, "Could not load categories")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load()   }, [])

  async function onSave(form) {
    try {
      const isEdit = Boolean(form.id)
      const saved = isEdit
        ? await updateAdminCategory(form.id, form)
        : await createAdminCategory(form)
      if (import.meta.env.DEV) console.info("[Categories] saved", saved)
      showSuccess(isEdit ? `Category "${form.name}" updated` : `Category "${form.name}" created`)
      setEditing(null)
      try { await load() } catch (re) { console.warn("[Categories] reload after save failed:", re) }
    } catch (err) {
      console.error("[Categories] save failed:", err)
      showError(err.message || "Save failed", "Could not save category")
      throw err
    }
  }

  async function onDelete(row) {
    if (!row.id || row.isLegacy) return
    if (!window.confirm(
      `Delete category "${row.name}"?\n\n${row.totalProducts > 0
        ? `${row.totalProducts} product${row.totalProducts === 1 ? "" : "s"} will be moved to "Uncategorized". They will NOT be deleted.`
        : "No products are assigned to this category."}`
    )) return
    try {
      await deleteAdminCategory(row.id)
      showSuccess(`Category "${row.name}" deleted`)
      try { await load() } catch (re) { console.warn("[Categories] reload after delete failed:", re) }
    } catch (err) {
      console.error("[Categories] delete failed:", err)
      showError(err.message || "Delete failed", "Could not delete category")
    }
  }

  const totals = useMemo(() => ({
    totalCategories: items.length,
    totalProducts: items.reduce((s, c) => s + (c.totalProducts || 0), 0),
    activeProducts: items.reduce((s, c) => s + (c.activeProducts || 0), 0),
  }), [items])

  if (loading) {
    return (
      <section className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} height="h-[180px]" />)}
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-amber/20 bg-amber/10 px-4 py-3 text-meta text-amber-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard title="Total Categories" value={totals.totalCategories} icon={Sparkles} tone="purple" />
        <MetricCard title="Total Products" value={totals.totalProducts} icon={Package} tone="blue" />
        <MetricCard title="Active Products" value={totals.activeProducts} icon={TrendingUp} tone="green" />
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-card font-bold text-violet">Product Categories</h2>
          <p className="mt-0.5 text-meta text-charcoal-80/65">
            Manage the taxonomy buyers see in the store. Deleting a category moves its products to
            <span className="ml-1 font-mono text-[12px] text-violet">Uncategorized</span> rather than removing them.
          </p>
        </div>
        <button type="button" onClick={() => setEditing({})}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-3.5 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(93,63,211,0.18)] transition hover:-translate-y-0.5 hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40">
          <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Add category
        </button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-violet/20 bg-violet-pale/30 px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-violet shadow-sm">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-card font-semibold text-violet">No categories yet</p>
          <p className="max-w-xs text-meta text-charcoal-80/55">Add your first category so products have somewhere to live.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list" aria-label="Product categories">
          {items.map((row) => {
            const { icon: Icon, tint, border } = styleFor(row.name)
            const ratio = row.totalProducts > 0 ? (row.activeProducts / row.totalProducts) * 100 : 0
            return (
              <article key={row.id || row.name} role="listitem"
                className={`flex flex-col gap-4 rounded-xl border bg-white p-5 shadow-[0_4px_16px_rgba(93,63,211,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(93,63,211,0.10)] ${border}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${tint}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-charcoal-80/55">
                      Active / Total
                    </div>
                    <div className="font-mono text-card font-bold tabular-nums text-violet">
                      {row.activeProducts} / {row.totalProducts}
                    </div>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-meta font-bold text-violet">{row.name}</h3>
                    {row.isLegacy && (
                      <span className="rounded-md bg-amber/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">Legacy</span>
                    )}
                    {!row.isLegacy && row.isActive === false && (
                      <span className="rounded-md bg-charcoal-80/10 px-1.5 py-0.5 text-[10px] font-bold text-charcoal-80/65">Hidden</span>
                    )}
                  </div>
                  {row.slug && <div className="mt-0.5 truncate font-mono text-[11px] text-charcoal-80/55">/{row.slug}</div>}
                  {row.description && <p className="mt-1.5 line-clamp-2 text-[12px] text-charcoal-80/70">{row.description}</p>}
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-violet-pale" role="progressbar"
                  aria-valuenow={Math.round(ratio)} aria-valuemin={0} aria-valuemax={100}
                  aria-label={`${row.activeProducts} of ${row.totalProducts} products active`}>
                  <div className="h-full rounded-full bg-violet transition-all duration-500" style={{ width: `${ratio}%` }} />
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-1">
                  {row.isLegacy ? (
                    <span className="text-[11px] italic text-charcoal-80/50">Promote via product editor</span>
                  ) : (
                    <>
                      <button type="button" onClick={() => setEditing(row)}
                        className="inline-flex items-center gap-1 rounded-md border border-violet/15 bg-white px-2.5 py-1 text-[11px] font-semibold text-violet transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30">
                        <Pencil className="h-3 w-3" aria-hidden="true" /> Edit
                      </button>
                      <button type="button" onClick={() => onDelete(row)}
                        className="inline-flex items-center gap-1 rounded-md border border-rose/20 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose/30/40">
                        <Trash2 className="h-3 w-3" aria-hidden="true" /> Delete
                      </button>
                    </>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {editing && (
        <CategoryFormModal initial={editing} onSubmit={onSave} onCancel={() => setEditing(null)} />
      )}
    </section>
  )
}

function CategoryFormModal({ initial, onSubmit, onCancel }) {
  const [f, setF] = useState({
    id: initial.id,
    name: initial.name ?? "",
    slug: initial.slug ?? "",
    description: initial.description ?? "",
    icon: initial.icon ?? "",
    isActive: initial.isActive !== false,
    sortOrder: initial.sortOrder ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const isEdit = Boolean(initial.id)

  async function submit(e) {
    e.preventDefault()
    setSaving(true); setErr("")
    try {
      await onSubmit(f)
    } catch (x) {
      setErr(x?.message || "Save failed.")
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-charcoal/40 p-4"
      onClick={onCancel} role="dialog" aria-modal="true">
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(93,63,211,0.18)]">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h3 className="text-card font-bold text-violet">{isEdit ? "Edit category" : "New category"}</h3>
          <button type="button" onClick={onCancel} aria-label="Close" className="text-charcoal-80/60 hover:text-violet">
            <X className="h-4 w-4" />
          </button>
        </header>

        <form onSubmit={submit} className="space-y-4 px-5 py-5">
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-charcoal-80">Name <span className="text-red-500">*</span></label>
            <input required value={f.name} onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. STEM & Robotics Kits"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-charcoal placeholder:text-charcoal-50 focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-azure/30" />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-charcoal-80">
              Slug <span className="font-normal text-charcoal-80/55">(auto-generated if blank)</span>
            </label>
            <input value={f.slug} onChange={(e) => set("slug", e.target.value)}
              placeholder="stem-robotics-kits"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm text-charcoal placeholder:text-charcoal-50 focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-azure/30" />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-charcoal-80">Description</label>
            <textarea rows={3} value={f.description} onChange={(e) => set("description", e.target.value)}
              placeholder="One sentence shown above the category's product grid."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-charcoal placeholder:text-charcoal-50 focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-azure/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-charcoal-80">Icon (lucide name)</label>
              <input value={f.icon} onChange={(e) => set("icon", e.target.value)}
                placeholder="e.g. Wrench"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-charcoal placeholder:text-charcoal-50 focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-azure/30" />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-charcoal-80">Sort order</label>
              <input type="number" value={f.sortOrder} onChange={(e) => set("sortOrder", e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm text-charcoal focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-azure/30" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-charcoal">
            <input type="checkbox" checked={f.isActive} onChange={(e) => set("isActive", e.target.checked)} />
            <span>Visible in store</span>
          </label>

          {err && (
            <div className="flex items-start gap-2 rounded-xl border border-rose/20 bg-rose/10 px-3 py-2 text-[12px] text-rose-700" role="alert">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {err}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
            <button type="button" onClick={onCancel}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-charcoal-80 hover:bg-slate-100">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(93,63,211,0.18)] transition hover:bg-violet-deep disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isEdit ? "Save changes" : "Create category"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
