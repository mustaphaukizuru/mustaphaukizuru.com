// ════════════════════════════════════════════════════════════════════════════
// Progress · ui primitive · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Determinate or indeterminate horizontal progress bar.
// Use for upload progress, multi-step checkout, profile completion, etc.
//
// Sizes:    sm (4px) · md (6px default) · lg (10px)
// Tones:    violet (default) · success · warning · danger · info · neutral
// ════════════════════════════════════════════════════════════════════════════

const SIZE = {
  sm: "h-1",
  md: "h-1.5",
  lg: "h-2.5",
}

const TONE = {
  violet: "bg-[var(--color-action-primary)]",
  success: "bg-[var(--color-feedback-success)]",
  warning: "bg-[var(--color-feedback-warning)]",
  danger: "bg-[var(--color-feedback-danger)]",
  info: "bg-[var(--color-feedback-info)]",
  neutral: "bg-[var(--color-text-muted)]",
}

/**
 * Progress · linear progress bar.
 *
 * Props:
 *   value?         · 0–100 (omit for indeterminate)
 *   max?           · default 100
 *   size?          · "sm" · "md" (default) · "lg"
 *   tone?          · "violet" (default) · "success" · "warning" · "danger" · "info" · "neutral"
 *   label?         · string — visible label above the bar
 *   showValue?     · boolean — render percentage on the right of the label
 *   className?     · escape hatch on outer wrapper
 *   barClass?      · override on the filled bar
 */
export default function Progress({
  value,
  max = 100,
  size = "md",
  tone = "violet",
  label,
  showValue = false,
  className = "",
  barClass = "",
}) {
  const isIndeterminate = typeof value !== "number"
  const pct = isIndeterminate
    ? 0
    : Math.max(0, Math.min(100, (value / max) * 100))

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-[12px] leading-[1.4]">
          {label && (
            <span className="font-semibold text-[var(--color-text-secondary)]">{label}</span>
          )}
          {showValue && !isIndeterminate && (
            <span className="font-mono tabular-nums text-[var(--color-text-muted)]">
              {Math.round(pct)}%
            </span>
          )}
        </div>
      )}

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={isIndeterminate ? undefined : 100}
        aria-valuenow={isIndeterminate ? undefined : Math.round(pct)}
        aria-busy={isIndeterminate || undefined}
        aria-label={label || "Progress"}
        className={[
          "relative w-full overflow-hidden rounded-full bg-[var(--color-surface-elevated)]",
          SIZE[size] || SIZE.md,
        ].join(" ")}
      >
        {isIndeterminate ? (
          <span
            aria-hidden="true"
            className={[
              "absolute inset-y-0 left-0 w-1/3 rounded-full",
              TONE[tone] || TONE.violet,
              "animate-[progress-indeterminate_1.4s_ease-in-out_infinite]",
              barClass,
            ].join(" ")}
            style={{
              // Fallback inline keyframes registration via CSS variable trick
              animationName: "progress-indeterminate",
            }}
          />
        ) : (
          <span
            aria-hidden="true"
            className={[
              "absolute inset-y-0 left-0 rounded-full transition-[width]",
              "duration-[var(--motion-base)] ease-[var(--ease-standard)]",
              TONE[tone] || TONE.violet,
              barClass,
            ].join(" ")}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>

      {/* Inline keyframes — Tailwind doesn't ship a sweep animation by default.
          We define it once here; if the same name exists globally, this is a no-op. */}
      <style>{`
        @keyframes progress-indeterminate {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(120%); }
          100% { transform: translateX(280%); }
        }
      `}</style>
    </div>
  )
}

export { Progress }
