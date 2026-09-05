 
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
  // D6-5 · `xs` lays the icon BESIDE the copy instead of above it, and that
  // is the whole point of the step rather than just less padding.
  //
  // Measured on a brand-new client project at 375px: nine empty
  // placeholders totalling 1,767px on a 3,237px page — 55% of the screen
  // was boxes saying nothing is here — and they ranged from 68px to 284px,
  // so they did not even read as the same kind of thing. Five were this
  // component at `md`, where a 56px stacked icon plus a heading plus a
  // sentence is ~270px.
  //
  // A section inside a ten-section page is not a page-level zero state. At
  // `xs` this lands near 90px, which matches the dashed strips the same page
  // already uses, so the nine of them finally look like one family.
  // Page-level empties (a whole route with no rows) keep `md`.
  xs: "py-4 px-4",
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
 *   size?      · "xs" (icon beside the copy, for a section inside a long
 *                page) · "sm" · "md" (default) · "lg"
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
        "rounded-[14px]",
        size === "xs"
          ? "flex items-start gap-3 text-start"
          : "flex flex-col items-center justify-center text-center",
        VARIANT_CLASS[variant] || VARIANT_CLASS.default,
        SIZE_CLASS[size] || SIZE_CLASS.md,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {Icon && (
        <div
          className={[
            "flex shrink-0 items-center justify-center rounded-[14px] bg-[var(--color-violet-pale)] text-[var(--color-violet)]",
            size === "xs" ? "h-9 w-9" : "mb-5 h-14 w-14",
          ].join(" ")}
          aria-hidden="true"
        >
          <Icon className={size === "xs" ? "h-4 w-4" : "h-7 w-7"} />
        </div>
      )}

      <div className={size === "xs" ? "min-w-0" : "contents"}>
        {title && (
          <h3 className={size === "xs" ? "text-meta font-semibold text-[var(--color-violet)]" : "text-card text-[var(--color-violet)]"}>
            {title}
          </h3>
        )}

        {description && (
          <p className={[
            "max-w-[42ch] text-[var(--color-text-secondary)]",
            size === "xs" ? "mt-0.5 text-micro" : "mt-2 text-body",
          ].join(" ")}>
            {description}
          </p>
        )}

        {action && <div className={size === "xs" ? "mt-3" : "mt-6"}>{action}</div>}
        {secondary && <div className={size === "xs" ? "mt-2 text-micro" : "mt-3 text-[13px]"}>{secondary}</div>}
      </div>
    </div>
  )
}

export { EmptyState }

export { EmptyState as EmptyStateSurface }
