/* eslint-disable react-refresh/only-export-components -- shared helpers + small presentational bits for the Bio CMS sections */
import { useCallback, useEffect, useState } from "react"
import { AlertCircle, Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"
import { useToast } from "../../../context/ToastContext"
import { ConfirmModal } from "../forms"

export function fmtDate(iso) {
  if (!iso) return "-"
  try {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short" })
  } catch {
    return String(iso)
  }
}

export const toDateInput = (v) => (v ? String(v).slice(0, 10) : "")

/* ── useBioSection · load / save / delete with toasts for one entry type ── */
export function useBioSection({ label, list, create, update, remove }) {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const tag = `[Bio · ${label}]`

  const reload = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const data = await list()
      const arr = Array.isArray(data) ? data : []
      if (import.meta.env.DEV) console.info(tag, "loaded", arr.length, "rows")
      setItems(arr)
    } catch (e) {
      console.error(tag, "load failed:", e)
      const msg = e?.message || `Failed to load ${label.toLowerCase()}.`
      setError(msg)
      toast.showError(msg, `Could not load ${label.toLowerCase()}`)
    } finally {
      setLoading(false)
    }
  }, [list, label, tag, toast])

  useEffect(() => { reload() }, [reload])

  // Save: rethrows so the form can map server errors inline. Reload after a
  // successful save is fire-and-forget so a stale GET doesn't mask success.
  const onSave = useCallback(async (form) => {
    try {
      const isEdit = Boolean(form.id)
      const saved = isEdit ? await update(form.id, form) : await create(form)
      if (import.meta.env.DEV) console.info(tag, "saved", saved)
      toast.showSuccess(isEdit ? `${label} updated` : `${label} added`)
      setEditing(null)
      try { await reload() } catch (re) { console.warn(tag, "reload after save failed:", re) }
    } catch (e) {
      console.error(tag, "save failed:", e)
      toast.showError(e?.message || "Save failed", `Could not save ${label.toLowerCase()}`)
      throw e
    }
  }, [create, update, reload, label, tag, toast])

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await remove(pendingDelete.id)
      toast.showSuccess(`${label} deleted`)
      setPendingDelete(null)
      await reload()
    } catch (e) {
      console.error(tag, "delete failed:", e)
      toast.showError(e?.message || "Delete failed", `Could not delete ${label.toLowerCase()}`)
    } finally {
      setDeleting(false)
    }
  }, [pendingDelete, remove, reload, label, tag, toast])

  return {
    toast, items, loading, error, reload, onSave,
    editing, setEditing,
    pendingDelete, setPendingDelete, confirmDelete, deleting,
  }
}

/* ── Presentational chrome ─────────────────────────────────────────────── */

export function Section({ title, onAdd, onRefresh, loading, action, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-charcoal">{title}</h2>
          {action && <span className="text-charcoal-50">·</span>}
          {action}
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              title="Reload from server"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-charcoal-80 transition hover:bg-slate-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} strokeWidth={1.8} />
              Refresh
            </button>
          )}
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} /> Add
          </button>
        </div>
      </div>
      {children}
    </section>
  )
}

export function Body({ loading, error, empty, emptyText, children }) {
  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-violet" /></div>
  if (error) return <ErrorRow message={error} />
  if (empty) return <p className="py-6 text-center text-sm text-charcoal-50">{emptyText}</p>
  return children
}

export function ErrorRow({ message }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose/30 bg-rose/5 p-3 text-sm text-rose">
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={1.75} />
      <span>{message}</span>
    </div>
  )
}

export function RowActions({ onEdit, onDelete }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={onEdit} aria-label="Edit" className="rounded-lg p-1.5 text-azure hover:bg-azure/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40">
        <Pencil className="h-4 w-4" strokeWidth={1.75} />
      </button>
      <button type="button" onClick={onDelete} aria-label="Delete" className="rounded-lg p-1.5 text-rose hover:bg-rose/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose/40">
        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  )
}

export function ViewOnAboutLink({ hash }) {
  return (
    <a href={`/about#${hash}`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-azure-deep hover:underline">
      View on About page ↗
    </a>
  )
}

export function DeleteConfirm({ section, title }) {
  return (
    <ConfirmModal
      open={Boolean(section.pendingDelete)}
      onClose={() => section.setPendingDelete(null)}
      onConfirm={section.confirmDelete}
      busy={section.deleting}
      title={title}
      confirmLabel="Delete"
      tone="danger"
    >
      <p className="text-sm text-charcoal-80">This cannot be undone.</p>
    </ConfirmModal>
  )
}
