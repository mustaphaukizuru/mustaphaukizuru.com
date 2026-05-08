// ─────────────────────────────────────────────────────────────────────────────
// useAdminCrud · shared hook for every admin CRUD page
//
// Why this exists:
//   Every admin page repeats the same defensive pattern — load → list, save →
//   reload, delete → reload, with try/catch on every step plus toast feedback.
//   Hand-copying that pattern across 20+ pages drifts. This hook centralises
//   it so:
//     · Every page gets identical UX (success / error toasts, dev-mode logs).
//     · A reload failure after a successful save never masks the success.
//     · We get a single place to add features later (optimistic updates,
//       offline queueing, retry-on-401, etc.).
//
// Usage:
//   const crud = useAdminCrud({
//     name:   "Coupons",
//     load:   () => listAdminCoupons(),
//     save:   (form) => form.id ? updateCoupon(form.id, form) : createCoupon(form),
//     remove: (id) => deleteCoupon(id),
//   })
//
//   crud.items     — current list (Array<T>)
//   crud.loading   — initial load pending
//   crud.busy      — any in-flight mutation (save / delete / reload)
//   crud.error     — last load error message (or "")
//   crud.reload()  — manual refresh
//   crud.onSave(form, opts?)   — saves; returns true on success, false on fail
//   crud.onDelete(id, opts?)   — deletes; returns true on success, false on fail
//
//   opts.successMessage — optional override for toast title
//   opts.silent         — suppress toast (rarely needed)
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react"
import { useToast } from "../context/ToastContext"

const DEV = typeof import.meta !== "undefined" && import.meta?.env?.DEV

function logDev(prefix, message, ...rest) {
  if (DEV && typeof console !== "undefined") {
    console.info(`[${prefix}]`, message, ...rest)
  }
}

function logError(prefix, message, err) {
  if (typeof console !== "undefined") {
    console.error(`[${prefix}] ${message}:`, err)
  }
}

export default function useAdminCrud({
  name = "AdminCRUD",
  load, // () => Promise<Array<T>>
  save, // (form) => Promise<T>
  remove, // (id) => Promise<void>
  initialLoad = true,
}) {
  const toast = useToast()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(initialLoad)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    if (typeof load !== "function") return
    setLoading(true); setError("")
    try {
      const data = await load()
      const arr = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : (Array.isArray(data?.data) ? data.data : []))
      logDev(name, `loaded ${arr.length} rows`, arr)
      setItems(arr)
    } catch (e) {
      logError(name, "load failed", e)
      const msg = e?.message || "Failed to load."
      setError(msg)
      toast.showError(msg, `Could not load ${name.toLowerCase()}`)
    } finally {
      setLoading(false)
    }
  }, [load, name, toast])

  useEffect(() => {
    if (initialLoad && typeof load === "function") {
      reload()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, initialLoad])

  const onSave = useCallback(async (form, opts = {}) => {
    if (typeof save !== "function") {
      toast.showError("Save function not configured", "Configuration error")
      return false
    }
    setBusy(true)
    const isEdit = Boolean(form?.id)
    const verb = isEdit ? "updated" : "added"
    try {
      const saved = await save(form)
      logDev(name, `${verb}`, saved)
      if (!opts.silent) {
        toast.showSuccess(opts.successMessage || `${name} ${verb}`)
      }
      // Reload runs after success — its failure shouldn't undo the success toast.
      try { await reload() } catch (re) { logError(name, "reload after save failed", re) }
      return saved ?? true
    } catch (e) {
      logError(name, "save failed", e)
      toast.showError(e?.message || "Save failed", `Could not save ${name.toLowerCase()}`)
      return false
    } finally {
      setBusy(false)
    }
  }, [save, name, reload, toast])

  const onDelete = useCallback(async (id, opts = {}) => {
    if (typeof remove !== "function") {
      toast.showError("Delete function not configured", "Configuration error")
      return false
    }
    if (!opts.confirm === false) {
      // default: confirm prompt unless explicitly disabled with { confirm: false }
      // (no-op — caller supplies their own confirmation modal usually)
    }
    setBusy(true)
    try {
      await remove(id)
      logDev(name, `deleted ${id}`)
      if (!opts.silent) {
        toast.showSuccess(opts.successMessage || `${name} deleted`)
      }
      try { await reload() } catch (re) { logError(name, "reload after delete failed", re) }
      return true
    } catch (e) {
      logError(name, "delete failed", e)
      toast.showError(e?.message || "Delete failed", `Could not delete ${name.toLowerCase()}`)
      return false
    } finally {
      setBusy(false)
    }
  }, [remove, name, reload, toast])

  // Wrap an arbitrary mutation (e.g. status update, bulk action) with the
  // same toast + reload contract so pages don't have to repeat themselves.
  const onMutate = useCallback(async (fn, opts = {}) => {
    if (typeof fn !== "function") return false
    setBusy(true)
    try {
      const result = await fn()
      logDev(name, "mutate ok", result)
      if (opts.successMessage && !opts.silent) {
        toast.showSuccess(opts.successMessage)
      }
      if (opts.reload !== false) {
        try { await reload() } catch (re) { logError(name, "reload after mutate failed", re) }
      }
      return result ?? true
    } catch (e) {
      logError(name, "mutate failed", e)
      toast.showError(e?.message || "Action failed", opts.errorTitle || `${name} action failed`)
      return false
    } finally {
      setBusy(false)
    }
  }, [name, reload, toast])

  return {
    items, setItems,
    loading, busy,
    error,
    reload,
    onSave,
    onDelete,
    onMutate,
  }
}
