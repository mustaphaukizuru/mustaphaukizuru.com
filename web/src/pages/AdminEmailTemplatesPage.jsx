import { useEffect, useMemo, useState } from "react"
import { z } from "zod"
import {
  Mail, Pencil, AlertCircle, Eye, Send, X, FileCheck2,
} from "lucide-react"
import { authFetch } from "../lib/api"
import { useToast } from "../context/ToastContext"
import { useAuth } from "../context/AuthContext"
import { MetricCard, SkeletonCard } from "../components/ui/index"
import { Modal } from "../components/ui"
import StatusPill from "../components/admin/StatusPill"
import { Field, inputClass } from "../components/admin/Field"
import useForm from "../hooks/useForm"
import { requiredStr, emailField } from "../lib/validation/common"
import {
  TextField, CheckboxField, FormErrorBanner, FormActions, ConfirmModal,
} from "../components/admin/forms"
import useUnsavedChangesPrompt from "../hooks/useUnsavedChangesPrompt"

/* ──────────────────────────────────────────────────────────────────────────
 *  AdminEmailTemplatesPage
 *
 *  Template editor with preview + test send. Templates are a fixed set
 *  bound to platform events (not a CRUD list).
 *
 *  Roadmap step 30: the three dialogs now sit on the canonical Modal and the
 *  edit / test forms run through useForm + zod. Endpoints preserved verbatim:
 *    GET   /api/admin/email-templates
 *    GET   /api/admin/email-templates/:key?locale=xx
 *    PATCH /api/admin/email-templates/:key?locale=xx
 *    POST  /api/admin/email-templates/:id/test
 *  ──────────────────────────────────────────────────────────────────── */

// Variable hint map · MUST stay in sync with prisma/seed-email-templates.js.
// {{year}} is auto-injected by emailService at send time and is omitted.
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

const templateSchema = z.object({
  subject: requiredStr("Subject", 300),
  htmlBody: z.preprocess((v) => (v == null ? "" : String(v)), z.string()),
  textBody: z.preprocess((v) => (v == null ? "" : String(v)), z.string()),
  isActive: z.preprocess((v) => v !== false, z.boolean()),
})

const testSendSchema = z.object({ to: emailField("Recipient") })

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
  const { showSuccess, showError } = useToast()
  // I18N05 · which locale is the admin currently editing?
  const [locale, setLocale] = useState(template.locale || "en")
  const [localeLoading, setLocaleLoading] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const form = useForm({
    schema: templateSchema,
    initialValues: {
      subject: template.subject || "",
      htmlBody: template.htmlBody || "",
      textBody: template.textBody || "",
      isActive: template.isActive !== false,
    },
    onSubmit: async (parsed) => {
      // I18N05 · save against (key, locale) — backend upserts the row if the
      // Spanish version doesn't exist yet, inheriting EN defaults.
      try {
        const res = await authFetch(`/api/admin/email-templates/${encodeURIComponent(template.key)}?locale=${locale}`, {
          method: "PATCH",
          body: JSON.stringify(parsed),
        })
        showSuccess("Template saved")
        form.reset(parsed) // clear dirty before close
        onSaved({ ...template, ...parsed, ...(res?.data || {}) })
      } catch (err) {
        showError("Failed to save template")
        throw err
      }
    },
  })
  const { reset, setFormError } = form

  // When the admin switches locale, refetch the (key, locale) row so the form
  // rehydrates with that language's content.
  useEffect(() => {
    if (!template?.key) return
    let cancelled = false
    async function loadForLocale() {
      try {
        setLocaleLoading(true)
        const res = await authFetch(`/api/admin/email-templates/${encodeURIComponent(template.key)}?locale=${locale}`)
        if (cancelled) return
        const row = res?.data || res || {}
        reset({
          subject:  row.subject  ?? "",
          htmlBody: row.htmlBody ?? "",
          textBody: row.textBody ?? "",
          isActive: row.isActive !== false,
        })
      } catch (err) {
        if (!cancelled) setFormError(err?.message || "Failed to load template for locale.")
      } finally {
        if (!cancelled) setLocaleLoading(false)
      }
    }
    loadForLocale()
    return () => { cancelled = true }
  }, [locale, template.key, reset, setFormError])

  useUnsavedChangesPrompt(form.isDirty && !form.submitting)

  function handleClose() {
    if (form.isDirty) { setConfirmDiscard(true); return }
    onClose()
  }

  return (
    <>
      <Modal open onClose={handleClose} size="lg" title="Edit Template" description={template.name || template.key}>
        {/* I18N05 · EN/ES segmented locale tabs. */}
        <div role="tablist" aria-label="Edit locale" className="mb-4 inline-flex items-center gap-0.5 rounded-full border border-charcoal-80/15 bg-white p-0.5">
          {[{ value: "en", label: "EN" }, { value: "es", label: "ES" }].map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={locale === opt.value}
              disabled={form.submitting || localeLoading}
              onClick={() => setLocale(opt.value)}
              className={`rounded-full px-3 py-1 text-[12px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 disabled:cursor-not-allowed disabled:opacity-50 ${
                locale === opt.value
                  ? "bg-violet text-white shadow-[0_2px_6px_rgba(93,63,211,0.18)]"
                  : "text-charcoal-80/70 hover:bg-violet-pale hover:text-violet"
              }`}
            >{opt.label}</button>
          ))}
        </div>

        {vars.length > 0 && (
          <div className="mb-4 rounded-lg border border-violet/15 bg-violet-pale/40 p-3">
            <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-violet">Available Variables</div>
            <div className="flex flex-wrap gap-1.5">
              {vars.map((v) => (
                <code key={v} className="rounded bg-white px-2 py-0.5 font-mono text-[11px] text-violet shadow-sm">{v}</code>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={form.handleSubmit} noValidate className="space-y-4">
          <TextField form={form} name="subject" label="Email Subject" required placeholder="e.g. Your order #{{orderNumber}} is confirmed" />

          <Field label="HTML Body" hint="Use {{variableName}} for dynamic data. The HTML you write here is rendered for the user." error={form.errors.htmlBody}>
            {(id) => (
              <textarea
                id={id}
                rows={14}
                value={form.values.htmlBody}
                onChange={form.handleChange("htmlBody")}
                placeholder="Email HTML content. Use {{variableName}} for dynamic data."
                className={inputClass({ className: "resize-y font-mono text-[11px]" })}
              />
            )}
          </Field>

          <Field label="Plain Text Body" hint="Optional fallback. If blank, generated automatically from HTML." error={form.errors.textBody}>
            {(id) => (
              <textarea
                id={id}
                rows={5}
                value={form.values.textBody}
                onChange={form.handleChange("textBody")}
                placeholder="Fallback plain-text version."
                className={inputClass({ className: "resize-y font-mono text-[11px]" })}
              />
            )}
          </Field>

          <CheckboxField form={form} name="isActive" label="Template is active" />

          <FormErrorBanner message={form.formError} />
          <FormActions onCancel={handleClose} saving={form.submitting} saveLabel="Save Template" disabled={localeLoading} />
        </form>
      </Modal>

      <ConfirmModal
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        onConfirm={() => { setConfirmDiscard(false); onClose() }}
        title="Discard unsaved changes?"
        confirmLabel="Discard"
        tone="danger"
      >
        <p className="text-sm text-charcoal-80">Your edits to this template will be lost.</p>
      </ConfirmModal>
    </>
  )
}

/* ──────────────────────────────────────────────────────────────────────── */

function PreviewModal({ template, onClose }) {
  return (
    <Modal open onClose={onClose} size="lg" title="Preview" description={`${template.key} — ${template.subject || ""}`}>
      <div className="rounded-xl bg-charcoal-80/5 p-3">
        <iframe
          title={`Preview of ${template.key}`}
          srcDoc={template.htmlBody || "<p style='padding:2rem;color:#888;font-family:sans-serif;'>(empty)</p>"}
          className="h-[65vh] w-full rounded-xl border border-charcoal-80/10 bg-white"
          sandbox=""
        />
      </div>
    </Modal>
  )
}

/* ──────────────────────────────────────────────────────────────────────── */

function TestModal({ template, onClose }) {
  const { user } = useAuth()
  const [successMsg, setSuccess] = useState("")

  const form = useForm({
    schema: testSendSchema,
    initialValues: { to: user?.email || "" },
    onSubmit: async ({ to }) => {
      setSuccess("")
      const res = await authFetch(`/api/admin/email-templates/${template.id}/test`, {
        method: "POST",
        body: JSON.stringify({ to }),
      })
      setSuccess(res?.message || `Test email sent to ${to}`)
    },
  })

  return (
    <Modal open onClose={onClose} size="sm" title="Send test email">
      <p className="mb-4 text-meta text-charcoal-80/65">
        Sends <code className="rounded bg-violet-pale px-1.5 py-0.5 font-mono text-micro text-violet">{template.key}</code> to the address below with placeholder variables filled in.
      </p>
      <form onSubmit={form.handleSubmit} noValidate className="space-y-3">
        <TextField form={form} name="to" label="Recipient" required type="email" placeholder="you@example.com" />
        <FormErrorBanner message={form.formError} />
        {successMsg && (
          <div className="flex items-start gap-2 rounded-lg border border-mint/30 bg-mint/8 px-3 py-2 text-meta text-mint" role="status">
            <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {successMsg}
          </div>
        )}
        <FormActions onCancel={onClose} cancelLabel="Close" saving={form.submitting} saveLabel="Send test" />
      </form>
    </Modal>
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

  const filtered = useMemo(() => {
    if (!search.trim()) return templates
    const q = search.toLowerCase().trim()
    return templates.filter((t) =>
      (t.name || "").toLowerCase().includes(q) ||
      (t.key || "").toLowerCase().includes(q) ||
      (t.subject || "").toLowerCase().includes(q)
    )
  }, [templates, search])

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
      {editing && <EditModal key={editing.id} template={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />}
      {preview && <PreviewModal template={preview} onClose={() => setPreview(null)} />}
      {testing && <TestModal key={testing.id} template={testing} onClose={() => setTesting(null)} />}

      <section className="space-y-5">
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-rose/20 bg-rose/5 px-4 py-3 text-meta text-rose-700" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard title="Total Templates" value={metrics.total} icon={Mail} tone="purple" />
          <MetricCard title="Active" value={metrics.active} icon={FileCheck2} tone="green" />
          <MetricCard title="Inactive" value={metrics.inactive} icon={X} tone="amber" />
        </div>

        <div className="rounded-xl border border-violet/10 bg-violet-pale/30 px-5 py-4">
          <div className="text-meta font-bold text-violet">Transactional Email Templates</div>
          <div className="mt-1 text-micro text-charcoal-80/70">
            Each template maps to a platform event. Use{" "}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-violet">{"{{variableName}}"}</code>{" "}
            syntax for dynamic content. Templates are rendered by the backend email service and logged to{" "}
            <a href="/admin/email-logs" className="font-semibold text-violet underline transition hover:text-violet-deep">Email Logs</a>.
          </div>
        </div>

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
              placeholder={"Search by name, key, or subject…"}
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

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-charcoal-80/15 bg-white px-6 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet/15 bg-violet-pale text-violet">
              <Mail className="h-7 w-7" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-card font-bold text-violet">{search ? "No matches" : "No templates configured"}</h3>
            <p className="mt-1 max-w-sm text-meta text-charcoal-80/65">
              {search
                ? `No templates match "${search}". Try a different search term.`
                : "Run the email templates seed to populate the default set: node prisma/seed/email-templates-seed.js"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((template) => (
              <TemplateCard key={template.id} template={template} onEdit={setEditing} onPreview={setPreview} onTest={setTesting} />
            ))}
          </div>
        )}
      </section>
    </>
  )
}
