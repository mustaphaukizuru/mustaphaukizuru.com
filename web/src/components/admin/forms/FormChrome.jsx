/* ──────────────────────────────────────────────────────────────────────────
 *  FormChrome · shared pieces around a useForm-driven admin form
 *
 *    <FormModal open onClose title="Edit thing" size="md">…</FormModal>
 *    <FormErrorBanner message={form.formError} />
 *    <FormActions onCancel={close} saving={form.submitting} saveLabel="Save" />
 *    <ConfirmModal open title="Delete?" onConfirm onClose confirmLabel="Delete" tone="danger" />
 *  ──────────────────────────────────────────────────────────────────── */

import { AlertCircle, Loader2, Save } from "lucide-react"
import { Modal } from "../../ui"

/** Canonical dialog wrapper. Assumed Modal props: open, onClose, title, description, size, children. */
export function FormModal({ open = true, onClose, title, description, size = "md", children }) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size={size}>
      {children}
    </Modal>
  )
}

export function FormErrorBanner({ message }) {
  if (!message) return null
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose/30 bg-rose/5 p-3 text-sm text-rose">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

export function FormActions({ onCancel, saving = false, saveLabel = "Save", cancelLabel = "Cancel", disabled = false, children }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
      {children}
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-charcoal hover:bg-slate-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
        >
          {cancelLabel}
        </button>
      )}
      <button
        type="submit"
        disabled={saving || disabled}
        aria-busy={saving ? "true" : "false"}
        className="inline-flex items-center gap-2 rounded-lg bg-violet px-4 py-2 text-sm font-semibold text-white hover:bg-violet-deep disabled:opacity-60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} aria-hidden="true" /> : <Save className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}
        {saving ? "Saving…" : saveLabel}
      </button>
    </div>
  )
}

export function ConfirmModal({
  open, onClose, onConfirm, title, description, children,
  confirmLabel = "Confirm", cancelLabel = "Cancel", tone = "primary", busy = false,
}) {
  const confirmCls = tone === "danger"
    ? "bg-rose text-white hover:bg-rose/90"
    : "bg-violet text-white hover:bg-violet-deep"
  return (
    <Modal open={open} onClose={onClose} title={title} description={description} size="sm">
      {children}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-charcoal hover:bg-slate-50 disabled:opacity-60"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60 ${confirmCls}`}
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
