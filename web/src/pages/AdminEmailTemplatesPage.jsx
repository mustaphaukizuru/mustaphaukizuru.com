import { useEffect, useState } from "react"
import { Mail, Pencil, AlertCircle, Eye } from "lucide-react"
import { EmptyState, SectionCard, SkeletonCard } from "../components/ui/index"
import { authFetch } from "../lib/api"
import { useToast } from "../context/ToastContext"

// ─────────────────────────────────────────────────────────────────────────────
// Email template constants — aligned to platform email types
// ─────────────────────────────────────────────────────────────────────────────
export const EMAIL_TYPES = [
  { key: "welcome", label: "Welcome / Account Created" },
  { key: "email_verification", label: "Email Verification" },
  { key: "password_reset", label: "Password Reset" },
  { key: "order_confirmation", label: "Order Confirmation" },
  { key: "payment_confirmation", label: "Payment Confirmation" },
  { key: "invoice", label: "Invoice" },
  { key: "download_ready", label: "Download Ready" },
  { key: "refund_notification", label: "Refund Notification" },
  { key: "service_confirmation", label: "Service Request Confirmation" },
  { key: "consultation_scheduled", label: "Consultation Scheduled" },
  { key: "support_reply", label: "Support Reply" },
  { key: "admin_alert", label: "Admin Alert" },
]

// ── Available template variables by email type ────────────────────────────
const TEMPLATE_VARIABLES = {
  welcome: ["{{userName}}", "{{userEmail}}", "{{dashboardUrl}}"],
  email_verification: ["{{userName}}", "{{verificationUrl}}", "{{expiresIn}}"],
  password_reset: ["{{userName}}", "{{resetUrl}}", "{{expiresIn}}"],
  order_confirmation: ["{{userName}}", "{{orderNumber}}", "{{orderTotal}}", "{{itemsList}}", "{{dashboardUrl}}"],
  payment_confirmation: ["{{userName}}", "{{orderNumber}}", "{{amount}}", "{{paymentMethod}}", "{{date}}"],
  invoice: ["{{userName}}", "{{invoiceNumber}}", "{{orderTotal}}", "{{dueDate}}", "{{itemsList}}"],
  download_ready: ["{{userName}}", "{{productTitle}}", "{{downloadUrl}}", "{{orderNumber}}"],
  refund_notification: ["{{userName}}", "{{orderNumber}}", "{{refundAmount}}", "{{refundDate}}"],
  service_confirmation: ["{{userName}}", "{{serviceName}}", "{{packageName}}", "{{orderNumber}}"],
  consultation_scheduled: ["{{userName}}", "{{consultantName}}", "{{dateTime}}", "{{meetingLink}}"],
  support_reply: ["{{userName}}", "{{ticketNumber}}", "{{subject}}", "{{replyText}}", "{{ticketUrl}}"],
  admin_alert: ["{{alertType}}", "{{message}}", "{{actionUrl}}"],
}

function TemplateCard({ template, onEdit, onPreview }) {
  const emailType = EMAIL_TYPES.find((t) => t.key === template.type)
  const label = emailType?.label || template.type

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#634F40]/10 bg-[#fafafa] p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ede4ef] text-[#420060]">
          <Mail className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-[#420060]">{template.name || label}</div>
          <div className="mt-0.5 text-[12px] text-[#634F40]/60">{label}</div>
          {template.subject && (
            <div className="mt-0.5 truncate text-[11px] text-[#634F40]/50">
              Subject: {template.subject}
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
          template.isActive !== false
            ? "bg-[#e5f4e8] text-[#3b8f47]"
            : "bg-[#f2f2f2] text-[#666]"
        }`}>
          {template.isActive !== false ? "Active" : "Inactive"}
        </span>

        <button
          type="button"
          onClick={() => onPreview?.(template)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#634F40]/15 px-3 py-2 text-[12px] font-medium text-[#634F40] transition hover:bg-[#f4eef6] hover:text-[#420060]"
        >
          <Eye className="h-3.5 w-3.5" />
          Preview
        </button>

        <button
          type="button"
          onClick={() => onEdit(template)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#420060] px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-[#2d003f]"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
      </div>
    </div>
  )
}

function EditModal({ template, onClose, onSaved }) {
  const emailType = EMAIL_TYPES.find((t) => t.key === template.type)
  const vars = TEMPLATE_VARIABLES[template.type] || []

  const [form, setForm] = useState({
    name: template.name || emailType?.label || "",
    subject: template.subject || "",
    htmlBody: template.htmlBody || template.body || "",
    isActive: template.isActive !== false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const { showSuccess, showError } = useToast()

  async function handleSave() {
    setSaving(true)
    setError("")
    try {
      await authFetch(`/api/admin/email-templates/${template.id}`, {
        method: "PATCH",
        body: JSON.stringify(form),
      })
      showSuccess("Template saved")
      onSaved({ ...template, ...form })
    } catch (err) {
      setError(err.message || "Failed to save template.")
      showError("Failed to save template")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="flex w-full max-w-[760px] flex-col rounded-xl border border-[#634F40]/10 bg-white shadow-[0_30px_80px_rgba(66,0,96,0.18)]" style={{ maxHeight: "90vh" }}>
        <div className="flex items-center justify-between border-b border-[#634F40]/10 px-6 py-4">
          <div>
            <h2 className="text-[20px] font-bold text-[#420060]">Edit Template</h2>
            <div className="text-[12px] text-[#634F40]/60">{emailType?.label}</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-[#634F40]/10 p-2 text-[#634F40]/50 transition hover:bg-[#f4eef6]">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Available variables */}
          {vars.length > 0 && (
            <div className="mb-4 rounded-xl border border-[#420060]/10 bg-[#faf7fb] p-4">
              <div className="mb-2 text-[12px] font-semibold text-[#420060]">Available Variables</div>
              <div className="flex flex-wrap gap-2">
                {vars.map((v) => (
                  <code
                    key={v}
                    className="rounded-lg bg-white px-2 py-0.5 text-[11px] font-mono text-[#420060] shadow-sm"
                  >
                    {v}
                  </code>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-[#420060]">Template Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-xl border border-[#634F40]/20 bg-[#fafafa] px-4 py-3 text-[13px] text-[#420060] outline-none focus:border-[#420060]/40"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-[#420060]">Email Subject</label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="e.g. Your order #{{orderNumber}} is confirmed"
                className="w-full rounded-xl border border-[#634F40]/20 bg-[#fafafa] px-4 py-3 text-[13px] text-[#420060] outline-none focus:border-[#420060]/40"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-[#420060]">HTML Body</label>
              <textarea
                rows={14}
                value={form.htmlBody}
                onChange={(e) => setForm((f) => ({ ...f, htmlBody: e.target.value }))}
                placeholder="Email HTML content. Use {{variableName}} for dynamic data."
                className="w-full resize-y rounded-xl border border-[#634F40]/20 bg-[#fafafa] px-4 py-3 font-mono text-[12px] text-[#420060] outline-none focus:border-[#420060]/40"
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="h-4 w-4 accent-[#420060]"
              />
              <label htmlFor="isActive" className="text-[13px] font-medium text-[#420060]">
                Template is active
              </label>
            </div>
          </div>
        </div>

        <div className="flex gap-3 border-t border-[#634F40]/10 px-6 py-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#420060] py-3 text-[13px] font-semibold text-white transition hover:bg-[#2d003f] disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Template"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#634F40]/15 px-5 py-3 text-[13px] font-medium text-[#634F40] transition hover:bg-[#f4eef6]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminEmailTemplatesPage() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError("")
      try {
        const res = await authFetch("/api/admin/email-templates")
        setTemplates(Array.isArray(res.data) ? res.data : [])
      } catch (err) {
        // Fall back to showing all email types as stubs
        setTemplates(
          EMAIL_TYPES.map((et, i) => ({
            id: `stub-${i}`,
            type: et.key,
            name: et.label,
            subject: "",
            htmlBody: "",
            isActive: true,
          }))
        )
        setError("")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function handleSaved(saved) {
    setTemplates((prev) => prev.map((t) => t.id === saved.id ? saved : t))
    setEditing(null)
  }

  if (loading) {
    return (
      <section className="space-y-5">
        <SkeletonCard height="h-[80px]" />
        {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} height="h-[72px]" />)}
      </section>
    )
  }

  return (
    <>
      {editing && (
        <EditModal template={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />
      )}

      <section className="space-y-5">
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Info bar */}
        <div className="rounded-xl border border-[#420060]/10 bg-[#faf7fb] px-5 py-4">
          <div className="text-[14px] font-semibold text-[#420060]">Transactional Email Templates</div>
          <div className="mt-1 text-[12px] text-[#634F40]/70">
            Each template maps to a platform event. Use{" "}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[#420060]">
              {"{{variableName}}"}
            </code>{" "}
            syntax for dynamic content. Templates are rendered by your backend email service.
          </div>
        </div>

        <SectionCard
          title="Email Templates"
          subtitle={`${templates.length} template${templates.length !== 1 ? "s" : ""} configured`}
        >
          {templates.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="No templates configured"
              description="Email templates will appear here once connected to the backend."
            />
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onEdit={setEditing}
                />
              ))}
            </div>
          )}
        </SectionCard>
      </section>
    </>
  )
}
