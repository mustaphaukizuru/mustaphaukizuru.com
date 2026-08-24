import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Mail, Pencil, AlertCircle, Eye, Send, X, FileCheck2,
} from "lucide-react"
import { authFetch } from "../lib/api"
import { useToast } from "../context/ToastContext"
import { useAuth } from "../context/AuthContext"
import { MetricCard, SkeletonCard } from "../components/ui/index"
import StatusPill from "../components/admin/StatusPill"
import {
  Field, FormInput, FormTextarea, inputClass,
} from "../components/admin/Field"
import useUnsavedChangesPrompt, { computeIsDirty } from "../hooks/useUnsavedChangesPrompt"

/* ──────────────────────────────────────────────────────────────────────────
 *  AdminEmailTemplatesPage · Batch 6B-5
 *
 *  Template editor with preview + test send. The list pattern is preserved
 *  (templates are a fixed set, not a CRUD list — each template is bound to
 *  a platform event). Modals get full primitive + accessibility treatment.
 *
 *  What changed:
 *    - TemplateCard uses StatusPill (active/inactive) instead of bespoke pill
 *    - Bespoke section header replaced with simple page intro
 *    - EditModal refactored to use Field + FormInput + FormTextarea
 *    - EditModal: role=dialog, aria-modal, ESC dismiss, dirty tracking,
 *      unsaved-changes prompt, backdrop click confirms
 *    - PreviewModal: role=dialog, aria-modal, ESC dismiss
 *    - TestModal: role=dialog, aria-modal, ESC dismiss, FormInput primitive,
 *      email validation surfaces inline
 *    - Mojibake "..." replaced with proper Unicode "\u2026"
 *    - 3 metric cards: Total templates, Active, Inactive
 *    - Search added (filter by name, key, or subject)
 *
 *  Preserved verbatim:
 *    - All authFetch endpoints (/api/admin/email-templates, /:id, /:id/test)
 *    - TEMPLATE_VARIABLES taxonomy (13 seeded templates)
 *    - Edit/Preview/Test 3-button row
 *    - useAuth() for default test recipient
 *  ──────────────────────────────────────────────────────────────────── */

// Variable hint map · MUST stay in sync with prisma/seed-email-templates.js.
// Keys are the dot.case template keys actually present in the EmailTemplate
// table. The arrays list every {{ }} placeholder consumed by that template's
// HTML/text body — so admins can copy-paste the right tokens.
//
// {{year}} is auto-injected by emailService at send time and is omitted
// from the per-template list to keep the hint section uncluttered.
const TEMPLATE_VARIABLES = {
  "auth.welcome": ["{{customerName}}", "{{dashboardUrl}}"],
  "auth.password-reset": ["{{customerName}}", "{{resetUrl}}"],
  "auth.account-claim": ["{{customerName}}", "{{orderNumber}}", "{{claimUrl}}"],
  "order.placed": ["{{customerName}}", "{{orderNumber}}", "{{orderTotal}}", "{{orderUrl}}"],
  "order.confirmed": ["{{customerName}}", "{{orderNumber}}", "{{orderTotal}}", "{{orderUrl}}", "{{gateway}}"],
  "order.refunded": ["{{customerName}}", "{{orderNumber}}", "{{orderTotal}}", "{{orderUrl}}"],
  "download.ready": ["{{customerName}}", "{{productTitle}}", "{{downloadUrl}}"],
  "contact.admin": ["{{name}}", "{{email}}", "{{subject}}", "{{message}}"],
  "contact.confirm": ["{{name}}"],
  "newsletter.confirm": ["{{customerName}}", "{{confirmUrl}}", "{{unsubscribeUrl}}"],
  "support.reply": ["{{customerName}}", "{{orderNumber}}", "{{message}}", "{{supportTicketUrl}}"],
}

/* ──────────────────────────────────────────────────────────────────────── */

function TemplateCard({ template, onEdit, onPreview, onTest }) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-charcoal-80/10 bg-white p-4 shadow-[0_4px_16px_rgba(93,63,211,0.04)] transition hover:border-violet/20 hover:shadow-[0_8px_20px_rgba(93,63,211,0.08)] md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-pale text-violet">
          <Mail className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-meta font-bold text-violet">{template.name || template.key}</div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-charcoal-80/60">{template.key}</div>
          {template.subject && (
            <div className="mt-1 truncate text-micro text-charcoal-80/55" title={template.subject}>
              <span className="font-mono text-[10px] uppercase tracking-wider">Subject:</span>{" "}
              {template.subject}
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <StatusPill status={template.isActive !== false ? "active" : "inactive"} />

        <button
          type="button"
          onClick={() => onTest(template)}
          aria-label={`Send test email for ${template.name || template.key}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal-80/12 bg-white px-3 py-1.5 text-micro font-semibold text-charcoal-80/85 transition hover:border-violet/20 hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
        >
          <Send className="h-3 w-3" aria-hidden="true" />
          Test
        </button>

        <button
          type="button"
          onClick={() => onPreview?.(template)}
          aria-label={`Preview ${template.name || template.key}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal-80/12 bg-white px-3 py-1.5 text-micro font-semibold text-charcoal-80/85 transition hover:border-violet/20 hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
        >
          <Eye className="h-3 w-3" aria-hidden="true" />
          Preview
        </button>

        <button
          type="button"
          onClick={() => onEdit(template)}
          aria-label={`Edit ${template.name || template.key}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-3 py-1.5 text-micro font-semibold text-white transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
        >
          <Pencil className="h-3 w-3" aria-hidden="true" />
          Edit
        </button>
      </div>
    </article>
  )
}

/* ──────────────────────────────────────────────────────────────────────── */

function EditModal({ template, onClose, onSaved }) {
  const vars = TEMPLATE_VARIABLES[template.key] || []
  const initial = useMemo(() => ({
    subject: template.subject || "",
    htmlBody: template.htmlBody || "",
    textBody: template.textBody || "",
    isActive: template.isActive !== false,
  }), [template])

  const [form, setForm] = useState(initial)
  const [savedSnapshot, setSnapshot] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState({})
  // I18N05 · which locale is the admin currently editing?
  const [locale, setLocale] = useState(template.locale || "en")
  const [localeLoading, setLocaleLoading] = useState(false)
  const { showSuccess, showError } = useToast()

  // When the admin switches locale, refetch the (key, locale) row so the
  // form rehydrates with that language's content. The backend upserts
  // missing rows from English defaults — see adminEmailTemplatesController.
  useEffect(() => {
    if (!template?.key) return
    let cancelled = false
    async function loadForLocale() {
      try {
        setLocaleLoading(true); setError("")
        const res = await authFetch(`/api/admin/email-templates/${encodeURIComponent(template.key)}?locale=${locale}`)
        if (cancelled) return
        const row = res?.data || res || {}
        const next = {
          subject:  row.subject  ?? "",
          htmlBody: row.htmlBody ?? "",
          textBody: row.textBody ?? "",
          isActive: row.isActive !== false,
        }
        setForm(next)
        setSnapshot(next)
      } catch (err) {
        if (!cancelled) setError(err?.message || "Failed to load template for locale.")
      } finally {
        if (!cancelled) setLocaleLoading(false)
      }
    }
    loadForLocale()
    return () => { cancelled = true }
     
  }, [locale, template.key])

  const isDirty = useMemo(() => computeIsDirty(form, savedSnapshot), [form, savedSnapshot])
  useUnsavedChangesPrompt(isDirty && !saving)

  // ESC dismiss with dirty guard
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
    if (!form.subject.trim()) errors.subject = "Subject is required"
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSave(e) {
    e?.preventDefault?.()
    if (!validate()) return
    setSaving(true); setError("")
    try {
      // I18N05 · save against (key, locale) — backend upserts the row
      // if the Spanish version doesn't exist yet, inheriting EN defaults.
      const res = await authFetch(`/api/admin/email-templates/${encodeURIComponent(template.key)}?locale=${locale}`, {
        method: "PATCH",
        body: JSON.stringify(form),
      })
      showSuccess("Template saved")
      setSnapshot(form) // clear dirty before close
      onSaved({ ...template, ...form, ...(res?.data || {}) })
    } catch (err) {
      setError(err.message || "Failed to save template.")
      showError("Failed to save template")
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Edit template: ${template.name || template.key}`}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[760px] flex-col rounded-2xl border border-charcoal-80/10 bg-white shadow-[0_24px_60px_rgba(93,63,211,0.18)]"
        style={{ maxHeight: "90vh" }}
      >
        <div className="flex items-center justify-between border-b border-charcoal-80/10 px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-card font-bold text-violet">Edit Template</h2>
            <div className="mt-0.5 truncate font-mono text-[11px] text-charcoal-80/55">{template.name || template.key}</div>
          </div>

          {/* I18N05 · EN/ES segmented locale tabs. Switching refetches the
              row at that locale; backend upserts ES from EN defaults if
              the Spanish row hasn't been seeded yet. */}
          <div role="tablist" aria-label="Edit locale" className="inline-flex items-center gap-0.5 rounded-full border border-charcoal-80/15 bg-white p-0.5">
            {[
              { value: "en", label: "EN" },
              { value: "es", label: "ES" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={locale === opt.value}
                disabled={saving || localeLoading}
                onClick={() => setLocale(opt.value)}
                className={`rounded-full px-3 py-1 text-[12px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 disabled:cursor-not-allowed disabled:opacity-50 ${
                  locale === opt.value
                    ? "bg-violet text-white shadow-[0_2px_6px_rgba(93,63,211,0.18)]"
                    : "text-charcoal-80/70 hover:bg-violet-pale hover:text-violet"
                }`}
              >{opt.label}</button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-charcoal-80/55 transition hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose/20 bg-rose/5 px-3 py-2 text-meta text-rose-700" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}

          {/* Available variables */}
          {vars.length > 0 && (
            <div className="mb-4 rounded-lg border border-violet/15 bg-violet-pale/40 p-3">
              <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-violet">
                Available Variables
              </div>
              <div className="flex flex-wrap gap-1.5">
                {vars.map((v) => (
                  <code key={v} className="rounded bg-white px-2 py-0.5 font-mono text-[11px] text-violet shadow-sm">
                    {v}
                  </code>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <FormInput
              label="Email Subject"
              required
              value={form.subject}
              onChange={(e) => patch({ subject: e.target.value })}
              placeholder="e.g. Your order #{{orderNumber}} is confirmed"
              error={fieldErrors.subject}
            />

            <Field
              label="HTML Body"
              hint='Use {{variableName}} for dynamic data. The HTML you write here is rendered for the user.'
            >
              {(id) => (
                <textarea
                  id={id}
                  rows={14}
                  value={form.htmlBody}
                  onChange={(e) => patch({ htmlBody: e.target.value })}
                  placeholder="Email HTML content. Use {{variableName}} for dynamic data."
                  className={inputClass({ className: "resize-y font-mono text-[11px]" })}
                />
              )}
            </Field>

            <Field label="Plain Text Body" hint="Optional fallback. If blank, generated automatically from HTML.">
              {(id) => (
                <textarea
                  id={id}
                  rows={5}
                  value={form.textBody}
                  onChange={(e) => patch({ textBody: e.target.value })}
                  placeholder="Fallback plain-text version."
                  className={inputClass({ className: "resize-y font-mono text-[11px]" })}
                />
              )}
            </Field>

            <Field label="Active">
              <label className="mt-1 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-charcoal-80/12 bg-mist px-3 py-2 text-meta text-charcoal-80 transition hover:bg-violet-pale">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => patch({ isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-charcoal-80/30 text-violet accent-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
                />
                <span>Template is active</span>
              </label>
            </Field>
          </form>
        </div>

        <div className="flex justify-end gap-2 border-t border-charcoal-80/10 px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-charcoal-80/12 bg-white px-4 py-2 text-micro font-semibold text-charcoal-80/85 transition hover:border-violet/20 hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            aria-busy={saving ? "true" : "false"}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-4 py-2 text-micro font-semibold text-white transition hover:bg-violet-deep disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
          >
            {saving ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                {"Saving\u2026"}
              </>
            ) : (
              "Save Template"
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ──────────────────────────────────────────────────────────────────────── */

function PreviewModal({ template, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview: ${template.key}`}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[760px] flex-col rounded-2xl border border-charcoal-80/10 bg-white shadow-[0_24px_60px_rgba(93,63,211,0.18)]"
        style={{ maxHeight: "90vh" }}
      >
        <div className="flex items-center justify-between border-b border-charcoal-80/10 px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-card font-bold text-violet">Preview</h2>
            <div className="mt-0.5 truncate font-mono text-[11px] text-charcoal-80/60">
              {template.key} {"\u2014"} {template.subject}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="rounded-lg p-1.5 text-charcoal-80/55 transition hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto bg-charcoal-80/5 p-4">
          <iframe
            title={`Preview of ${template.key}`}
            srcDoc={template.htmlBody || "<p style='padding:2rem;color:#888;font-family:sans-serif;'>(empty)</p>"}
            className="h-[70vh] w-full rounded-xl border border-charcoal-80/10 bg-white"
            sandbox=""
          />
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ──────────────────────────────────────────────────────────────────────── */

function TestModal({ template, onClose }) {
  const { user } = useAuth()
  const [to, setTo] = useState(user?.email || "")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [successMsg, setSuccess] = useState("")
  const [fieldError, setFieldError] = useState("")

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  async function handleSend() {
    setError(""); setSuccess(""); setFieldError("")
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      setFieldError("Please enter a valid email address.")
      return
    }
    setSending(true)
    try {
      const res = await authFetch(`/api/admin/email-templates/${template.id}/test`, {
        method: "POST",
        body: JSON.stringify({ to }),
      })
      setSuccess(res?.message || `Test email sent to ${to}`)
    } catch (err) {
      setError(err.message || "Failed to send test email")
    } finally {
      setSending(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Send test email for ${template.key}`}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] rounded-2xl border border-charcoal-80/10 bg-white p-6 shadow-[0_24px_60px_rgba(93,63,211,0.18)]"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-card font-bold text-violet">Send test email</h2>
            <p className="mt-1 text-meta text-charcoal-80/65">
              Sends <code className="rounded bg-violet-pale px-1.5 py-0.5 font-mono text-micro text-violet">{template.key}</code> to the address below with placeholder variables filled in.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-charcoal-80/55 transition hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <FormInput
          label="Recipient"
          required
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="you@example.com"
          error={fieldError}
        />

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose/20 bg-rose/5 px-3 py-2 text-meta text-rose-700" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-mint/30 bg-mint/8 px-3 py-2 text-meta text-mint" role="status">
            <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {successMsg}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-charcoal-80/12 bg-white px-4 py-2 text-micro font-semibold text-charcoal-80/85 transition hover:border-violet/20 hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending}
            aria-busy={sending ? "true" : "false"}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-4 py-2 text-micro font-semibold text-white transition hover:bg-violet-deep disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
          >
            <Send className="h-3 w-3" aria-hidden="true" />
            {sending ? "Sending\u2026" : "Send test"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ──────────────────────────────────────────────────────────────────────── */

export default function AdminEmailTemplatesPage() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState(null)
  const [preview, setPreview] = useState(null)
  const [testing, setTesting] = useState(null)
  const [search, setSearch] = useState("")

  async function load() {
    setLoading(true); setError("")
    try {
      const res = await authFetch("/api/admin/email-templates")
      setTemplates(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      setError(err?.message || "Could not load templates")
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function handleSaved(saved) {
    setTemplates((prev) => prev.map((t) => t.id === saved.id ? { ...t, ...saved } : t))
    setEditing(null)
  }

  // Filter
  const filtered = useMemo(() => {
    if (!search.trim()) return templates
    const q = search.toLowerCase().trim()
    return templates.filter((t) =>
      (t.name || "").toLowerCase().includes(q) ||
      (t.key || "").toLowerCase().includes(q) ||
      (t.subject || "").toLowerCase().includes(q)
    )
  }, [templates, search])

  // Metrics
  const metrics = useMemo(() => ({
    total: templates.length,
    active: templates.filter((t) => t.isActive !== false).length,
    inactive: templates.filter((t) => t.isActive === false).length,
  }), [templates])

  if (loading) {
    return (
      <section className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
        <SkeletonCard height="h-[80px]" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} height="h-[88px]" />)}
        </div>
      </section>
    )
  }

  return (
    <>
      <AnimatePresence>
        {editing && <EditModal template={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />}
        {preview && <PreviewModal template={preview} onClose={() => setPreview(null)} />}
        {testing && <TestModal template={testing} onClose={() => setTesting(null)} />}
      </AnimatePresence>

      <section className="space-y-5">
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-rose/20 bg-rose/5 px-4 py-3 text-meta text-rose-700" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

        {/* Metrics */}
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard title="Total Templates" value={metrics.total} icon={Mail} tone="purple" />
          <MetricCard title="Active" value={metrics.active} icon={FileCheck2} tone="green" />
          <MetricCard title="Inactive" value={metrics.inactive} icon={X} tone="amber" />
        </div>

        {/* Info bar */}
        <div className="rounded-xl border border-violet/10 bg-violet-pale/30 px-5 py-4">
          <div className="text-meta font-bold text-violet">Transactional Email Templates</div>
          <div className="mt-1 text-micro text-charcoal-80/70">
            Each template maps to a platform event. Use{" "}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-violet">
              {"{{variableName}}"}
            </code>{" "}
            syntax for dynamic content. Templates are rendered by the backend email service and logged to{" "}
            <a href="/admin/email-logs" className="font-semibold text-violet underline transition hover:text-violet-deep">Email Logs</a>.
          </div>
        </div>

        {/* List header + search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-card font-bold text-violet">Email Templates</h2>
            <p className="mt-0.5 font-mono text-micro tabular-nums text-charcoal-80/55">
              {filtered.length}{search && filtered.length !== templates.length && <span> of {templates.length}</span>} {filtered.length === 1 ? "template" : "templates"}
            </p>
          </div>
          <div className="relative">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={"Search by name, key, or subject\u2026"}
              aria-label="Search templates"
              className="h-9 w-full rounded-lg border border-charcoal-80/12 bg-white px-3 pr-7 text-micro text-violet outline-none transition focus:border-violet/40 focus:ring-[3px] focus:ring-azure/20 sm:w-[260px]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-charcoal-80/40 transition hover:text-violet focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-azure/40"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Templates list */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-charcoal-80/15 bg-white px-6 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet/15 bg-violet-pale text-violet">
              <Mail className="h-7 w-7" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-card font-bold text-violet">
              {search ? "No matches" : "No templates configured"}
            </h3>
            <p className="mt-1 max-w-sm text-meta text-charcoal-80/65">
              {search
                ? `No templates match "${search}". Try a different search term.`
                : "Run the email templates seed to populate the default set: node prisma/seed/email-templates-seed.js"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onEdit={setEditing}
                onPreview={setPreview}
                onTest={setTesting}
              />
            ))}
          </div>
        )}
      </section>
    </>
  )
}
