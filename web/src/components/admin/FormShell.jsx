import { Link } from "react-router-dom"
import { Save, ArrowLeft, AlertCircle, CheckCircle2, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

/* ──────────────────────────────────────────────────────────────────────────
 *  FormShell · F10.I · Batch 6B-3
 *
 *  Universal admin form layout that provides:
 *    - Sticky top action bar with breadcrumb back-link, page title,
 *      Save (primary) + Cancel buttons, and a "Saving…" busy state.
 *    - Inline alert region (error / success) that animates in/out.
 *    - Optional side metadata strip (record ID, status, last edited).
 *    - Slot-based: pages render their fields inside <FormShell>.
 *
 *  The save bar is sticky on scroll so admins always have access to
 *  Save / Cancel without scrolling back to the top of long forms.
 *
 *  ── API ─────────────────────────────────────────────────────────────────
 *
 *  <FormShell
 *    title="Edit Project"
 *    subtitle="/cloud-migration-raindrop"
 *    backHref="/admin/portfolio"
 *    backLabel="Back to portfolio"
 *    onSave={handleSave}
 *    onCancel={() => navigate(-1)}
 *    saving={saving}
 *    canSave={canSave}
 *    saveLabel="Save changes"
 *    error={error}
 *    onClearError={() => setError("")}
 *    success={successMsg}
 *    onClearSuccess={() => setSuccessMsg("")}
 *    headerActions={<ExtraButton />}
 *    statusBadge={<StatusPill status="published" />}
 *  >
 *    <YourFormFields />
 *  </FormShell>
 *  ──────────────────────────────────────────────────────────────────── */

export default function FormShell({
  title,
  subtitle,
  backHref,
  backLabel = "Back",
  onSave,
  onCancel,
  saving = false,
  canSave = true,
  saveLabel = "Save changes",
  error,
  onClearError,
  success,
  onClearSuccess,
  headerActions,
  statusBadge,
  children,
}) {
  return (
    <section className="space-y-4 pb-6">
      {/* ── Sticky top action bar ──────────────────────────── */}
      <div className="sticky top-[120px] z-20 -mx-3 rounded-xl border border-charcoal-80/10 bg-white/95 px-4 py-3 shadow-[0_4px_20px_rgba(93,63,211,0.06)] backdrop-blur-md sm:-mx-5 sm:px-5 lg:top-[140px] lg:mx-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Title cluster */}
          <div className="min-w-0 flex-1">
            {backHref && (
              <Link
                to={backHref}
                className="group inline-flex items-center gap-1 rounded text-[11px] font-semibold text-charcoal-80/65 transition hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-1"
              >
                <ArrowLeft className="h-3 w-3 transition group-hover:-translate-x-0.5" aria-hidden="true" />
                <span className="font-mono uppercase tracking-wider">{backLabel}</span>
              </Link>
            )}
            <div className="mt-1 flex flex-wrap items-baseline gap-2">
              <h1 className="truncate text-section font-bold tracking-tight text-violet">{title}</h1>
              {statusBadge}
            </div>
            {subtitle && (
              <p className="mt-0.5 truncate font-mono text-micro text-charcoal-80/60">{subtitle}</p>
            )}
          </div>

          {/* Action cluster */}
          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg border border-charcoal-80/12 bg-white px-3 py-2 text-micro font-semibold text-charcoal-80/85 transition hover:border-violet/20 hover:bg-violet-pale hover:text-violet disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
              >
                Cancel
              </button>
            )}
            {onSave && (
              <button
                type="button"
                onClick={onSave}
                disabled={saving || !canSave}
                aria-busy={saving ? "true" : "false"}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet px-4 py-2 text-micro font-semibold text-white transition hover:-translate-y-0.5 hover:bg-violet-deep hover:shadow-[0_8px_18px_rgba(93,63,211,0.22)] disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2"
              >
                {saving ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" aria-hidden="true" />
                    {saveLabel}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Alerts ──────────────────────────────────────────── */}
      <AnimatePresence mode="popLayout">
        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose/20 bg-rose/5 px-4 py-3 text-meta text-rose-700"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{error}</span>
            {onClearError && (
              <button
                type="button"
                onClick={onClearError}
                aria-label="Dismiss error"
                className="rounded p-0.5 text-rose-600/60 transition hover:text-rose-800 focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-rose-300/40"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </motion.div>
        )}
        {success && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            role="status"
            className="flex items-start gap-2 rounded-xl border border-mint/30 bg-mint/8 px-4 py-3 text-meta text-mint"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{success}</span>
            {onClearSuccess && (
              <button
                type="button"
                onClick={onClearSuccess}
                aria-label="Dismiss notice"
                className="rounded p-0.5 text-mint/65 transition hover:text-mint focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-mint/40"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Page content ────────────────────────────────────── */}
      {children}
    </section>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 *  FormCard · semantic grouping for sections within a form
 *
 *  Use to wrap each logical group of fields (e.g. "Basics",
 *  "Publishing", "SEO"). Card has a small uppercase title and a slot.
 *  ──────────────────────────────────────────────────────────────────── */
export function FormCard({ title, description, action, children, className = "" }) {
  return (
    <div className={`rounded-xl border border-charcoal-80/10 bg-white p-5 shadow-[0_4px_16px_rgba(93,63,211,0.04)] ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-violet">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-micro text-charcoal-80/60">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </div>
  )
}
