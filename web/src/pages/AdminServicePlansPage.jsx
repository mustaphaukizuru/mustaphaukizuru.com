/* ════════════════════════════════════════════════════════════════════════
   AdminServicePlansPage.jsx · Service + Pricing-plan + Feature CRUD
   ────────────────────────────────────────────────────────────────────────
   Connects to /api/v1/admin/services and gives the admin a single screen
   to manage:
     · Services       (title, description, base price, status, bookable, …)
     · Packages       (the pricing plans that show up on /services)
     · Features       (the bullet-point inclusion lines)

   This page lives alongside AdminServiceOrdersPage which manages paid
   orders. AdminServicesPage previously served orders too — that one still
   does. THIS page is wired into /admin/services in App.jsx so the admin
   can edit the catalogue itself.

   Implementation notes:
     · authFetch / serviceService for all mutations
     · Optimistic-style flow: refetch detail after each mutation to keep
       state authoritative (services + packages + features are inexpensive)
     · Inline forms — no client-side router for nested edit; Modals only
       for service create / edit
     · Brand tokens: #5D3FD3 + #1A1B23, framer-motion fade/stagger, Lucide
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Briefcase, Plus, RefreshCw, Pencil, Trash2, Save, X, Loader2,
  CheckCircle2, AlertCircle, Star, ChevronDown, ChevronUp, Tag, Layers, Eye, EyeOff,
} from "lucide-react"
import {
  listAdminServices,
  getAdminService,
  createAdminService,
  updateAdminService,
  deleteAdminService,
  addAdminServicePackage,
  updateAdminServicePackage,
  removeAdminServicePackage,
  addAdminServiceFeature,
  removeAdminServiceFeature,
} from "../services/serviceService"
import { useToast } from "../context/ToastContext"

/* ── Constants ──────────────────────────────────────────────────────────── */

const STATUSES = ["draft", "published", "archived"]
const DELIVERY = ["consultation", "project", "subscription", "package", "custom"]
// MXN first — it's the platform's native currency. USD/EUR retained for any
// services priced in those currencies for international clients.
const CURRENCIES = ["MXN", "USD", "EUR"]

// Audiences shown on the public Choose-Your-Plan matrix. A Service tagged
// with an audienceCode appears in /services pricing; null = standalone service.
const AUDIENCE_OPTIONS = [
  { value: "", label: ", None (standalone service)," },
  { value: "professional", label: "Professional" },
  { value: "business", label: "Business" },
  { value: "schools", label: "Schools" },
]
const TIER_OPTIONS = [
  { value: "", label: ", None," },
  { value: "basic", label: "Basic" },
  { value: "medium", label: "Medium" },
  { value: "advanced", label: "Advanced" },
]

/* ── Helpers ────────────────────────────────────────────────────────────── */

function fmtMoney(amount, currency = "MXN") {
  // es-MX locale formats $11,800.00 with the peso glyph for MXN; falls back
  // to en-US formatting for any non-MXN currency the admin assigns.
  const locale = currency === "MXN" ? "es-MX" : "en-US"
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 })
      .format(Number(amount || 0))
  } catch {
    return `${Number(amount || 0).toFixed(2)} ${currency}`
  }
}

function statusTone(status) {
  switch (status) {
    case "published": return "bg-[#e5f4e8] text-[#3b8f47]"
    case "draft": return "bg-[#fff3e2] text-[#b46909]"
    case "archived": return "bg-[#f2f2f2] text-[#666]"
    default: return "bg-[#EDE9FB] text-[#5D3FD3]"
  }
}

const fadeUp = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } }

/* ── Reusable form atoms ────────────────────────────────────────────────── */

function Field({ label, required, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#5D3FD3]">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-[#1A1B23]/55">{hint}</span>}
    </label>
  )
}

const inputClass =
  "w-full rounded-xl border border-[#1A1B23]/15 bg-white px-3.5 py-2.5 text-[13px] text-[#5D3FD3] outline-none transition focus:border-[#5D3FD3] focus:ring-2 focus:ring-[#5D3FD3]/10"

/* ════════════════════════════════════════════════════════════════════════
   Service CRUD modal
   ════════════════════════════════════════════════════════════════════════ */
function ServiceModal({ open, onClose, initial, onSaved }) {
  const { showSuccess, showError } = useToast()
  const isEdit = Boolean(initial?.id)

  // I18N06 · Bilingual form state. The modal carries EN + ES side-by-side so
  // the admin can flip between locales without leaving the screen. The save
  // payload always sends both — partial updates are safe because the backend
  // uses a defensive spread (only touches columns explicitly present).
  // Schema asymmetry note: long-form Spanish lives in `descriptionEs` (no
  // `description` sibling on Service), but in the UI we label it
  // "Full description" to keep the admin's mental model consistent.
  const [locale, setLocale] = useState("en")
  const [form, setForm] = useState(() => ({
    title: "",
    slug: "",
    shortDescription: "",
    fullDescription: "",
    basePrice: "0",
    currency: "MXN",
    deliveryType: "consultation",
    status: "draft",
    isFeatured: false,
    isBookable: false,
    audienceCode: "",
    metaTitle: "",
    metaDescription: "",
    // Spanish counterparts
    titleEs: "",
    shortDescriptionEs: "",
    descriptionEs: "",
    metaTitleEs: "",
    metaDescriptionEs: "",
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open && initial) {
      setForm({
        title: initial.title || "",
        slug: initial.slug || "",
        shortDescription: initial.shortDescription || "",
        fullDescription: initial.fullDescription || "",
        basePrice: String(initial.basePrice ?? "0"),
        currency: initial.currency || "MXN",
        deliveryType: initial.deliveryType || "consultation",
        status: initial.status || "draft",
        isFeatured: Boolean(initial.isFeatured),
        isBookable: Boolean(initial.isBookable),
        audienceCode: initial.audienceCode || "",
        metaTitle: initial.metaTitle || "",
        metaDescription: initial.metaDescription || "",
        titleEs:            initial.titleEs            || "",
        shortDescriptionEs: initial.shortDescriptionEs || "",
        descriptionEs:      initial.descriptionEs      || "",
        metaTitleEs:        initial.metaTitleEs        || "",
        metaDescriptionEs:  initial.metaDescriptionEs  || "",
      })
    } else if (open && !initial) {
      setForm({
        title: "", slug: "", shortDescription: "", fullDescription: "",
        basePrice: "0", currency: "MXN", deliveryType: "consultation", status: "draft",
        isFeatured: false, isBookable: false, audienceCode: "",
        metaTitle: "", metaDescription: "",
        titleEs: "", shortDescriptionEs: "", descriptionEs: "",
        metaTitleEs: "", metaDescriptionEs: "",
      })
    }
    // Reset to English tab on every open so the admin always lands on the
    // canonical locale regardless of where they left the toggle last time.
    setLocale("en")
    setError("")
  }, [open, initial])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")

    // Inline validation
    if (!form.title.trim()) return setError("Title is required.")
    if (!form.shortDescription.trim()) return setError("Short description is required.")
    const price = Number(form.basePrice)
    if (Number.isNaN(price) || price < 0) return setError("Base price must be a non-negative number.")

    setSaving(true)
    try {
      const payload = { ...form, basePrice: price }
      // Only send non-empty optional fields. audienceCode is sent as null when
      // empty so admins can clear it after re-tagging a service.
      payload.audienceCode = form.audienceCode || null
      if (!payload.slug) delete payload.slug
      if (!payload.fullDescription) delete payload.fullDescription
      if (!payload.metaTitle) delete payload.metaTitle
      if (!payload.metaDescription) delete payload.metaDescription

      // I18N06 · Spanish columns. Send empty strings as null so admins can
      // wipe a translation back to "fall through to English" by clearing the
      // field. Backend uses defensive `!== undefined` checks, so the keys
      // must be present — we only convert "" → null, never strip them.
      payload.titleEs            = form.titleEs            || null
      payload.shortDescriptionEs = form.shortDescriptionEs || null
      payload.descriptionEs      = form.descriptionEs      || null
      payload.metaTitleEs        = form.metaTitleEs        || null
      payload.metaDescriptionEs  = form.metaDescriptionEs  || null

      const result = isEdit
        ? await updateAdminService(initial.id, payload)
        : await createAdminService(payload)

      const saved = result?.data || result
      showSuccess(isEdit ? `Service "${saved.title}" updated` : `Service "${saved.title}" created`)
      onSaved?.(saved)
      onClose()
    } catch (err) {
      const msg = err?.message || "Could not save the service."
      setError(msg)
      showError?.(msg, "Save failed")
    } finally {
      setSaving(false)
    }
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
            className="fixed left-1/2 top-1/2 z-[121] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-[#1A1B23]/15 bg-white shadow-[0_30px_80px_rgba(93,63,211,0.25)]"
          >
            <form onSubmit={handleSubmit} className="flex max-h-[90vh] flex-col">
              <header className="flex items-start justify-between border-b border-[#1A1B23]/10 px-6 py-5">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EDE9FB] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5D3FD3]">
                    <Briefcase className="h-3 w-3" /> {isEdit ? "Edit service" : "New service"}
                  </span>
                  <h2 className="mt-2 text-[20px] font-bold text-[#5D3FD3]">
                    {isEdit ? form.title || "Untitled service" : "Create a new service"}
                  </h2>
                </div>
                <button
                  type="button" onClick={onClose} aria-label="Close"
                  className="-mt-1 -mr-1 flex h-9 w-9 items-center justify-center rounded-xl text-[#1A1B23]/55 transition hover:bg-[#f5eff6] hover:text-[#5D3FD3]"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              <div className="overflow-y-auto px-6 py-5">
                {/* I18N06 · Locale toggle. Translatable fields (Title, Short
                    description, Full description, Meta title, Meta description)
                    bind to either English or Spanish columns based on this
                    pill. Non-translatable structure (slug, status, pricing,
                    audience, flags) stays canonical and is shared across
                    locales. */}
                <div className="mb-5 flex items-center justify-between rounded-xl border border-[#1A1B23]/12 bg-[#faf7fb] px-3 py-2.5">
                  <div className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[#1A1B23]/60">
                    <span aria-hidden="true">Locale</span>
                  </div>
                  <div role="tablist" aria-label="Edit locale" className="inline-flex items-center gap-1 rounded-lg bg-white p-1 shadow-[inset_0_0_0_1px_rgba(26,27,35,0.08)]">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={locale === "en"}
                      onClick={() => setLocale("en")}
                      className={`rounded-md px-3 py-1.5 text-[11.5px] font-bold uppercase tracking-wide transition focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-[#5D3FD3]/35 ${
                        locale === "en"
                          ? "bg-[#5D3FD3] text-white shadow-[0_2px_6px_rgba(93,63,211,0.25)]"
                          : "text-[#1A1B23]/65 hover:text-[#5D3FD3]"
                      }`}
                    >
                      EN
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={locale === "es"}
                      onClick={() => setLocale("es")}
                      className={`rounded-md px-3 py-1.5 text-[11.5px] font-bold uppercase tracking-wide transition focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-[#5D3FD3]/35 ${
                        locale === "es"
                          ? "bg-[#5D3FD3] text-white shadow-[0_2px_6px_rgba(93,63,211,0.25)]"
                          : "text-[#1A1B23]/65 hover:text-[#5D3FD3]"
                      }`}
                    >
                      ES
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {locale === "en" ? (
                    <Field label="Title" required>
                      <input className={inputClass} value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="e.g., Personal Brand Build" />
                    </Field>
                  ) : (
                    <Field label="Title (ES)" hint="Falls back to English if blank">
                      <input className={inputClass} value={form.titleEs} onChange={(e) => update("titleEs", e.target.value)} placeholder="ej., Construcción de marca personal" />
                    </Field>
                  )}
                  <Field label="Slug" hint="Auto-generated · shared across locales">
                    <input className={inputClass} value={form.slug} onChange={(e) => update("slug", e.target.value)} placeholder="personal-brand-build" />
                  </Field>

                  {locale === "en" ? (
                    <Field label="Short description" required>
                      <input className={inputClass} value={form.shortDescription} onChange={(e) => update("shortDescription", e.target.value)} placeholder="One-sentence positioning" />
                    </Field>
                  ) : (
                    <Field label="Short description (ES)" hint="Falls back to English if blank">
                      <input className={inputClass} value={form.shortDescriptionEs} onChange={(e) => update("shortDescriptionEs", e.target.value)} placeholder="Posicionamiento en una frase" />
                    </Field>
                  )}
                  <Field label="Status" hint="Shared across locales">
                    <select className={inputClass} value={form.status} onChange={(e) => update("status", e.target.value)}>
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>

                  {locale === "en" ? (
                    <Field label="Full description" hint="Long-form copy for the public service page">
                      <textarea rows={4} className={inputClass} value={form.fullDescription} onChange={(e) => update("fullDescription", e.target.value)} />
                    </Field>
                  ) : (
                    <Field label="Full description (ES)" hint="Texto largo para la página pública del servicio">
                      <textarea rows={4} className={inputClass} value={form.descriptionEs} onChange={(e) => update("descriptionEs", e.target.value)} />
                    </Field>
                  )}
                  <Field label="Delivery type">
                    <select className={inputClass} value={form.deliveryType} onChange={(e) => update("deliveryType", e.target.value)}>
                      {DELIVERY.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </Field>

                  <Field label="Base price" hint="Used as fallback when no Package is selected">
                    <input type="number" min="0" step="0.01" className={inputClass} value={form.basePrice} onChange={(e) => update("basePrice", e.target.value)} />
                  </Field>
                  <Field label="Currency">
                    <select className={inputClass} value={form.currency} onChange={(e) => update("currency", e.target.value)}>
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>

                  <Field label="Featured">
                    <button type="button" onClick={() => update("isFeatured", !form.isFeatured)}
                      className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] font-semibold transition ${
                        form.isFeatured ? "border-[#5D3FD3] bg-[#EDE9FB] text-[#5D3FD3]" : "border-[#1A1B23]/15 bg-white text-[#1A1B23]/65 hover:text-[#5D3FD3]"
                      }`}
                    >
                      <Star className={`h-4 w-4 ${form.isFeatured ? "fill-[#5D3FD3]" : ""}`} />
                      {form.isFeatured ? "Featured" : "Not featured"}
                    </button>
                  </Field>
                  <Field label="Bookable">
                    <button type="button" onClick={() => update("isBookable", !form.isBookable)}
                      className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] font-semibold transition ${
                        form.isBookable ? "border-[#5D3FD3] bg-[#EDE9FB] text-[#5D3FD3]" : "border-[#1A1B23]/15 bg-white text-[#1A1B23]/65 hover:text-[#5D3FD3]"
                      }`}
                    >
                      {form.isBookable ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      {form.isBookable ? "Visible on booking calendar" : "Hidden from booking"}
                    </button>
                  </Field>

                  <Field label="Audience" hint="Tag a service so it appears in the public Choose-Your-Plan matrix">
                    <select className={inputClass} value={form.audienceCode} onChange={(e) => update("audienceCode", e.target.value)}>
                      {AUDIENCE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </Field>
                  <div /> {/* spacer for grid alignment */}

                  {locale === "en" ? (
                    <Field label="Meta title" hint="Optional · SEO">
                      <input className={inputClass} value={form.metaTitle} onChange={(e) => update("metaTitle", e.target.value)} />
                    </Field>
                  ) : (
                    <Field label="Meta title (ES)" hint="Opcional · SEO en español">
                      <input className={inputClass} value={form.metaTitleEs} onChange={(e) => update("metaTitleEs", e.target.value)} />
                    </Field>
                  )}
                  {locale === "en" ? (
                    <Field label="Meta description" hint="Optional · SEO">
                      <input className={inputClass} value={form.metaDescription} onChange={(e) => update("metaDescription", e.target.value)} />
                    </Field>
                  ) : (
                    <Field label="Meta description (ES)" hint="Opcional · SEO en español">
                      <input className={inputClass} value={form.metaDescriptionEs} onChange={(e) => update("metaDescriptionEs", e.target.value)} />
                    </Field>
                  )}
                </div>
              </div>

              {error && (
                <div className="mx-6 mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] font-semibold text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}
                </div>
              )}

              <footer className="flex items-center justify-end gap-2 border-t border-[#1A1B23]/10 bg-[#faf7fb] px-6 py-4">
                <button type="button" onClick={onClose}
                  className="rounded-xl border border-[#5D3FD3]/20 bg-white px-4 py-2.5 text-[12.5px] font-semibold text-[#5D3FD3] transition hover:bg-[#EDE9FB]"
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#5D3FD3] px-5 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_8px_22px_rgba(93,63,211,0.25)] transition hover:bg-[#4A2EAB] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                    : <><Save className="h-4 w-4" /> {isEdit ? "Save changes" : "Create service"}</>}
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
   Package row (inline editable)
   ════════════════════════════════════════════════════════════════════════ */
function PackageRow({ serviceId, pkg, features = [], onChanged }) {
  const { showSuccess, showError } = useToast()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  // I18N06 · Per-package locale toggle. Defaults to EN; flipping to ES
  // swaps `Plan name` and `Description` to bind to nameEs / descriptionEs.
  // Pricing/tier/period/popular/saveLabel/sortOrder/active are
  // structurally shared across locales.
  const [pkgLocale, setPkgLocale] = useState("en")
  const [form, setForm] = useState({
    name: pkg.name || "",
    description: pkg.description || "",
    price: String(pkg.price ?? "0"),
    currency: pkg.currency || "MXN",
    isActive: Boolean(pkg.isActive),
    sortOrder: Number(pkg.sortOrder ?? 0),
    tierKey: pkg.tierKey || "",
    period: pkg.period || "month",
    popular: Boolean(pkg.popular),
    saveLabel: pkg.saveLabel || "",
    nameEs: pkg.nameEs || "",
    descriptionEs: pkg.descriptionEs || "",
  })

  // Track which features are included via PackageFeatureSlot. The relation
  // arrives as `featureSlots: [{featureId}]` from the backend get-detail call.
  const initialIncluded = useMemo(() => {
    const set = new Set((pkg.featureSlots || []).map((s) => s.featureId))
    return set
  }, [pkg.featureSlots])
  const [includedSet, setIncludedSet] = useState(initialIncluded)

  function toggleFeature(featureId) {
    setIncludedSet((prev) => {
      const next = new Set(prev)
      if (next.has(featureId)) next.delete(featureId); else next.add(featureId)
      return next
    })
  }

  async function handleSave() {
    if (!form.name.trim()) { showError("Name is required"); return }
    const price = Number(form.price)
    if (Number.isNaN(price) || price < 0) { showError("Price must be a non-negative number"); return }
    setBusy(true)
    try {
      // Send tier metadata + (optionally) featureIds — backend accepts a
      // featureIds array to replace the inclusion set in one transaction.
      // I18N06 · Spanish package fields are sent as null when blank so admins
      // can wipe a translation; backend uses `!== undefined` checks.
      await updateAdminServicePackage(serviceId, pkg.id, {
        ...form,
        price,
        tierKey: form.tierKey || null,
        saveLabel: form.saveLabel || null,
        period: form.period || null,
        nameEs: form.nameEs || null,
        descriptionEs: form.descriptionEs || null,
        featureIds: Array.from(includedSet),
      })
      showSuccess(`Plan "${form.name}" updated`)
      setEditing(false)
      onChanged?.()
    } catch (err) { showError(err?.message || "Could not update package") }
    finally { setBusy(false) }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete plan "${pkg.name}"?\nIf this plan was already purchased, it will be deactivated to preserve order history.`)) return
    setBusy(true)
    try {
      await removeAdminServicePackage(serviceId, pkg.id)
      showSuccess(`Plan "${pkg.name}" removed`)
      onChanged?.()
    } catch (err) { showError(err?.message || "Could not delete package") }
    finally { setBusy(false) }
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-[#5D3FD3]/20 bg-white p-4 shadow-[0_4px_14px_rgba(93,63,211,0.06)]">
        {/* I18N06 · Compact locale toggle — only swaps Plan name + Description.
            Pricing, tier, period, popular, save-label and inclusion matrix
            stay structural and shared across locales. */}
        <div className="mb-3 flex items-center justify-between rounded-lg border border-[#1A1B23]/10 bg-[#faf7fb] px-2.5 py-1.5">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#1A1B23]/55">
            Locale
          </span>
          <div role="tablist" aria-label="Edit package locale" className="inline-flex items-center gap-1 rounded-md bg-white p-0.5 shadow-[inset_0_0_0_1px_rgba(26,27,35,0.08)]">
            <button
              type="button"
              role="tab"
              aria-selected={pkgLocale === "en"}
              onClick={() => setPkgLocale("en")}
              className={`rounded px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide transition focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-[#5D3FD3]/35 ${
                pkgLocale === "en" ? "bg-[#5D3FD3] text-white" : "text-[#1A1B23]/65 hover:text-[#5D3FD3]"
              }`}
            >
              EN
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={pkgLocale === "es"}
              onClick={() => setPkgLocale("es")}
              className={`rounded px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide transition focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-[#5D3FD3]/35 ${
                pkgLocale === "es" ? "bg-[#5D3FD3] text-white" : "text-[#1A1B23]/65 hover:text-[#5D3FD3]"
              }`}
            >
              ES
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {pkgLocale === "en" ? (
            <Field label="Plan name" required>
              <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
          ) : (
            <Field label="Plan name (ES)" hint="Falls back to English if blank">
              <input className={inputClass} value={form.nameEs} onChange={(e) => setForm({ ...form, nameEs: e.target.value })} placeholder="ej., Plan Profesional" />
            </Field>
          )}
          <Field label="Tier key" hint="Used by the public Choose-Your-Plan matrix">
            <select className={inputClass} value={form.tierKey} onChange={(e) => setForm({ ...form, tierKey: e.target.value })}>
              {TIER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>

          <Field label="Price" required>
            <input type="number" min="0" step="0.01" className={inputClass} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </Field>
          <Field label="Currency">
            <select className={inputClass} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          <Field label="Period" hint="e.g. month, one-time, year">
            <input className={inputClass} value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="month" />
          </Field>
          <Field label="Save label" hint="Small chip, e.g. 'Save 20%'">
            <input className={inputClass} value={form.saveLabel} onChange={(e) => setForm({ ...form, saveLabel: e.target.value })} />
          </Field>

          {pkgLocale === "en" ? (
            <Field label="Description (optional)">
              <input className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
          ) : (
            <Field label="Description (ES)" hint="Falls back to English if blank">
              <input className={inputClass} value={form.descriptionEs} onChange={(e) => setForm({ ...form, descriptionEs: e.target.value })} />
            </Field>
          )}
          <Field label="Sort order" hint="Lower = appears first">
            <input type="number" className={inputClass} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
          </Field>

          <Field label="Active">
            <button type="button" onClick={() => setForm({ ...form, isActive: !form.isActive })}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] font-semibold transition ${
                form.isActive ? "border-[#5D3FD3] bg-[#EDE9FB] text-[#5D3FD3]" : "border-[#1A1B23]/15 bg-white text-[#1A1B23]/65"
              }`}
            >
              {form.isActive ? <CheckCircle2 className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              {form.isActive ? "Active" : "Hidden"}
            </button>
          </Field>
          <Field label='"Most Popular" badge'>
            <button type="button" onClick={() => setForm({ ...form, popular: !form.popular })}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] font-semibold transition ${
                form.popular ? "border-[#5D3FD3] bg-[#EDE9FB] text-[#5D3FD3]" : "border-[#1A1B23]/15 bg-white text-[#1A1B23]/65"
              }`}
            >
              <Star className={`h-4 w-4 ${form.popular ? "fill-[#5D3FD3]" : ""}`} />
              {form.popular ? "Showing Most Popular" : "No badge"}
            </button>
          </Field>
        </div>

        {/* ── Per-feature inclusion matrix ───────────────────────────── */}
        {features.length > 0 && (
          <div className="mt-5 rounded-xl border border-[#1A1B23]/12 bg-[#fafafa] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h5 className="inline-flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#5D3FD3]">
                <CheckCircle2 className="h-3.5 w-3.5" /> Included features ({includedSet.size}/{features.length})
              </h5>
              <div className="flex items-center gap-1">
                <button type="button"
                  onClick={() => setIncludedSet(new Set(features.map((f) => f.id)))}
                  className="rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-[#5D3FD3] hover:bg-[#EDE9FB]"
                >
                  All
                </button>
                <button type="button"
                  onClick={() => setIncludedSet(new Set())}
                  className="rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-[#1A1B23]/65 hover:bg-[#f5eff6]"
                >
                  None
                </button>
              </div>
            </div>
            <ul className="grid max-h-72 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
              {features.map((f) => {
                const checked = includedSet.has(f.id)
                return (
                  <li key={f.id}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-white px-3 py-2 text-[12px] leading-snug transition hover:bg-[#EDE9FB]/50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleFeature(f.id)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#5D3FD3]/40 text-[#5D3FD3] accent-[#5D3FD3]"
                      />
                      <span className={checked ? "text-[#5D3FD3]" : "text-[#1A1B23]/75"}>
                        {f.featureText}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <div className="mt-3 flex items-center justify-end gap-2">
          <button type="button" onClick={() => setEditing(false)}
            className="rounded-xl border border-[#5D3FD3]/20 bg-white px-3 py-2 text-[12px] font-semibold text-[#5D3FD3] transition hover:bg-[#EDE9FB]"
          >
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#5D3FD3] px-4 py-2 text-[12px] font-semibold text-white shadow-[0_8px_22px_rgba(93,63,211,0.25)] transition hover:bg-[#4A2EAB] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
          </button>
        </div>
      </div>
    )
  }

  const includedCount = (pkg.featureSlots || []).length

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#1A1B23]/12 bg-white p-3.5 transition hover:border-[#5D3FD3]/20">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-[13.5px] font-bold text-[#5D3FD3]">{pkg.name}</h4>
          {pkg.tierKey && (
            <span className="rounded-full bg-[#EDE9FB] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#5D3FD3]">
              {pkg.tierKey}
            </span>
          )}
          {pkg.popular && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#5D3FD3] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              <Star className="h-2.5 w-2.5 fill-white" /> Popular
            </span>
          )}
          {!pkg.isActive && (
            <span className="rounded-full bg-[#f2f2f2] px-2 py-0.5 text-[10px] font-semibold text-[#666]">Hidden</span>
          )}
          {features.length > 0 && (
            <span className="font-mono text-[10px] tabular-nums text-[#1A1B23]/55">
              {includedCount}/{features.length} features
            </span>
          )}
          <span className="rounded-full bg-[#EDE9FB] px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-[#5D3FD3]">
            #{pkg.sortOrder ?? 0}
          </span>
        </div>
        {pkg.description && (
          <p className="mt-0.5 truncate text-[12px] text-[#1A1B23]/65">{pkg.description}</p>
        )}
        {pkg.saveLabel && (
          <p className="mt-0.5 text-[11px] font-semibold text-[#5D3FD3]">{pkg.saveLabel}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[14px] font-bold tabular-nums text-[#5D3FD3]">
          {fmtMoney(pkg.price, pkg.currency)}
        </span>
        <button type="button" onClick={() => setEditing(true)} aria-label="Edit plan" disabled={busy}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#5D3FD3] transition hover:bg-[#EDE9FB] disabled:opacity-50"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={handleDelete} aria-label="Delete plan" disabled={busy}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   Service expandable card (the workhorse)
   ════════════════════════════════════════════════════════════════════════ */
function ServiceCard({ service, onEdit, onDelete, onChanged }) {
  const { showSuccess, showError } = useToast()
  const [expanded, setExpanded] = useState(false)
  const [detail, setDetail] = useState(null) // full service with packages + features
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [newPackage, setNewPackage] = useState({ name: "", price: "", description: "" })
  const [newFeature, setNewFeature] = useState("")
  const [busy, setBusy] = useState(false)

  async function loadDetail() {
    setLoadingDetail(true)
    try {
      const res = await getAdminService(service.id)
      setDetail(res?.data || res)
    } catch (err) {
      showError(err?.message || "Could not load full service detail")
    } finally {
      setLoadingDetail(false)
    }
  }

  function toggleExpand() {
    const next = !expanded
    setExpanded(next)
    if (next && !detail) loadDetail()
  }

  async function handleAddPackage(e) {
    e.preventDefault()
    if (!newPackage.name.trim()) { showError("Plan name required"); return }
    const price = Number(newPackage.price)
    if (Number.isNaN(price) || price <= 0) { showError("Plan price must be > 0"); return }
    setBusy(true)
    try {
      await addAdminServicePackage(service.id, {
        name: newPackage.name.trim(),
        price,
        description: newPackage.description.trim() || null,
      })
      showSuccess(`Plan "${newPackage.name}" added`)
      setNewPackage({ name: "", price: "", description: "" })
      await loadDetail()
      onChanged?.()
    } catch (err) { showError(err?.message || "Could not add package") }
    finally { setBusy(false) }
  }

  async function handleAddFeature(e) {
    e.preventDefault()
    if (!newFeature.trim()) return
    setBusy(true)
    try {
      await addAdminServiceFeature(service.id, { featureText: newFeature.trim() })
      setNewFeature("")
      await loadDetail()
    } catch (err) { showError(err?.message || "Could not add feature") }
    finally { setBusy(false) }
  }

  async function handleRemoveFeature(featureId) {
    setBusy(true)
    try {
      await removeAdminServiceFeature(service.id, featureId)
      await loadDetail()
    } catch (err) { showError(err?.message || "Could not remove feature") }
    finally { setBusy(false) }
  }

  const packageCount = detail?.packages?.length ?? service?._count?.packages ?? service?.packages?.length ?? 0
  const featureCount = detail?.features?.length ?? service?._count?.features ?? 0

  return (
    <motion.article
      variants={fadeUp}
      className="overflow-hidden rounded-2xl border border-[#1A1B23]/10 bg-white shadow-[0_4px_18px_rgba(93,63,211,0.05)] transition hover:shadow-[0_8px_24px_rgba(93,63,211,0.08)]"
    >
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[16px] font-bold text-[#5D3FD3]">{service.title}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold capitalize ${statusTone(service.status)}`}>
              {service.status}
            </span>
            {service.isFeatured && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#5D3FD3] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                <Star className="h-2.5 w-2.5 fill-white" /> Featured
              </span>
            )}
          </div>
          <p className="mt-1 max-w-2xl truncate text-[12.5px] text-[#1A1B23]/70">
            {service.shortDescription}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[#1A1B23]/60">
            <span className="inline-flex items-center gap-1"><Tag className="h-3 w-3" /> {service.deliveryType}</span>
            <span className="inline-flex items-center gap-1"><Layers className="h-3 w-3" /> {packageCount} plan{packageCount === 1 ? "" : "s"}</span>
            <span className="font-mono">{fmtMoney(service.basePrice, service.currency)} base</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onEdit(service)} aria-label="Edit service"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#5D3FD3] transition hover:bg-[#EDE9FB]"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onDelete(service)} aria-label="Archive service"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-rose-600 transition hover:bg-rose-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={toggleExpand} aria-expanded={expanded} aria-label={expanded ? "Collapse" : "Expand"}
            className="inline-flex items-center gap-1 rounded-xl border border-[#5D3FD3]/20 bg-white px-3 py-2 text-[12px] font-semibold text-[#5D3FD3] transition hover:bg-[#EDE9FB]"
          >
            {expanded ? <>Hide <ChevronUp className="h-3.5 w-3.5" /></> : <>Manage <ChevronDown className="h-3.5 w-3.5" /></>}
          </button>
        </div>
      </header>

      {/* Expanded body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="border-t border-[#1A1B23]/10 bg-[#faf7fb]"
          >
            <div className="space-y-6 p-5">
              {loadingDetail ? (
                <div className="flex items-center justify-center gap-2 py-6 text-[13px] text-[#1A1B23]/55">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading detail…
                </div>
              ) : (
                <>
                  {/* ── Plans ────────────────────────────────────────── */}
                  <section>
                    <header className="mb-3 flex items-center justify-between">
                      <h4 className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-[#5D3FD3]">
                        <Layers className="h-3.5 w-3.5" /> Pricing plans
                      </h4>
                    </header>

                    <div className="flex flex-col gap-2.5">
                      {(detail?.packages || []).length === 0 ? (
                        <p className="rounded-xl border border-dashed border-[#1A1B23]/20 bg-white px-4 py-5 text-center text-[12.5px] text-[#1A1B23]/65">
                          No pricing plans yet. Add the first plan below.
                        </p>
                      ) : (
                        detail.packages.map((p) => (
                          <PackageRow
                            key={p.id}
                            serviceId={service.id}
                            pkg={p}
                            features={detail.features || []}
                            onChanged={loadDetail}
                          />
                        ))
                      )}
                    </div>

                    {/* Add new plan inline form */}
                    <form onSubmit={handleAddPackage} className="mt-3 grid gap-2 rounded-xl border border-dashed border-[#5D3FD3]/25 bg-white p-3.5 sm:grid-cols-[1.4fr_0.8fr_2fr_auto]">
                      <input className={inputClass} placeholder="Plan name" value={newPackage.name} onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })} />
                      <input className={inputClass} type="number" min="0" step="0.01" placeholder="Price" value={newPackage.price} onChange={(e) => setNewPackage({ ...newPackage, price: e.target.value })} />
                      <input className={inputClass} placeholder="Optional description" value={newPackage.description} onChange={(e) => setNewPackage({ ...newPackage, description: e.target.value })} />
                      <button type="submit" disabled={busy}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#5D3FD3] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#4A2EAB] disabled:opacity-60"
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add plan
                      </button>
                    </form>
                  </section>

                  {/* ── Features ─────────────────────────────────────── */}
                  <section>
                    <header className="mb-3 flex items-center justify-between">
                      <h4 className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-[#5D3FD3]">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Features ({featureCount})
                      </h4>
                    </header>

                    <ul className="flex flex-col gap-1.5">
                      {(detail?.features || []).length === 0 ? (
                        <li className="rounded-xl border border-dashed border-[#1A1B23]/20 bg-white px-4 py-4 text-center text-[12px] text-[#1A1B23]/60">
                          No features defined.
                        </li>
                      ) : detail.features.map((f) => (
                        <li key={f.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#1A1B23]/10 bg-white px-3.5 py-2.5">
                          <span className="flex min-w-0 items-center gap-2 text-[12.5px] text-[#1A1B23]/85">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#5D3FD3]" />
                            <span className="truncate">{f.featureText}</span>
                          </span>
                          <button type="button" onClick={() => handleRemoveFeature(f.id)} disabled={busy} aria-label="Remove feature"
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>

                    <form onSubmit={handleAddFeature} className="mt-2.5 flex items-center gap-2">
                      <input className={inputClass} placeholder="Add a feature line…" value={newFeature} onChange={(e) => setNewFeature(e.target.value)} />
                      <button type="submit" disabled={busy || !newFeature.trim()}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#5D3FD3] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#4A2EAB] disabled:opacity-60"
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add
                      </button>
                    </form>
                  </section>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   PAGE
   ════════════════════════════════════════════════════════════════════════ */
export default function AdminServicePlansPage() {
  const { showSuccess, showError } = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [q, setQ] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  async function load() {
    setLoading(true); setError("")
    try {
      const res = await listAdminServices({ limit: 100 })
      const arr = res?.data?.services || res?.services || res?.data || []
      setItems(Array.isArray(arr) ? arr : [])
    } catch (err) {
      setError(err?.message || "Could not load services.")
      showError?.(err?.message || "Could not load services.", "Load failed")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return items.filter((s) => {
      if (statusFilter && s.status !== statusFilter) return false
      if (!needle) return true
      return (
        s.title?.toLowerCase().includes(needle) ||
        s.slug?.toLowerCase().includes(needle) ||
        s.shortDescription?.toLowerCase().includes(needle)
      )
    })
  }, [items, q, statusFilter])

  function handleCreate() { setEditing(null); setModalOpen(true) }
  function handleEdit(s) { setEditing(s); setModalOpen(true) }

  async function handleDelete(svc) {
    if (!window.confirm(`Archive service "${svc.title}"?\nHistorical orders and downloads will be preserved.`)) return
    try {
      await deleteAdminService(svc.id)
      showSuccess(`"${svc.title}" archived`)
      await load()
    } catch (err) {
      showError(err?.message || "Could not archive service")
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EDE9FB] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5D3FD3]">
            <Briefcase className="h-3 w-3" /> Catalogue
          </span>
          <h1 className="mt-2 text-[24px] font-bold text-[#5D3FD3] sm:text-[28px]">Services & pricing plans</h1>
          <p className="mt-1 max-w-2xl text-[13px] text-[#1A1B23]/70">
            Add, edit, or archive the services and pricing plans displayed on the public Services page. Changes are visible immediately on the website.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#5D3FD3]/20 bg-white px-3.5 py-2.5 text-[12.5px] font-semibold text-[#5D3FD3] transition hover:bg-[#EDE9FB]"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button type="button" onClick={handleCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#5D3FD3] px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_8px_22px_rgba(93,63,211,0.25)] transition hover:bg-[#4A2EAB]"
          >
            <Plus className="h-4 w-4" /> New service
          </button>
        </div>
      </header>

      {/* ── Filters ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#1A1B23]/10 bg-white p-3 shadow-[0_2px_10px_rgba(93,63,211,0.04)]">
        <input
          type="search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search by title, slug, or description…"
          className={`${inputClass} flex-1 min-w-[220px]`}
        />
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setStatusFilter("")}
            className={`rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition ${statusFilter === "" ? "bg-[#5D3FD3] text-white" : "bg-[#EDE9FB] text-[#5D3FD3] hover:bg-[#DCD4F4]"}`}
          >
            All
          </button>
          {STATUSES.map((s) => (
            <button key={s} type="button" onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1.5 text-[11.5px] font-semibold capitalize transition ${statusFilter === s ? "bg-[#5D3FD3] text-white" : "bg-[#EDE9FB] text-[#5D3FD3] hover:bg-[#DCD4F4]"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Errors / Loading / Empty / List ─────────────────────────── */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-[#f5eff6]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#1A1B23]/20 bg-white p-10 text-center">
          <Briefcase className="mx-auto h-7 w-7 text-[#1A1B23]/40" />
          <h2 className="mt-3 text-[15px] font-bold text-[#5D3FD3]">No services match your filters</h2>
          <p className="mt-1 text-[12.5px] text-[#1A1B23]/60">
            {items.length === 0 ? "Create your first service to get started." : "Try clearing the search or status filter."}
          </p>
          {items.length === 0 && (
            <button type="button" onClick={handleCreate}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#5D3FD3] px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_8px_22px_rgba(93,63,211,0.25)] transition hover:bg-[#4A2EAB]"
            >
              <Plus className="h-4 w-4" /> Create first service
            </button>
          )}
        </div>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-3">
          {filtered.map((s) => (
            <ServiceCard key={s.id} service={s} onEdit={handleEdit} onDelete={handleDelete} onChanged={load} />
          ))}
        </motion.div>
      )}

      {/* ── Modal ──────────────────────────────────────────────────── */}
      <ServiceModal open={modalOpen} onClose={() => setModalOpen(false)} initial={editing} onSaved={load} />
    </div>
  )
}
