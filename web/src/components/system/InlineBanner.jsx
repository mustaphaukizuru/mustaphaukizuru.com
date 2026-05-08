// ════════════════════════════════════════════════════════════════════════════
// InlineBanner · system surface · v1.0
// ────────────────────────────────────────────────────────────────────────────
// In-page contextual notice. Lives inside a form, page header, or section —
// NOT a floating toast. Use Toast for ephemeral confirmations; use this for
// persistent state (errors, validation, important info).
//
// Tones:    info | success | warning | danger
// Variants: subtle (default — tinted bg) · solid (filled, used sparingly)
//
// Behaviours:
//   · Always paired with the matching Lucide icon for accessibility.
//   · Optional title (bold) + body. Either alone or both.
//   · Optional dismiss × button — fires `onDismiss` when clicked.
//   · Optional `actions` slot for inline CTAs (Buttons or links).
//   · `role="status"` (info/success) or `role="alert"` (warning/danger) is
//     wired automatically for assistive tech.
// ════════════════════════════════════════════════════════════════════════════

import { Info, CheckCircle2, AlertTriangle, AlertOctagon, X } from "lucide-react"

import { useTranslation } from "react-i18next"
const TONE = {
  info: {
    icon: Info,
    role: "status",
    subtle:
      "bg-[var(--color-feedback-info-bg)] text-[var(--color-feedback-info-text)] " +
      "border-[rgba(37,99,235,0.20)]",
    solid:
      "bg-[var(--color-feedback-info)] text-white border-[var(--color-feedback-info)]",
  },
  success: {
    icon: CheckCircle2,
    role: "status",
    subtle:
      "bg-[var(--color-feedback-success-bg)] text-[var(--color-feedback-success-text)] " +
      "border-[rgba(22,163,74,0.20)]",
    solid:
      "bg-[var(--color-feedback-success)] text-white border-[var(--color-feedback-success)]",
  },
  warning: {
    icon: AlertTriangle,
    role: "alert",
    subtle:
      "bg-[var(--color-feedback-warning-bg)] text-[var(--color-feedback-warning-text)] " +
      "border-[rgba(217,119,6,0.20)]",
    solid:
      "bg-[var(--color-feedback-warning)] text-white border-[var(--color-feedback-warning)]",
  },
  danger: {
    icon: AlertOctagon,
    role: "alert",
    subtle:
      "bg-[var(--color-feedback-danger-bg)] text-[var(--color-feedback-danger-text)] " +
      "border-[rgba(220,38,38,0.20)]",
    solid:
      "bg-[var(--color-feedback-danger)] text-white border-[var(--color-feedback-danger)]",
  },
}

/**
 * InlineBanner · contextual notice inside a page or form.
 *
 * Props:
 *   tone?      · "info" (default) · "success" · "warning" · "danger"
 *   variant?   · "subtle" (default) · "solid"
 *   title?     · string — bolded heading
 *   children   · body content
 *   icon?      · override the default tone icon
 *   actions?   · ReactNode — inline CTA(s) right of the body
 *   onDismiss? · () => void — when set, renders a close button
 *   className? · escape hatch
 */
export default function InlineBanner({
  tone = "info",
  variant = "subtle",
  title,
  children,
  icon,
  actions,
  onDismiss,
  className = "",
}) {
  const { t } = useTranslation("common")
  const meta = TONE[tone] || TONE.info
  const Icon = icon || meta.icon
  const colorClass = variant === "solid" ? meta.solid : meta.subtle

  return (
    <div
      role={meta.role}
      className={[
        "flex items-start gap-3 rounded-[10px] border px-4 py-3 text-[14px] leading-[1.55]",
        colorClass,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />

      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold leading-[1.4]">{title}</p>}
        {children && (
          <div className={title ? "mt-1 text-[13px] opacity-95" : ""}>
            {children}
          </div>
        )}
        {actions && <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("system.dismissNotif")}
          className="shrink-0 rounded-md p-1 -m-1 opacity-70 hover:opacity-100 transition-opacity duration-[var(--motion-fast)]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export { InlineBanner }
