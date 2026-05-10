import { useEffect, useMemo, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Tag, Plus, Edit3, Trash2, X, Check, Activity, ChevronRight,
  Copy, Users, TrendingUp, Calendar, AlertCircle, Percent, DollarSign,
} from "lucide-react"
import { authFetch } from "../lib/api"
import { useToast } from "../context/ToastContext"
import { MetricCard } from "../components/ui/index"
import DataTable from "../components/admin/DataTable"
import StatusPill from "../components/admin/StatusPill"
import {
  Field, FormInput, FormSelect, inputClass,
} from "../components/admin/Field"
import useUnsavedChangesPrompt, { computeIsDirty } from "../hooks/useUnsavedChangesPrompt"

/* ──────────────────────────────────────────────────────────────────────────
 *  AdminCouponsPage · Batch 6B-3
 *
 *  Refactored to use shared admin primitives. Modal stays — it's the right
 *  pattern for short forms — but its internal fields now use the same
 *  Field/FormInput/FormSelect primitives as the dedicated form pages.
 *
 *  What changed:
 *    - Bespoke <table> replaced with <DataTable />
 *    - Bespoke MetricCard replaced with shared <MetricCard />
 *    - Local Badge/Field replaced with <StatusPill /> + shared <Field />
 *    - Modal form fields now use FormInput/FormSelect with consistent
 *      v3.0 styling (white bg, violet border on focus, azure ring)
 *    - Per-field validation surfaces inline error messages
 *    - useUnsavedChangesPrompt active while modal is open + dirty
 *    - Cancel button on modal warns if changes pending
 *
 *  Preserved verbatim:
 *    - All API wrappers (listCoupons, createCoupon, updateCoupon,
 *      deleteCoupon, fetchUsage)
 *    - EMPTY_FORM, formStateFromCoupon, buildPayload helpers
 *    - Usage drawer behavior + animations
 *  ──────────────────────────────────────────────────────────────────── */

/* ── API wrappers (preserved verbatim) ────────────────────────────────── */

async function listCoupons() {
  const r = await authFetch("/api/v1/admin/coupons?includeInactive=true&limit=100", { method: "GET" })
  return Array.isArray(r?.data) ? r.data : []
}

async function createCoupon(payload) {
  const r = await authFetch("/api/v1/admin/coupons", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return r?.data
}

async function updateCoupon(id, payload) {
  const r = await authFetch(`/api/v1/admin/coupons/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
  return r?.data
}

async function deleteCoupon(id) {
  await authFetch(`/api/v1/admin/coupons/${encodeURIComponent(id)}`, { method: "DELETE" })
}

async function fetchUsage(id) {
  const r = await authFetch(`/api/v1/admin/coupons/${encodeURIComponent(id)}/usage?limit=50`, { method: "GET" })
  return Array.isArray(r?.data) ? r.data : []
}

/* ── Helpers (preserved) ──────────────────────────────────────────────── */

function formatDate(value) {
  if (!value) return "-"
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric",
    })
  } catch {
    return "-"
  }
}

function isExpired(coupon) {
  if (!coupon.expiresAt) return false
  return new Date(coupon.expiresAt) < new Date()
}

const EMPTY_FORM = {
  code: "",
  description: "",
  discountType: "percentage",
  discountValue: "10",
  minOrderAmount: "",
  usageLimit: "",
  maxUsesPerUser: "",
  stackable: true,
  startsAt: "",
  expiresAt: "",
  isActive: true,
}

function formStateFromCoupon(coupon) {
  if (!coupon) return EMPTY_FORM
  return {
    code: coupon.code || "",
    description: coupon.description || "",
    discountType: coupon.discountType || "percentage",
    discountValue: coupon.discountValue != null ? String(coupon.discountValue) : "",
    minOrderAmount: coupon.minOrderAmount != null ? String(coupon.minOrderAmount) : "",
    usageLimit: coupon.usageLimit != null ? String(coupon.usageLimit) : "",
    maxUsesPerUser: coupon.maxUsesPerUser != null ? String(coupon.maxUsesPerUser) : "",
    stackable: coupon.stackable !== false,
    startsAt: coupon.startsAt ? coupon.startsAt.slice(0, 10) : "",
    expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 10) : "",
    isActive: coupon.isActive !== false,
  }
}

function buildPayload(form) {
  const payload = {
    code: (form.code || "").trim().toUpperCase(),
    description: form.description.trim() || null,
    discountType: form.discountType,
    discountValue: Number(form.discountValue),
    stackable: Boolean(form.stackable),
    isActive: Boolean(form.isActive),
  }
  payload.minOrderAmount = form.minOrderAmount !== "" ? Number(form.minOrderAmount) : null
  payload.usageLimit = form.usageLimit !== "" ? Number(form.usageLimit) : null
  payload.maxUsesPerUser = form.maxUsesPerUser !== "" ? Number(form.maxUsesPerUser) : null
  payload.startsAt = form.startsAt || null
  payload.expiresAt = form.expiresAt || null
  return payload
}

/* ──────────────────────────────────────────────────────────────────── */

export default function AdminCouponsPage() {
  const { showSuccess, showError } = useToast()
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Modal state
  const [modalMode, setModalMode] = useState(null) // "create" | "edit" | null
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [savedSnapshot, setSavedSnapshot] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")

  // Usage drawer
  const [usageCoupon, setUsageCoupon] = useState(null)
  const [usageRows, setUsageRows] = useState([])
  const [usageLoading, setUsageLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try { setCoupons(await listCoupons()) }
    catch (err) { setError(err?.message || "Failed to load coupons") }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Dirty tracking on modal — only active while modal is open
  const isDirty = useMemo(
    () => modalMode !== null && computeIsDirty(form, savedSnapshot),
    [form, savedSnapshot, modalMode]
  )
  useUnsavedChangesPrompt(isDirty && !saving)

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setSavedSnapshot(EMPTY_FORM)
    setFormError("")
    setModalMode("create")
  }

  const openEdit = (coupon) => {
    setEditing(coupon)
    const initial = formStateFromCoupon(coupon)
    setForm(initial)
    setSavedSnapshot(initial)
    setFormError("")
    setModalMode("edit")
  }

  const closeModal = (force = false) => {
    if (!force && isDirty && !window.confirm("Discard unsaved changes?")) return
    setModalMode(null)
    setEditing(null)
    setSavedSnapshot(null)
    setFormError("")
  }

  const handleSave = async (e) => {
    e?.preventDefault?.()
    setSaving(true); setFormError("")
    try {
      const payload = buildPayload(form)
      if (!payload.code) throw new Error("Code is required")
      if (!Number.isFinite(payload.discountValue) || payload.discountValue <= 0) {
        throw new Error("Discount value must be a positive number")
      }
      if (payload.discountType === "percentage" && payload.discountValue > 100) {
        throw new Error("Percentage cannot exceed 100")
      }
      if (payload.startsAt && payload.expiresAt && new Date(payload.startsAt) > new Date(payload.expiresAt)) {
        throw new Error("Start date must be before expiry date")
      }
      if (modalMode === "create") await createCoupon(payload)
      else await updateCoupon(editing.id, payload)
      showSuccess(modalMode === "create" ? `Coupon ${payload.code} created` : `Coupon ${payload.code} updated`)
      try { await load() } catch (re) { console.warn("[Coupons] reload failed:", re) }
      // Mark snapshot as current to clear dirty flag before close
      setSavedSnapshot(form)
      closeModal(true)
    } catch (err) {
      console.error("[Coupons] save failed:", err)
      setFormError(err?.message || "Could not save")
      showError(err?.message || "Could not save", "Coupon save failed")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (coupon) => {
    const ok = window.confirm(
      `Soft-delete coupon ${coupon.code}? It will be marked inactive but preserved for history.`
    )
    if (!ok) return
    try {
      await deleteCoupon(coupon.id)
      showSuccess(`Coupon ${coupon.code} archived`)
      try { await load() } catch (re) { console.warn("[Coupons] reload failed:", re) }
    } catch (err) {
      console.error("[Coupons] delete failed:", err)
      setError(err?.message || "Could not delete coupon")
      showError(err?.message || "Could not delete coupon", "Delete failed")
    }
  }

  const openUsage = async (coupon) => {
    setUsageCoupon(coupon)
    setUsageLoading(true)
    try {
      setUsageRows(await fetchUsage(coupon.id))
    } catch (err) {
      setError(err?.message || "Could not load usage history")
    } finally {
      setUsageLoading(false)
    }
  }

  /* ── Derived metrics ───────────────────────────────────────── */
  const activeCount = coupons.filter((c) => c.isActive && !isExpired(c)).length
  const expiredCount = coupons.filter((c) => isExpired(c)).length
  const totalRedeemed = coupons.reduce((sum, c) => sum + (c.usedCount || 0), 0)

  /* ── Coupon row state derivation ───────────────────────────── */
  function couponState(c) {
    if (!c.isActive) return "inactive"
    if (isExpired(c)) return "expired"
    return "active"
  }

  /* ── Columns ───────────────────────────────────────────────── */
  const columns = useMemo(() => [
    {
      key: "code",
      label: "Code",
      sortable: true,
      searchable: true,
      width: "1.4fr",
      getValue: (row) => row.code || "",
      render: (row) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <code className="rounded bg-violet-pale px-2 py-0.5 font-mono text-meta font-semibold text-violet">
              {row.code}
            </code>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                try { navigator.clipboard?.writeText(row.code) } catch {}
              }}
              aria-label={`Copy code ${row.code}`}
              title="Copy code"
              className="text-charcoal-80/40 transition hover:text-violet focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-azure/40"
            >
              <Copy className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
          {row.description && (
            <div className="mt-0.5 truncate text-micro text-charcoal-80/60">{row.description}</div>
          )}
        </div>
      ),
    },
    {
      key: "discount",
      label: "Discount",
      sortable: true,
      width: "0.8fr",
      getValue: (row) => Number(row.discountValue || 0),
      render: (row) => (
        <span className="inline-flex items-center gap-1 font-mono text-meta font-bold tabular-nums text-violet">
          {row.discountType === "percentage" ? (
            <>
              <Percent className="h-3 w-3" aria-hidden="true" />
              {Number(row.discountValue)}%
            </>
          ) : (
            <>
              <DollarSign className="h-3 w-3" aria-hidden="true" />
              {Number(row.discountValue).toFixed(2)}
            </>
          )}
        </span>
      ),
    },
    {
      key: "minOrder",
      label: "Min. order",
      sortable: true,
      width: "0.7fr",
      align: "right",
      getValue: (row) => row.minOrderAmount != null ? Number(row.minOrderAmount) : -1,
      render: (row) => (
        <span className="font-mono text-meta tabular-nums text-charcoal-80/85">
          {row.minOrderAmount != null ? `$${Number(row.minOrderAmount).toFixed(2)}` : "-"}
        </span>
      ),
    },
    {
      key: "usage",
      label: "Usage",
      sortable: true,
      width: "0.7fr",
      align: "right",
      getValue: (row) => Number(row.usedCount || 0),
      render: (row) => (
        <span className="font-mono text-meta tabular-nums text-charcoal-80/85">
          {row.usedCount}{row.usageLimit != null ? ` / ${row.usageLimit}` : ""}
        </span>
      ),
    },
    {
      key: "perUser",
      label: "Per user",
      width: "0.6fr",
      align: "center",
      render: (row) => (
        <span className="font-mono text-meta tabular-nums text-charcoal-80/85">
          {row.maxUsesPerUser != null ? row.maxUsesPerUser : "∞"}
        </span>
      ),
    },
    {
      key: "expires",
      label: "Expires",
      sortable: true,
      width: "0.9fr",
      getValue: (row) => row.expiresAt || "",
      render: (row) => (
        <span className="font-mono text-micro tabular-nums text-charcoal-80/85">
          {formatDate(row.expiresAt)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      width: "0.7fr",
      getValue: (row) => couponState(row),
      render: (row) => <StatusPill status={couponState(row)} />,
    },
    {
      key: "actions",
      label: "",
      width: "1.1fr",
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <IconButton onClick={(e) => { e.stopPropagation(); openUsage(row) }} title="View usage" ariaLabel={`View usage for ${row.code}`}>
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
          </IconButton>
          <IconButton onClick={(e) => { e.stopPropagation(); openEdit(row) }} title="Edit" ariaLabel={`Edit ${row.code}`}>
            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
          </IconButton>
          <IconButton onClick={(e) => { e.stopPropagation(); handleDelete(row) }} title="Deactivate" ariaLabel={`Deactivate ${row.code}`} danger>
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </IconButton>
        </div>
      ),
    },
  ], [])

  return (
    <section className="space-y-5">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-meta text-rose-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Metrics */}
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard title="Active coupons" value={activeCount} icon={Activity} tone="purple" />
        <MetricCard title="Total redemptions" value={totalRedeemed} icon={TrendingUp} tone="blue" />
        <MetricCard title="Expired" value={expiredCount} icon={Calendar} tone="amber" />
      </div>

      {/* Page action */}
      <div className="flex items-center justify-between">
        <p className="text-meta text-charcoal-80/70">
          Promotional codes for products and services.
        </p>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-violet px-4 py-2.5 text-micro font-semibold text-white transition hover:-translate-y-0.5 hover:bg-violet-deep hover:shadow-[0_8px_18px_rgba(93,63,211,0.22)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New coupon
        </button>
      </div>

      {/* DataTable */}
      <DataTable
        columns={columns}
        rows={coupons}
        rowKey={(row) => row.id}
        loading={loading}
        onRefresh={load}
        initialSort={{ key: "code", dir: "asc" }}
        searchPlaceholder="Search by code or description…"
        emptyState={{
          icon: Tag,
          title: "No coupons yet",
          description: "Create your first promotional code to get started.",
        }}
      />

      {/* Create/Edit modal */}
      <AnimatePresence>
        {modalMode && (
          <CouponFormModal
            mode={modalMode}
            form={form}
            setForm={setForm}
            onSave={handleSave}
            onClose={() => closeModal()}
            saving={saving}
            error={formError}
          />
        )}
      </AnimatePresence>

      {/* Usage drawer */}
      <AnimatePresence>
        {usageCoupon && (
          <UsageDrawer
            coupon={usageCoupon}
            rows={usageRows}
            loading={usageLoading}
            onClose={() => setUsageCoupon(null)}
          />
        )}
      </AnimatePresence>
    </section>
  )
}

/* ──────────────────────────────────────────────────────────────────────── */

function IconButton({ children, onClick, title, ariaLabel, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel || title}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2 ${
        danger
          ? "border border-charcoal-80/12 bg-white text-rose-600 hover:border-rose-300/50 hover:bg-rose-50 focus-visible:ring-rose-300/40"
          : "border border-charcoal-80/12 bg-white text-charcoal-80/70 hover:border-violet/20 hover:bg-violet-pale hover:text-violet focus-visible:ring-azure/30"
      }`}
    >
      {children}
    </button>
  )
}

/* ──────────────────────────────────────────────────────────────────────── */

function CouponFormModal({ mode, form, setForm, onSave, onClose, saving, error }) {
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  // Close on ESC
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={mode === "create" ? "New coupon" : "Edit coupon"}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-y-auto rounded-2xl border border-charcoal-80/10 bg-white p-6 shadow-[0_24px_60px_rgba(93,63,211,0.18)] max-h-[90vh]"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-card font-bold text-violet">
            {mode === "create" ? "New coupon" : "Edit coupon"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-charcoal-80/55 transition hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={onSave} className="space-y-4">
          <Field label="Code" required>
            {(id) => (
              <input
                id={id}
                type="text"
                value={form.code}
                onChange={(e) => set({ code: e.target.value })}
                placeholder="LAUNCH10"
                autoComplete="off"
                aria-required="true"
                className={inputClass({ className: "font-mono uppercase" })}
              />
            )}
          </Field>

          <FormInput
            label="Description"
            hint="Optional"
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="Launch promo, 10% off orders over $20"
          />

          <div className="grid grid-cols-2 gap-4">
            <FormSelect
              label="Discount type"
              required
              value={form.discountType}
              onChange={(e) => set({ discountType: e.target.value })}
              options={[
                { value: "percentage", label: "Percentage" },
                { value: "fixed", label: "Fixed amount" },
              ]}
            />
            <FormInput
              label={form.discountType === "percentage" ? "Percent off" : "Dollars off"}
              required
              type="number"
              min="0" step="0.01"
              value={form.discountValue}
              onChange={(e) => set({ discountValue: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Min. order amount"
              hint="Leave blank for no minimum"
              type="number"
              min="0" step="0.01"
              value={form.minOrderAmount}
              onChange={(e) => set({ minOrderAmount: e.target.value })}
              placeholder="e.g. 20"
            />
            <FormInput
              label="Total usage limit"
              hint="Blank = unlimited"
              type="number"
              min="0" step="1"
              value={form.usageLimit}
              onChange={(e) => set({ usageLimit: e.target.value })}
              placeholder="e.g. 100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Max uses per user"
              hint="Blank = unlimited"
              type="number"
              min="0" step="1"
              value={form.maxUsesPerUser}
              onChange={(e) => set({ maxUsesPerUser: e.target.value })}
              placeholder="e.g. 1"
            />
            <Field label="Stackable" hint="Allows combining with other coupons">
              <label className="mt-1 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-charcoal-80/12 bg-mist px-3 py-2 text-meta text-charcoal-80 transition hover:bg-violet-pale">
                <input
                  type="checkbox"
                  checked={form.stackable}
                  onChange={(e) => set({ stackable: e.target.checked })}
                  className="h-4 w-4 rounded border-charcoal-80/30 text-violet accent-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
                />
                <span>Yes, can be stacked</span>
              </label>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Starts at"
              type="date"
              value={form.startsAt}
              onChange={(e) => set({ startsAt: e.target.value })}
            />
            <FormInput
              label="Expires at"
              type="date"
              value={form.expiresAt}
              onChange={(e) => set({ expiresAt: e.target.value })}
            />
          </div>

          <Field label="Active">
            <label className="mt-1 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-charcoal-80/12 bg-mist px-3 py-2 text-meta text-charcoal-80 transition hover:bg-violet-pale">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => set({ isActive: e.target.checked })}
                className="h-4 w-4 rounded border-charcoal-80/30 text-violet accent-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
              />
              <span>Coupon is active and redeemable</span>
            </label>
          </Field>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-meta text-rose-700" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-charcoal-80/12 bg-white px-4 py-2 text-micro font-semibold text-charcoal-80/85 transition hover:border-violet/20 hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              aria-busy={saving ? "true" : "false"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-4 py-2 text-micro font-semibold text-white transition hover:bg-violet-deep disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
            >
              {saving ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                  Saving…
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  {mode === "create" ? "Create" : "Save changes"}
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

/* ──────────────────────────────────────────────────────────────────────── */

function UsageDrawer({ coupon, rows, loading, onClose }) {
  // Close on ESC
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex justify-end bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Usage history for ${coupon.code}`}
    >
      <motion.aside
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-charcoal-80/8 bg-white px-5 py-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-charcoal-80/55">Usage history</div>
            <div className="mt-0.5 flex items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-violet" aria-hidden="true" />
              <code className="font-mono text-meta font-semibold text-violet">{coupon.code}</code>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close usage drawer"
            className="rounded-lg p-1.5 text-charcoal-80/55 transition hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="py-10 text-center text-meta text-charcoal-80/60" role="status">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-meta text-charcoal-80/60">No redemptions yet.</div>
          ) : (
            <ul className="space-y-3">
              {rows.map((row) => (
                <li key={row.id} className="rounded-xl border border-charcoal-80/8 bg-mist p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-meta font-medium text-violet">
                        {row.user?.fullName || "Unknown user"}
                      </div>
                      <div className="truncate font-mono text-micro text-charcoal-80/60">{row.user?.email || ""}</div>
                    </div>
                    <div className="font-mono text-micro tabular-nums text-charcoal-80/60">{formatDate(row.usedAt)}</div>
                  </div>
                  {row.order && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-micro text-charcoal-80/85">
                      <ChevronRight className="h-3 w-3" aria-hidden="true" />
                      Order <code className="font-mono text-micro text-violet">{row.order.orderNumber}</code>
                      <span className="ml-auto font-mono font-semibold tabular-nums text-violet">
                        ${Number(row.order.totalAmount).toFixed(2)}
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.aside>
    </motion.div>
  )
}
