import { useEffect, useMemo, useState } from "react"
import {
  BookOpen, Cpu, FlaskConical, Wrench, Briefcase, Sparkles,
  Package, TrendingUp, AlertCircle, Plus, Pencil, Trash2,
} from "lucide-react"
import {
  fetchAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
} from "../services/adminCategoryService"
import { useToast } from "../context/ToastContext"
import { MetricCard, SkeletonCard } from "../components/ui/index"
import useForm from "../hooks/useForm"
import { categorySchema } from "../lib/validation/category"
import {
  FormModal, FormErrorBanner, FormActions, ConfirmModal,
  TextField, TextAreaField, NumberField, CheckboxField,
} from "../components/admin/forms"

/* ──────────────────────────────────────────────────────────────────────────
 *  AdminCategoriesPage · v2 · full CRUD on ProductCategory
 *  Form layer: useForm + lib/validation/category (roadmap step 30).
 *  ──────────────────────────────────────────────────────────────────── */

// Brand v3 §05 — every category tint maps to a sanctioned semantic tier.
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
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    setLoading(true); setError("")
    try {
      const result = await fetchAdminCategories()
      const arr = Array.isArray(result) ? result : []
      if (import.meta.env.DEV) console.info("[Categories] loaded", arr.length, "rows")
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

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  async function confirmDelete() {
    const row = pendingDelete
    if (!row?.id || row.isLegacy) return
    setDeleting(true)
    try {
      await deleteAdminCategory(row.id)
      showSuccess(`Category "${row.name}" deleted`)
      setPendingDelete(null)
      try { await load() } catch (re) { console.warn("[Categories] reload after delete failed:", re) }
    } catch (err) {
      console.error("[Categories] delete failed:", err)
      showError(err.message || "Delete failed", "Could not delete category")
    } finally {
      setDeleting(false)
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
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-3.5 py-2 text-sm font-semibold text-white shadow-[var(--shadow-lift-1)] transition hover:-translate-y-0.5 hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40">
          <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Add category
        </button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-violet/20 bg-violet-pale/30 px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-violet shadow-sm">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-card font-semibold text-violet">No categories yet</p>
          <p className="max-w-xs text-meta text-charcoal-80/65">Add your first category so products have somewhere to live.</p>
        </div>
      ) : (
        <ul className="grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Product categories">
          {items.map((row) => {
            const { icon: Icon, tint, border } = styleFor(row.name)
            const ratio = row.totalProducts > 0 ? (row.activeProducts / row.totalProducts) * 100 : 0
            return (
              <li key={row.id || row.name}
                className={`flex flex-col gap-4 rounded-xl border bg-white p-5 shadow-[var(--shadow-e3)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-e6)] ${border}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${tint}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-charcoal-80/65">Active / Total</div>
                    <div className="font-mono text-card font-bold tabular-nums text-violet">{row.activeProducts} / {row.totalProducts}</div>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-meta font-bold text-violet">{row.name}</h3>
                    {row.isLegacy && <span className="rounded-md bg-amber/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">Legacy</span>}
                    {!row.isLegacy && row.isActive === false && (
                      <span className="rounded-md bg-charcoal-80/10 px-1.5 py-0.5 text-[10px] font-bold text-charcoal-80/65">Hidden</span>
                    )}
                  </div>
                  {row.slug && <div className="mt-0.5 truncate font-mono text-[11px] text-charcoal-80/65">/{row.slug}</div>}
                  {row.description && <p className="mt-1.5 line-clamp-2 text-[12px] text-charcoal-80/70">{row.description}</p>}
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-violet-pale" role="progressbar"
                  aria-valuenow={Math.round(ratio)} aria-valuemin={0} aria-valuemax={100}
                  aria-label={`${row.activeProducts} of ${row.totalProducts} products active`}>
                  <div className="h-full rounded-full bg-violet transition-all duration-500" style={{ width: `${ratio}%` }} />
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-1">
                  {row.isLegacy ? (
                    <span className="text-[11px] italic text-charcoal-80/65">Promote via product editor</span>
                  ) : (
                    <>
                      <button type="button" onClick={() => setEditing(row)}
                        className="inline-flex items-center gap-1 rounded-md border border-violet/15 bg-white px-2.5 py-1 text-[11px] font-semibold text-violet transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30">
                        <Pencil className="h-3 w-3" aria-hidden="true" /> Edit
                      </button>
                      <button type="button" onClick={() => setPendingDelete(row)}
                        className="inline-flex items-center gap-1 rounded-md border border-rose/20 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose/30">
                        <Trash2 className="h-3 w-3" aria-hidden="true" /> Delete
                      </button>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {editing && (
        <CategoryFormModal initial={editing} onSubmit={onSave} onCancel={() => setEditing(null)} />
      )}

      <ConfirmModal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        busy={deleting}
        title={`Delete category "${pendingDelete?.name ?? ""}"?`}
        confirmLabel="Delete"
        tone="danger"
      >
        <p className="text-sm text-charcoal-80">
          {pendingDelete?.totalProducts > 0
            ? `${pendingDelete.totalProducts} product${pendingDelete.totalProducts === 1 ? "" : "s"} will be moved to "Uncategorized". They will NOT be deleted.`
            : "No products are assigned to this category."}
        </p>
      </ConfirmModal>
    </section>
  )
}

function CategoryFormModal({ initial, onSubmit, onCancel }) {
  const isEdit = Boolean(initial.id)
  const form = useForm({
    schema: categorySchema,
    initialValues: {
      id: initial.id,
      name: initial.name ?? "",
      slug: initial.slug ?? "",
      description: initial.description ?? "",
      icon: initial.icon ?? "",
      isActive: initial.isActive !== false,
      sortOrder: initial.sortOrder ?? 0,
    },
    onSubmit,
  })

  return (
    <FormModal open onClose={onCancel} title={isEdit ? "Edit category" : "New category"}>
      <form onSubmit={form.handleSubmit} noValidate className="space-y-4">
        <TextField form={form} name="name" label="Name" required placeholder="e.g. STEM & Robotics Kits" />
        <TextField form={form} name="slug" label="Slug" hint="Auto-generated if blank" mono placeholder="stem-robotics-kits" />
        <TextAreaField form={form} name="description" label="Description" rows={3} placeholder="One sentence shown above the category's product grid." />
        <div className="grid grid-cols-2 gap-3">
          <TextField form={form} name="icon" label="Icon (lucide name)" placeholder="e.g. Wrench" />
          <NumberField form={form} name="sortOrder" label="Sort order" />
        </div>
        <CheckboxField form={form} name="isActive" label="Visible in store" />
        <FormErrorBanner message={form.formError} />
        <FormActions onCancel={onCancel} saving={form.submitting} saveLabel={isEdit ? "Save changes" : "Create category"} />
      </form>
    </FormModal>
  )
}
