import { useTranslation } from "react-i18next"
import { AlertTriangle, RotateCcw } from "lucide-react"

/* ──────────────────────────────────────────────────────────────────────────
 *  PanelLoadError · say when a panel could not be loaded (D0-4)
 *
 *  useProjectPanels settles each of its six fetches independently, so one
 *  failure does not blank the other five. That is right. What was wrong is
 *  that a failure looked EXACTLY like an empty panel: every fetch caught its
 *  own error and returned `[]`.
 *
 *  Four member endpoints answered 500 for several commits and the only
 *  symptom was a timeline with nothing in it. A client cannot tell "no
 *  activity yet" from "we could not load your activity", and the difference
 *  matters most on the panels that are about money and deadlines.
 *
 *  So: name the panels that failed, offer a retry, and do not pretend the
 *  page is complete. Renders nothing when nothing failed — no layout shift
 *  on the normal path.
 *  ──────────────────────────────────────────────────────────────── */

export default function PanelLoadError({ failed = [], onRetry, className = "" }) {
  const { t } = useTranslation("dashboard")
  if (!failed.length) return null

  // Named, not counted: "2 sections failed" tells the client nothing they
  // can act on, while "Invoices, Hours" tells them which numbers not to
  // trust on this page.
  const names = failed.map((k) => t(`projects.panelError.names.${k}`, { defaultValue: k })).join(" · ")

  return (
    <div
      role="alert"
      className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border border-amber/30 bg-amber/5 px-4 py-3 ${className}`}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-meta font-semibold text-amber-700">{t("projects.panelError.title")}</p>
          <p className="mt-0.5 text-micro text-charcoal-80/75">
            {t("projects.panelError.body", { names })}
          </p>
        </div>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber/40 bg-white px-3 py-2 text-micro font-semibold text-amber-700 transition hover:bg-amber/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          {t("projects.panelError.retry")}
        </button>
      ) : null}
    </div>
  )
}

export { PanelLoadError }
