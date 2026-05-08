// ════════════════════════════════════════════════════════════════════════════
// EmptyState · system composite · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Used whenever a list/grid/table has zero rows. Visual rhythm:
//
//   ┌──────────────────────────────────────┐
//   │            ┌────────┐                │
//   │            │ ICON   │  56 × 56       │
//   │            └────────┘                │
//   │      Heading  (max 5 words)          │
//   │      Body     (1 sentence)           │
//   │      [ CTA Button ]    (optional)    │
//   └──────────────────────────────────────┘
//
// Variants:
//   · default — bordered/dashed surface, suitable inside a Card or section
//   · plain   — no border, minimal — for nested contexts
//
// COPY discipline (enforced by COPY_VOICE.md):
//   · Heading: 2–5 words, sentence case, no period.
//   · Body:    one sentence, conversational, ≤ 110 chars.
//   · Action:  imperative verb-first label, never "Click here".
// ════════════════════════════════════════════════════════════════════════════

const VARIANT_CLASS = {
  default:
    "border border-dashed border-[var(--color-border-strong)] bg-[var(--color-violet-ghost)]",
  plain:
    "border-0 bg-transparent",
}

const SIZE_CLASS = {
  sm: "py-10 px-6",
  md: "py-14 px-6",
  lg: "py-20 px-8",
}

/**
 * EmptyState · zero-result placeholder with optional action.
 *
 * Props:
 *   icon       · Lucide icon component (required)
 *   title      · 2–5 word heading (required)
 *   description?· single sentence body
 *   action?    · ReactNode (typically a <Button>)
 *   secondary? · ReactNode (small ghost link below the action)
 *   variant?   · "default" (default) · "plain"
 *   size?      · "sm" · "md" (default) · "lg"
 *   className? · outer wrapper class
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondary,
  variant = "default",
  size = "md",
  className = "",
}) {
  return (
    <div
      role="status"
      className={[
        "flex flex-col items-center justify-center text-center rounded-[14px]",
        VARIANT_CLASS[variant] || VARIANT_CLASS.default,
        SIZE_CLASS[size] || SIZE_CLASS.md,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {Icon && (
        <div
          className="mb-5 flex h-14 w-14 items-center justify-center rounded-[14px] bg-[var(--color-violet-pale)] text-[var(--color-violet)]"
          aria-hidden="true"
        >
          <Icon className="h-7 w-7" />
        </div>
      )}

      {title && (
        <h3 className="text-card text-[var(--color-violet)]">
          {title}
        </h3>
      )}

      {description && (
        <p className="mt-2 max-w-[42ch] text-body text-[var(--color-text-secondary)]">
          {description}
        </p>
      )}

      {action && <div className="mt-6">{action}</div>}
      {secondary && <div className="mt-3 text-[13px]">{secondary}</div>}
    </div>
  )
}

export { EmptyState }
