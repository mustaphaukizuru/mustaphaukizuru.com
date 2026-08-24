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
     · Brand tokens: var(--color-violet) + var(--color-charcoal), framer-motion fade/stagger, Lucide
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react"
import { m, AnimatePresence } from "framer-motion"
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
import { Modal } from "../components/ui"
import useForm from "../hooks/useForm"
import { serviceSchema } from "../lib/validation/servicePlan"
import {
  TextField, TextAreaField, SelectField, NumberField, FormErrorBanner, FormActions, ConfirmModal,
} from "../components/admin/forms"

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
    case "published": return "bg-mint-100 text-mint-800"
    case "draft": return "bg-amber/15 text-amber-700"
    case "archived": return "bg-slate-100 text-steel-700"
    default: return "bg-violet-pale text-violet"
  }
}

const fadeUp = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } }

/* ── Reusable form atoms ────────────────────────────────────────────────── */

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

const inputClass =
  "w-full rounded-xl border border-charcoal/15 bg-white px-3.5 py-2.5 text-[13px] text-violet outline-none transition focus:border-violet focus:ring-2 focus:ring-violet/10"

/* ════════════════════════════════════════════════════════════════════════
   Service CRUD modal
   ════════════════════════════════════════════════════════════════════════ */
function ServiceModal({ open, onClose, initial, onSaved }) {
  const { showSuccess, showError } = useToast()
  const isEdit = Boolean(initial?.id)
  // Remount the inner form whenever the modal opens for a different record so
  // useForm picks up fresh initial values.
  const formKey = `${open ? "open" : "closed"}-${initial?.id || "new"}`

  return (
    <Modal open={open} onClose={onClose} size="xl" title={isEdit ? "Edit service" : "Create a new service"}>
      {open && (
        <ServiceForm key={formKey} initial={initial} isEdit={isEdit} onClose={onClose} onSaved={onSaved} showSuccess={showSuccess} showError={showError} />
      )}
    </Modal>
  )
}

/* I18N06 · Bilingual form. The form carries EN + ES side-by-side so the admin
 * can flip between locales without leaving the screen. The save payload always
 * sends both — Spanish "" is sent as null so a translation can be cleared back
 * to "fall through to English". */
function ServiceForm({ initial, isEdit, onClose, onSaved, showSuccess, showError }) {
  const [locale, setLocale] = useState("en")
  const form = useForm({
    schema: serviceSchema,
    initialValues: {
      title: initial?.title || "",
      slug: initial?.slug || "",
      shortDescription: initial?.shortDescription || "",
      fullDescription: initial?.fullDescription || "",
      basePrice: String(initial?.basePrice ?? "0"),
      currency: initial?.currency || "MXN",
      deliveryType: initial?.deliveryType || "consultation",
      status: initial?.status || "draft",
      isFeatured: Boolean(initial?.isFeatured),
      isBookable: Boolean(initial?.isBookable),
      audienceCode: initial?.audienceCode || "",
      metaTitle: initial?.metaTitle || "",
      metaDescription: initial?.metaDescription || "",
      titleEs:            initial?.titleEs            || "",
      shortDescriptionEs: initial?.shortDescriptionEs || "",
      descriptionEs:      initial?.descriptionEs      || "",
      metaTitleEs:        initial?.metaTitleEs        || "",
      metaDescriptionEs:  initial?.metaDescriptionEs  || "",
    },
    onSubmit: async (parsed) => {
      const payload = { ...parsed, isBookable: Boolean(parsed.isBookable) }
      // Optional structural fields: omit when blank (except audienceCode → null so it can be cleared).
      if (!payload.slug) delete payload.slug
      if (!payload.fullDescription) delete payload.fullDescription
      if (!payload.metaTitle) delete payload.metaTitle
      if (!payload.metaDescription) delete payload.metaDescription
      try {
        const result = isEdit
          ? await updateAdminService(initial.id, payload)
          : await createAdminService(payload)
        const saved = result?.data || result
        showSuccess(isEdit ? `Service "${saved.title}" updated` : `Service "${saved.title}" created`)
        onSaved?.(saved)
        onClose()
      } catch (err) {
        showError?.(err?.message || "Could not save the service.", "Save failed")
        throw err
      }
    },
  })
  const f = form.values

  return (
    <form onSubmit={form.handleSubmit} noValidate className="flex flex-col">
      <div className="mb-5 flex items-center justify-between rounded-xl border border-charcoal/12 bg-violet-pale/40 px-3 py-2.5">
        <div className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-charcoal/60">
          <span aria-hidden="true">Locale</span>
        </div>
        <div role="tablist" aria-label="Edit locale" className="inline-flex items-center gap-1 rounded-lg bg-white p-1 shadow-[inset_0_0_0_1px_rgb(var(--color-charcoal-rgb)/0.08)]">
          {["en", "es"].map((loc) => (
            <button
              key={loc}
              type="button"
              role="tab"
              aria-selected={locale === loc}
              onClick={() => setLocale(loc)}
              className={`rounded-md px-3 py-1.5 text-[11.5px] font-bold uppercase tracking-wide transition focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-violet/35 ${
                locale === loc ? "bg-violet text-white shadow-[0_2px_6px_rgb(var(--color-violet-rgb)/0.25)]" : "text-charcoal/65 hover:text-violet"
              }`}
            >
              {loc.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {locale === "en"
          ? <TextField form={form} name="title" label="Title" required placeholder="e.g., Personal Brand Build" />
          : <TextField form={form} name="titleEs" label="Title (ES)" hint="Falls back to English if blank" placeholder="ej., Construcción de marca personal" />}
        <TextField form={form} name="slug" label="Slug" hint="Auto-generated · shared across locales" mono placeholder="personal-brand-build" />

        {locale === "en"
          ? <TextField form={form} name="shortDescription" label="Short description" required placeholder="One-sentence positioning" />
          : <TextField form={form} name="shortDescriptionEs" label="Short description (ES)" hint="Falls back to English if blank" placeholder="Posicionamiento en una frase" />}
        <SelectField form={form} name="status" label="Status" hint="Shared across locales" options={STATUSES} />

        {locale === "en"
          ? <TextAreaField form={form} name="fullDescription" label="Full description" hint="Long-form copy for the public service page" rows={4} />
          : <TextAreaField form={form} name="descriptionEs" label="Full description (ES)" hint="Texto largo para la página pública del servicio" rows={4} />}
        <SelectField form={form} name="deliveryType" label="Delivery type" options={DELIVERY} />

        <NumberField form={form} name="basePrice" label="Base price" hint="Used as fallback when no Package is selected" min="0" step="0.01" />
        <SelectField form={form} name="currency" label="Currency" options={CURRENCIES} />

        <Field label="Featured">
          <button type="button" onClick={() => form.setValue("isFeatured", !f.isFeatured)}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] font-semibold transition ${
              f.isFeatured ? "border-violet bg-violet-pale text-violet" : "border-charcoal/15 bg-white text-charcoal/65 hover:text-violet"
            }`}
          >
            <Star className={`h-4 w-4 ${f.isFeatured ? "fill-violet" : ""}`} />
            {f.isFeatured ? "Featured" : "Not featured"}
          </button>
        </Field>
        <Field label="Bookable">
          <button type="button" onClick={() => form.setValue("isBookable", !f.isBookable)}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] font-semibold transition ${
              f.isBookable ? "border-violet bg-violet-pale text-violet" : "border-charcoal/15 bg-white text-charcoal/65 hover:text-violet"
            }`}
          >
            {f.isBookable ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {f.isBookable ? "Visible on booking calendar" : "Hidden from booking"}
          </button>
        </Field>

        <SelectField form={form} name="audienceCode" label="Audience" hint="Tag a service so it appears in the public Choose-Your-Plan matrix" options={AUDIENCE_OPTIONS} />
        <div /> {/* spacer for grid alignment */}

        {locale === "en"
          ? <TextField form={form} name="metaTitle" label="Meta title" hint="Optional · SEO" />
          : <TextField form={form} name="metaTitleEs" label="Meta title (ES)" hint="Opcional · SEO en español" />}
        {locale === "en"
          ? <TextField form={form} name="metaDescription" label="Meta description" hint="Optional · SEO" />
          : <TextField form={form} name="metaDescriptionEs" label="Meta description (ES)" hint="Opcional · SEO en español" />}
      </div>

      <div className="mt-4">
        <FormErrorBanner message={form.formError} />
      </div>
      <FormActions onCancel={onClose} saving={form.submitting} saveLabel={isEdit ? "Save changes" : "Create service"} />
    </form>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   Package row (inline editable)
   ════════════════════════════════════════════════════════════════════════ */
function PackageRow({ serviceId, pkg, features = [], onChanged }) {
  const { showSuccess, showError } = useToast()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
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

  function handleDelete() { setConfirmDelete(true) }

  async function performDelete() {
    setBusy(true)
    try {
      await removeAdminServicePackage(serviceId, pkg.id)
      showSuccess(`Plan "${pkg.name}" removed`)
      setConfirmDelete(false)
      onChanged?.()
    } catch (err) { showError(err?.message || "Could not delete package") }
    finally { setBusy(false) }
  }

  const deleteConfirm = (
    <ConfirmModal
      open={confirmDelete}
      onClose={() => setConfirmDelete(false)}
      onConfirm={performDelete}
      busy={busy}
      title={`Delete plan "${pkg.name}"?`}
      confirmLabel="Delete"
      tone="danger"
    >
      <p className="text-sm text-charcoal-80">If this plan was already purchased, it will be deactivated to preserve order history.</p>
    </ConfirmModal>
  )

  if (editing) {
    return (
      <div className="rounded-xl border border-violet/20 bg-white p-4 shadow-[0_4px_14px_rgb(var(--color-violet-rgb)/0.06)]">
        {/* I18N06 · Compact locale toggle — only swaps Plan name + Description.
            Pricing, tier, period, popular, save-label and inclusion matrix
            stay structural and shared across locales. */}
        <div className="mb-3 flex items-center justify-between rounded-lg border border-charcoal/10 bg-violet-pale/40 px-2.5 py-1.5">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-charcoal/55">
            Locale
          </span>
          <div role="tablist" aria-label="Edit package locale" className="inline-flex items-center gap-1 rounded-md bg-white p-0.5 shadow-[inset_0_0_0_1px_rgb(var(--color-charcoal-rgb)/0.08)]">
            <button
              type="button"
              role="tab"
              aria-selected={pkgLocale === "en"}
              onClick={() => setPkgLocale("en")}
              className={`rounded px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide transition focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-violet/35 ${
                pkgLocale === "en" ? "bg-violet text-white" : "text-charcoal/65 hover:text-violet"
              }`}
            >
              EN
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={pkgLocale === "es"}
              onClick={() => setPkgLocale("es")}
              className={`rounded px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide transition focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-violet/35 ${
                pkgLocale === "es" ? "bg-violet text-white" : "text-charcoal/65 hover:text-violet"
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
                form.isActive ? "border-violet bg-violet-pale text-violet" : "border-charcoal/15 bg-white text-charcoal/65"
              }`}
            >
              {form.isActive ? <CheckCircle2 className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              {form.isActive ? "Active" : "Hidden"}
            </button>
          </Field>
          <Field label='"Most Popular" badge'>
            <button type="button" onClick={() => setForm({ ...form, popular: !form.popular })}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] font-semibold transition ${
                form.popular ? "border-violet bg-violet-pale text-violet" : "border-charcoal/15 bg-white text-charcoal/65"
              }`}
            >
              <Star className={`h-4 w-4 ${form.popular ? "fill-violet" : ""}`} />
              {form.popular ? "Showing Most Popular" : "No badge"}
            </button>
          </Field>
        </div>

        {/* ── Per-feature inclusion matrix ───────────────────────────── */}
        {features.length > 0 && (
          <div className="mt-5 rounded-xl border border-charcoal/12 bg-mist p-4">
            <div className="mb-3 flex items-center justify-between">
              <h5 className="inline-flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-violet">
                <CheckCircle2 className="h-3.5 w-3.5" /> Included features ({includedSet.size}/{features.length})
              </h5>
              <div className="flex items-center gap-1">
                <button type="button"
                  onClick={() => setIncludedSet(new Set(features.map((f) => f.id)))}
                  className="rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-violet hover:bg-violet-pale"
                >
                  All
                </button>
                <button type="button"
                  onClick={() => setIncludedSet(new Set())}
                  className="rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-charcoal/65 hover:bg-violet-ghost"
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
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-white px-3 py-2 text-[12px] leading-snug transition hover:bg-violet-pale/50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleFeature(f.id)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-violet/40 text-violet accent-violet"
                      />
                      <span className={checked ? "text-violet" : "text-charcoal/75"}>
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
            className="rounded-xl border border-violet/20 bg-white px-3 py-2 text-[12px] font-semibold text-violet transition hover:bg-violet-pale"
          >
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet px-4 py-2 text-[12px] font-semibold text-white shadow-[0_8px_22px_rgb(var(--color-violet-rgb)/0.25)] transition hover:bg-violet-deep disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
          </button>
        </div>
      </div>
    )
  }

  const includedCount = (pkg.featureSlots || []).length

  return (
    <>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-charcoal/12 bg-white p-3.5 transition hover:border-violet/20">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-[13.5px] font-bold text-violet">{pkg.name}</h4>
          {pkg.tierKey && (
            <span className="rounded-full bg-violet-pale px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet">
              {pkg.tierKey}
            </span>
          )}
          {pkg.popular && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              <Star className="h-2.5 w-2.5 fill-white" /> Popular
            </span>
          )}
          {!pkg.isActive && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-steel-700">Hidden</span>
          )}
          {features.length > 0 && (
            <span className="font-mono text-[10px] tabular-nums text-charcoal/55">
              {includedCount}/{features.length} features
            </span>
          )}
          <span className="rounded-full bg-violet-pale px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-violet">
            #{pkg.sortOrder ?? 0}
          </span>
        </div>
        {pkg.description && (
          <p className="mt-0.5 truncate text-[12px] text-charcoal/65">{pkg.description}</p>
        )}
        {pkg.saveLabel && (
          <p className="mt-0.5 text-[11px] font-semibold text-violet">{pkg.saveLabel}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[14px] font-bold tabular-nums text-violet">
          {fmtMoney(pkg.price, pkg.currency)}
        </span>
        <button type="button" onClick={() => setEditing(true)} aria-label="Edit plan" disabled={busy}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-violet transition hover:bg-violet-pale disabled:opacity-50"
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
    {deleteConfirm}
    </>
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
    <m.article
      variants={fadeUp}
      className="overflow-hidden rounded-2xl border border-charcoal/10 bg-white shadow-[0_4px_18px_rgb(var(--color-violet-rgb)/0.05)] transition hover:shadow-[0_8px_24px_rgb(var(--color-violet-rgb)/0.08)]"
    >
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[16px] font-bold text-violet">{service.title}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold capitalize ${statusTone(service.status)}`}>
              {service.status}
            </span>
            {service.isFeatured && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                <Star className="h-2.5 w-2.5 fill-white" /> Featured
              </span>
            )}
          </div>
          <p className="mt-1 max-w-2xl truncate text-[12.5px] text-charcoal/70">
            {service.shortDescription}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-charcoal/60">
            <span className="inline-flex items-center gap-1"><Tag className="h-3 w-3" /> {service.deliveryType}</span>
            <span className="inline-flex items-center gap-1"><Layers className="h-3 w-3" /> {packageCount} plan{packageCount === 1 ? "" : "s"}</span>
            <span className="font-mono">{fmtMoney(service.basePrice, service.currency)} base</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onEdit(service)} aria-label="Edit service"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-violet transition hover:bg-violet-pale"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onDelete(service)} aria-label="Archive service"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-rose-600 transition hover:bg-rose-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={toggleExpand} aria-expanded={expanded} aria-label={expanded ? "Collapse" : "Expand"}
            className="inline-flex items-center gap-1 rounded-xl border border-violet/20 bg-white px-3 py-2 text-[12px] font-semibold text-violet transition hover:bg-violet-pale"
          >
            {expanded ? <>Hide <ChevronUp className="h-3.5 w-3.5" /></> : <>Manage <ChevronDown className="h-3.5 w-3.5" /></>}
          </button>
        </div>
      </header>

      {/* Expanded body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="border-t border-charcoal/10 bg-violet-pale/40"
          >
            <div className="space-y-6 p-5">
              {loadingDetail ? (
                <div className="flex items-center justify-center gap-2 py-6 text-[13px] text-charcoal/55">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading detail…
                </div>
              ) : (
                <>
                  {/* ── Plans ────────────────────────────────────────── */}
                  <section>
                    <header className="mb-3 flex items-center justify-between">
                      <h4 className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-violet">
                        <Layers className="h-3.5 w-3.5" /> Pricing plans
                      </h4>
                    </header>

                    <div className="flex flex-col gap-2.5">
                      {(detail?.packages || []).length === 0 ? (
                        <p className="rounded-xl border border-dashed border-charcoal/20 bg-white px-4 py-5 text-center text-[12.5px] text-charcoal/65">
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
                    <form onSubmit={handleAddPackage} className="mt-3 grid gap-2 rounded-xl border border-dashed border-violet/25 bg-white p-3.5 sm:grid-cols-[1.4fr_0.8fr_2fr_auto]">
                      <input className={inputClass} placeholder="Plan name" value={newPackage.name} onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })} />
                      <input className={inputClass} type="number" min="0" step="0.01" placeholder="Price" value={newPackage.price} onChange={(e) => setNewPackage({ ...newPackage, price: e.target.value })} />
                      <input className={inputClass} placeholder="Optional description" value={newPackage.description} onChange={(e) => setNewPackage({ ...newPackage, description: e.target.value })} />
                      <button type="submit" disabled={busy}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-violet-deep disabled:opacity-60"
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add plan
                      </button>
                    </form>
                  </section>

                  {/* ── Features ─────────────────────────────────────── */}
                  <section>
                    <header className="mb-3 flex items-center justify-between">
                      <h4 className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-violet">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Features ({featureCount})
                      </h4>
                    </header>

                    <ul className="flex flex-col gap-1.5">
                      {(detail?.features || []).length === 0 ? (
                        <li className="rounded-xl border border-dashed border-charcoal/20 bg-white px-4 py-4 text-center text-[12px] text-charcoal/60">
                          No features defined.
                        </li>
                      ) : detail.features.map((f) => (
                        <li key={f.id} className="flex items-center justify-between gap-3 rounded-xl border border-charcoal/10 bg-white px-3.5 py-2.5">
                          <span className="flex min-w-0 items-center gap-2 text-[12.5px] text-charcoal/85">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-violet" />
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
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-violet-deep disabled:opacity-60"
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add
                      </button>
                    </form>
                  </section>
                </>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </m.article>
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
  const [pendingArchive, setPendingArchive] = useState(null)
  const [archiving, setArchiving] = useState(false)

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

  useEffect(() => { load()   }, [])

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

  function handleDelete(svc) { setPendingArchive(svc) }

  async function confirmArchive() {
    const svc = pendingArchive
    if (!svc) return
    setArchiving(true)
    try {
      await deleteAdminService(svc.id)
      showSuccess(`"${svc.title}" archived`)
      setPendingArchive(null)
      await load()
    } catch (err) {
      showError(err?.message || "Could not archive service")
    } finally {
      setArchiving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-pale px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-violet">
            <Briefcase className="h-3 w-3" /> Catalogue
          </span>
          <h1 className="mt-2 text-[24px] font-bold text-violet sm:text-[28px]">Services & pricing plans</h1>
          <p className="mt-1 max-w-2xl text-[13px] text-charcoal/70">
            Add, edit, or archive the services and pricing plans displayed on the public Services page. Changes are visible immediately on the website.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load}
            className="inline-flex items-center gap-1.5 rounded-xl border border-violet/20 bg-white px-3.5 py-2.5 text-[12.5px] font-semibold text-violet transition hover:bg-violet-pale"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button type="button" onClick={handleCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_8px_22px_rgb(var(--color-violet-rgb)/0.25)] transition hover:bg-violet-deep"
          >
            <Plus className="h-4 w-4" /> New service
          </button>
        </div>
      </header>

      {/* ── Filters ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-charcoal/10 bg-white p-3 shadow-[0_2px_10px_rgb(var(--color-violet-rgb)/0.04)]">
        <input
          type="search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search by title, slug, or description…"
          className={`${inputClass} flex-1 min-w-[220px]`}
        />
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
      </div>

      {/* ── Errors / Loading / Empty / List ─────────────────────────── */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose/20 bg-rose/5 px-4 py-3 text-[13px] text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-violet-ghost" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-charcoal/20 bg-white p-10 text-center">
          <Briefcase className="mx-auto h-7 w-7 text-charcoal/40" />
          <h2 className="mt-3 text-[15px] font-bold text-violet">No services match your filters</h2>
          <p className="mt-1 text-[12.5px] text-charcoal/60">
            {items.length === 0 ? "Create your first service to get started." : "Try clearing the search or status filter."}
          </p>
          {items.length === 0 && (
            <button type="button" onClick={handleCreate}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-violet px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_8px_22px_rgb(var(--color-violet-rgb)/0.25)] transition hover:bg-violet-deep"
            >
              <Plus className="h-4 w-4" /> Create first service
            </button>
          )}
        </div>
      ) : (
        <m.div variants={stagger} initial="hidden" animate="show" className="grid gap-3">
          {filtered.map((s) => (
            <ServiceCard key={s.id} service={s} onEdit={handleEdit} onDelete={handleDelete} onChanged={load} />
          ))}
        </m.div>
      )}

      {/* ── Modal ──────────────────────────────────────────────────── */}
      <ServiceModal open={modalOpen} onClose={() => setModalOpen(false)} initial={editing} onSaved={load} />
      <ConfirmModal
        open={Boolean(pendingArchive)}
        onClose={() => setPendingArchive(null)}
        onConfirm={confirmArchive}
        busy={archiving}
        title={`Archive service "${pendingArchive?.title ?? ""}"?`}
        confirmLabel="Archive"
        tone="danger"
      >
        <p className="text-sm text-charcoal-80">Historical orders and downloads will be preserved.</p>
      </ConfirmModal>
    </div>
  )
}
