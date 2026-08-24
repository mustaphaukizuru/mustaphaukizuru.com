 
// ════════════════════════════════════════════════════════════════════════════
// Badge · system composite · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Status / category pill. Successor to legacy StatusBadge in components/ui.
//
// Two API modes:
//   1. Semantic tone — pass `tone` directly: success | warning | danger |
//                      info | neutral | violet
//   2. Status alias  — pass `status` and the component picks the right tone
//                      based on a vocabulary that matches the database enums
//                      (paid, pending, failed, cancelled, refunded, active,
//                       inactive, suspended, open, closed, resolved, draft,
//                       published, in_progress, approved, rejected, member,
//                       admin, confirmed, no_show, completed)
//
// Behaviours:
//   · Optional dot indicator (default ON for status mode, OFF for tone mode).
//   · `pulse` adds a subtle live-pulse for "Live", "Now booking", etc.
//   · Always rounded-full, text-[12px], capitalised. Underscores → spaces.
//   · WCAG 2.1 AA — every tone uses a validated text/bg pair from tokens.
// ════════════════════════════════════════════════════════════════════════════

const TONE_CLASS = {
  success:
    "bg-[var(--color-feedback-success-bg)] text-[var(--color-feedback-success-text)]",
  warning:
    "bg-[var(--color-feedback-warning-bg)] text-[var(--color-feedback-warning-text)]",
  danger:
    "bg-[var(--color-feedback-danger-bg)] text-[var(--color-feedback-danger-text)]",
  info:
    "bg-[var(--color-feedback-info-bg)] text-[var(--color-feedback-info-text)]",
  neutral:
    "bg-[rgba(99,79,64,0.08)] text-[var(--color-charcoal-80)]",
  violet:
    "bg-[var(--color-violet-pale)] text-[var(--color-violet)]",
  dark:
    "bg-[var(--color-surface-dark)] text-[var(--color-text-on-dark)]",
}

const SIZE_CLASS = {
  sm: "px-2 py-0.5 text-[11px]",
  md: "px-2.5 py-1 text-[12px]",
  lg: "px-3 py-1.5 text-[13px]",
}

// Map status enum → tone (single source of truth for status semantics)
const STATUS_TO_TONE = {
  paid: "success",
  pending: "warning",
  failed: "danger",
  cancelled: "neutral",
  cancelled_no_refund: "neutral",
  refunded: "info",
  active: "success",
  inactive: "neutral",
  suspended: "danger",
  open: "warning",
  closed: "neutral",
  resolved: "success",
  draft: "neutral",
  published: "success",
  in_progress: "info",
  approved: "success",
  rejected: "danger",
  member: "violet",
  admin: "dark",
  confirmed: "success",
  no_show: "danger",
  completed: "success",
  scheduled: "info",
  rescheduled: "info",
}

/**
 * Badge · status / category pill.
 *
 * Props:
 *   children?  · label content (overrides status text)
 *   status?    · enum-style string — auto-maps to a tone + label
 *   tone?      · explicit tone — used when `status` is absent
 *   size?      · "sm" · "md" (default) · "lg"
 *   dot?       · boolean — leading colored dot (default: true if status, else false)
 *   pulse?     · boolean — animated dot for live/active states
 *   icon?      · Lucide icon — renders before the label
 *   className? · escape hatch
 */
export default function Badge({
  children,
  status,
  tone,
  size = "md",
  dot,
  pulse = false,
  icon: Icon,
  className = "",
}) {
  const resolvedTone = tone || (status ? STATUS_TO_TONE[status] || "neutral" : "neutral")
  const resolvedDot = typeof dot === "boolean" ? dot : Boolean(status)
  const label = children ?? (status ? status.replace(/_/g, " ") : "")

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full font-semibold capitalize whitespace-nowrap",
        SIZE_CLASS[size] || SIZE_CLASS.md,
        TONE_CLASS[resolvedTone] || TONE_CLASS.neutral,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {resolvedDot && (
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          {pulse && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          )}
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {Icon && <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />}
      {label}
    </span>
  )
}

export { Badge, STATUS_TO_TONE }
