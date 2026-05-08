import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { motion, AnimatePresence } from "framer-motion"
import {
  MapPin, Plus, Pencil, Trash2, Star, X, AlertCircle,
  Home as HomeIcon, Building2, Check,
} from "lucide-react"
import {
  fetchAddresses, createAddress, updateAddress, deleteAddress, setAddressDefault,
  COUNTRY_OPTIONS,
} from "../services/addressService"
import { useToast } from "../context/ToastContext"
import { EmptyState, SectionCard, SkeletonCard } from "../components/ui/index"

/* I18N · Phase 119C — strings keyed under `dashboard.addresses.*`. The
 * AddressFormModal scopes its own useTranslation hook so all field
 * labels and placeholders translate. The Field sub-component receives
 * already-translated strings via props. */

const EMPTY_FORM = {
  label: "",
  fullName: "",
  company: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "MX",
  taxId: "",
  phone: "",
  isDefault: false,
}

export default function DashboardAddressesPage() {
  const { t } = useTranslation("dashboard")
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const { showSuccess, showError } = useToast()

  async function load() {
    setLoading(true); setError("")
    try {
      setItems(await fetchAddresses())
    } catch (err) {
      setError(err?.message || t("addresses.errors.load"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  async function handleSetDefault(address) {
    if (address.isDefault) return
    const prev = items
    setItems((current) => current.map((a) => ({ ...a, isDefault: a.id === address.id })))
    try {
      await setAddressDefault(address.id)
      showSuccess(t("addresses.toast.defaultUpdated"))
    } catch (err) {
      setItems(prev)
      showError(err?.message || t("addresses.errors.setDefault"))
    }
  }

  async function handleDelete(address) {
    if (!confirm(t("addresses.toast.deleteConfirm", { label: address.label || address.line1 }))) return

    setDeletingId(address.id)
    const prev = items
    setItems((current) => current.filter((a) => a.id !== address.id))
    try {
      await deleteAddress(address.id)
      showSuccess(t("addresses.toast.removed"))
    } catch (err) {
      setItems(prev)
      showError(err?.message || t("addresses.errors.delete"))
    } finally {
      setDeletingId(null)
    }
  }

  function handleSaved(saved, wasNew) {
    if (wasNew) {
      setItems((current) => {
        const others = saved.isDefault
          ? current.map((a) => ({ ...a, isDefault: false }))
          : current
        return [saved, ...others]
      })
    } else {
      setItems((current) => current.map((a) => {
        if (a.id === saved.id) return saved
        if (saved.isDefault) return { ...a, isDefault: false }
        return a
      }))
    }
    setEditing(null)
  }

  if (loading) {
    return (
      <section className="space-y-5">
        <SkeletonCard height="h-[80px]" />
        {[1, 2, 3].map((i) => <SkeletonCard key={i} height="h-[150px]" />)}
      </section>
    )
  }

  const sectionSubtitle = `${t("addresses.section.savedCount", { count: items.length })} · ${
    items.filter((a) => a.isDefault).length
      ? t("addresses.section.defaultSet")
      : t("addresses.section.noDefaultSet")
  }`

  return (
    <>
      {editing && (
        <AddressFormModal
          address={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      <section className="space-y-5">
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-meta text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Intro */}
        <div className="rounded-xl border border-charcoal-80/10 bg-white p-5 shadow-[0_4px_16px_rgba(93,63,211,0.04)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-violet-pale px-3 py-1 text-micro font-semibold uppercase tracking-[0.1em] text-violet">
                <MapPin className="h-3 w-3" /> {t("addresses.intro.savedLocations")}
              </div>
              <h2 className="mt-3 text-subsection font-bold text-violet">{t("addresses.intro.title")}</h2>
              <p className="mt-1 text-meta text-charcoal-80/70">
                {t("addresses.intro.body")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditing("new")}
              className="inline-flex items-center gap-2 rounded-xl bg-violet px-4 py-2.5 text-meta font-semibold text-white shadow-[0_6px_18px_rgba(93,63,211,0.18)] transition hover:-translate-y-0.5 hover:bg-violet-deep"
            >
              <Plus className="h-4 w-4" /> {t("addresses.intro.addAddress")}
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title={t("addresses.empty.title")}
            description={t("addresses.empty.body")}
            action={
              <button
                type="button"
                onClick={() => setEditing("new")}
                className="inline-flex items-center gap-2 rounded-xl bg-violet px-4 py-2.5 text-meta font-semibold text-white hover:bg-violet-deep"
              >
                <Plus className="h-4 w-4" /> {t("addresses.empty.addFirst")}
              </button>
            }
          />
        ) : (
          <SectionCard
            title={t("addresses.section.title")}
            subtitle={sectionSubtitle}
          >
            <div className="space-y-3">
              <AnimatePresence>
                {items.map((address) => (
                  <motion.div
                    key={address.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.22 }}
                  >
                    <AddressRow
                      address={address}
                      onEdit={() => setEditing(address)}
                      onDelete={() => handleDelete(address)}
                      onSetDefault={() => handleSetDefault(address)}
                      isDeleting={deletingId === address.id}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </SectionCard>
        )}
      </section>
    </>
  )
}

function AddressRow({ address, onEdit, onDelete, onSetDefault, isDeleting }) {
  const { t } = useTranslation("dashboard")
  const Icon = /office|work|company/i.test(address.label || "") ? Building2 : HomeIcon
  const countryName = COUNTRY_OPTIONS.find((c) => c.code === address.country)?.name || address.country

  return (
    <div className={`flex flex-col gap-3 rounded-xl border p-4 transition md:flex-row md:items-start md:justify-between ${
      address.isDefault ? "border-violet/30 bg-[#F5F2FE]" : "border-charcoal-80/10 bg-[#fafafa]"
    }`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          address.isDefault ? "bg-violet text-white" : "bg-violet-pale text-violet"
        }`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-meta font-semibold text-violet">
              {address.label || t("addresses.row.fallbackLabel")}
            </div>
            {address.isDefault && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet px-2 py-0.5 text-micro font-bold uppercase tracking-wider text-white">
                <Star className="h-2.5 w-2.5 fill-current" /> {t("addresses.row.default")}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-meta font-medium text-charcoal">
            {address.fullName}
            {address.company && <span className="text-charcoal-80/60"> · {address.company}</span>}
          </div>
          <div className="mt-1 text-micro leading-5 text-charcoal-80/70">
            {address.line1}{address.line2 ? `, ${address.line2}` : ""}<br />
            {[address.city, address.state, address.postalCode].filter(Boolean).join(", ")}<br />
            {countryName}
            {address.phone && <> · {address.phone}</>}
            {address.taxId && <> · {t("addresses.row.taxIdPrefix")} {address.taxId}</>}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {!address.isDefault && (
          <button
            type="button"
            onClick={onSetDefault}
            className="inline-flex items-center gap-1 rounded-lg border border-violet/15 px-3 py-2 text-micro font-medium text-violet transition hover:bg-violet-pale"
          >
            <Star className="h-3.5 w-3.5" /> {t("addresses.row.setDefault")}
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 rounded-lg border border-charcoal-80/15 px-3 py-2 text-micro font-medium text-charcoal-80 transition hover:bg-[#f4eef6] hover:text-violet"
        >
          <Pencil className="h-3.5 w-3.5" /> {t("addresses.row.edit")}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          className="inline-flex items-center justify-center rounded-lg border border-charcoal-80/15 px-3 py-2 text-micro font-medium text-charcoal-80 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
          aria-label={t("addresses.row.deleteAria")}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

function AddressFormModal({ address, onClose, onSaved }) {
  const { t } = useTranslation("dashboard")
  const isEdit = Boolean(address?.id)
  const [form, setForm] = useState(() => (address ? { ...EMPTY_FORM, ...address } : { ...EMPTY_FORM }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    setError(""); setSaving(true)
    try {
      const payload = { ...form }
      for (const k of Object.keys(payload)) {
        if (typeof payload[k] === "string") payload[k] = payload[k].trim()
      }
      const saved = isEdit
        ? await updateAddress(address.id, payload)
        : await createAddress(payload)
      onSaved(saved, !isEdit)
    } catch (err) {
      setError(err?.message || t("addresses.errors.save"))
    } finally {
      setSaving(false)
    }
  }

  const isMexico = form.country === "MX"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="flex w-full max-w-[640px] flex-col rounded-xl border border-charcoal-80/10 bg-white shadow-[0_30px_80px_rgba(93,63,211,0.18)]" style={{ maxHeight: "92vh" }}>
        <div className="flex items-center justify-between border-b border-charcoal-80/10 px-6 py-4">
          <div>
            <h2 className="text-card font-bold text-violet">
              {isEdit ? t("addresses.form.titleEdit") : t("addresses.form.titleAdd")}
            </h2>
            <p className="text-micro text-charcoal-80/60">
              {isEdit ? t("addresses.form.subtitleEdit") : t("addresses.form.subtitleAdd")}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-charcoal-80/10 p-2 text-charcoal-80/50 transition hover:bg-[#f4eef6]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-micro text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("addresses.form.labels.label")}     placeholder={t("addresses.form.placeholders.label")}     value={form.label}    onChange={(v) => update("label", v)} />
            <Field label={t("addresses.form.labels.fullName")}  placeholder={t("addresses.form.placeholders.fullName")}  value={form.fullName} onChange={(v) => update("fullName", v)} />
            <Field label={t("addresses.form.labels.company")}   placeholder={t("addresses.form.placeholders.company")}   value={form.company}  onChange={(v) => update("company", v)}  className="sm:col-span-2" />
            <Field label={t("addresses.form.labels.line1")}     placeholder={t("addresses.form.placeholders.line1")}     value={form.line1}    onChange={(v) => update("line1", v)}    className="sm:col-span-2" />
            <Field label={t("addresses.form.labels.line2")}     placeholder={t("addresses.form.placeholders.line2")}     value={form.line2}    onChange={(v) => update("line2", v)}    className="sm:col-span-2" />
            <Field label={t("addresses.form.labels.city")}      placeholder={t("addresses.form.placeholders.city")}      value={form.city}     onChange={(v) => update("city", v)} />
            <Field label={t("addresses.form.labels.state")}     placeholder={t("addresses.form.placeholders.state")}     value={form.state}    onChange={(v) => update("state", v)} />
            <Field label={t("addresses.form.labels.postalCode")} placeholder={t("addresses.form.placeholders.postalCode")} value={form.postalCode} onChange={(v) => update("postalCode", v)} />

            <div>
              <label className="mb-1.5 block text-micro font-semibold text-violet">{t("addresses.form.labels.country")}</label>
              <select
                value={form.country}
                onChange={(e) => update("country", e.target.value)}
                className="w-full rounded-xl border border-charcoal-80/20 bg-[#fafafa] px-4 py-3 text-meta text-violet outline-none focus:border-violet/40"
              >
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>

            <Field label={t("addresses.form.labels.phone")} placeholder={t("addresses.form.placeholders.phone")} value={form.phone} onChange={(v) => update("phone", v)} />

            {isMexico && (
              <Field
                label={t("addresses.form.labels.rfc")}
                placeholder={t("addresses.form.placeholders.rfc")}
                value={form.taxId}
                onChange={(v) => update("taxId", v.toUpperCase())}
                className="sm:col-span-2"
                hint={t("addresses.form.rfcHint")}
              />
            )}
            {!isMexico && (
              <Field
                label={t("addresses.form.labels.taxId")}
                placeholder={t("addresses.form.placeholders.taxId")}
                value={form.taxId}
                onChange={(v) => update("taxId", v)}
                className="sm:col-span-2"
              />
            )}

            <div className="sm:col-span-2">
              <label className="flex items-start gap-3 cursor-pointer text-meta font-medium text-violet">
                <input
                  type="checkbox"
                  checked={Boolean(form.isDefault)}
                  onChange={(e) => update("isDefault", e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-violet"
                />
                {t("addresses.form.useAsDefault")}
              </label>
            </div>
          </div>
        </div>

        <div className="flex gap-3 border-t border-charcoal-80/10 px-6 py-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet py-3 text-meta font-semibold text-white transition hover:bg-violet-deep disabled:opacity-60"
          >
            <Check className="h-4 w-4" />
            {saving ? t("addresses.form.saving") : (isEdit ? t("addresses.form.saveChanges") : t("addresses.form.addAddress"))}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-charcoal-80/15 px-5 py-3 text-meta font-medium text-charcoal-80 transition hover:bg-[#f4eef6]"
          >
            {t("addresses.form.cancel")}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, hint, className = "" }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-micro font-semibold text-violet">{label}</label>
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-charcoal-80/20 bg-[#fafafa] px-4 py-3 text-meta text-violet outline-none focus:border-violet/40"
      />
      {hint && <p className="mt-1 text-micro text-charcoal-80/55">{hint}</p>}
    </div>
  )
}
