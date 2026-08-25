 
// ════════════════════════════════════════════════════════════════════════════
// SectionHeader · system composite · v1.0
// ────────────────────────────────────────────────────────────────────────────
// The canonical pre-content stack used at the top of every section:
//
//   ┌──────────────────────────┐
//   │ [EyebrowChip]            │   ← optional
//   │   ↓  --space-3 (12px)    │
//   │ Title (text-section)     │
//   │   ↓  --space-2 (8px)     │
//   │ Subtitle (text-lead)     │   ← optional, max 2 lines
//   │   ↓  --space-10 / 12     │   ← spacing handled by parent
//   │ <content>                │
//   └──────────────────────────┘
//
// Variants:
//   · align    — "left" (default) · "center"
//   · size     — "section" (default) · "page"  · "display"
//   · onDark   — switches title and subtitle to white-on-dark colors
//
// When `eyebrow` is a string, it renders inside <EyebrowChip> with default tone.
// When eyebrow is a JSX node, it renders as-is for advanced cases.
// When `action` is provided, it sits to the right of the headline stack on
// desktop (sm:flex-row) — useful for "View all", "Manage", etc.
// ════════════════════════════════════════════════════════════════════════════

import EyebrowChip from "./EyebrowChip"

const SIZE_CLASS = {
  section: "text-section", // 24/32px
  page: "text-page", // 32/48px
  display: "text-display", // 40/64px
}

const ALIGN_CLASS = {
  left: "text-left items-start",
  center: "text-center items-center",
}

/**
 * SectionHeader · Eyebrow → Title → Subtitle composition.
 *
 * Props:
 *   eyebrow?   · string (rendered in default violet chip) OR ReactNode
 *   eyebrowTone? · forwarded to <EyebrowChip> when eyebrow is a string
 *   title      · string OR ReactNode (required)
 *   subtitle?  · string OR ReactNode
 *   action?    · ReactNode (optional right-aligned action)
 *   align?     · "left" (default) · "center"
 *   size?      · "section" (default) · "page" · "display"
 *   onDark?    · boolean — text colors invert for dark surfaces
 *   className? · outer wrapper class
 */
export default function SectionHeader({
  eyebrow,
  eyebrowTone = "violet",
  title,
  subtitle,
  action,
  align = "left",
  size = "section",
  onDark = false,
  className = "",
}) {
  const titleColor = onDark
    ? "text-[var(--color-text-on-dark)]"
    : "text-[var(--color-violet)]"
  const subtitleColor = onDark
    ? "text-[var(--color-text-on-dark-muted)]"
    : "text-[var(--color-text-secondary)]"

  const stack = (
    <div className={`flex flex-col ${ALIGN_CLASS[align] || ALIGN_CLASS.left}`}>
      {eyebrow &&
        (typeof eyebrow === "string" ? (
          <EyebrowChip tone={onDark ? "violet-inverse" : eyebrowTone}>{eyebrow}</EyebrowChip>
        ) : (
          eyebrow
        ))}

      {title && (
        <h2
          className={[
            "mt-3 font-bold tracking-tight",
            SIZE_CLASS[size] || SIZE_CLASS.section,
            titleColor,
            align === "center" ? "max-w-[44ch]" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {title}
        </h2>
      )}

      {subtitle && (
        <p
          className={[
            "mt-2 text-lead",
            subtitleColor,
            align === "center" ? "max-w-[58ch]" : "max-w-[64ch]",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {subtitle}
        </p>
      )}
    </div>
  )

  if (!action) {
    return <div className={className}>{stack}</div>
  }

  return (
    <div
      className={[
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {stack}
      <div className="shrink-0">{action}</div>
    </div>
  )
}

export { SectionHeader }
