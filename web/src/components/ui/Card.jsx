 
// ════════════════════════════════════════════════════════════════════════════
// Card · system primitive · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Variants:
//   · static       (default) — surface for content, no hover affordance
//   · interactive  — clickable; lifts -2px and elevates shadow on hover
//   · feature      — violet-tinted surface for highlight/feature blocks
//   · dark         — dark surface for inverted contexts
//
// Padding tokens: sm (16px), md (24px default), lg (32px) — maps to space-4/6/8.
// Radius is rounded-lg (--radius-lg = 14px) per spec.
// Shadow uses the rest/hover token ladder.
//
// Sub-components:
//   · Card.Header   — top region; align with section padding
//   · Card.Body     — main content
//   · Card.Footer   — bordered action row (button group, meta)
//
// When `interactive` is true and an `onClick` or `as="a" href={...}` is set,
// the whole surface becomes a focusable target with the standard focus ring.
// ════════════════════════════════════════════════════════════════════════════

import { forwardRef } from "react"

const PADDING_CLASS = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
}

const VARIANT_CLASS = {
  static:
    "bg-[var(--color-surface-card)] " +
    "border border-[var(--color-border-subtle)] " +
    "shadow-[var(--shadow-rest)]",

  interactive:
    "bg-[var(--color-surface-card)] " +
    "border border-[var(--color-border-subtle)] " +
    "shadow-[var(--shadow-rest)] " +
    "transition-[transform,box-shadow,border-color] " +
    "duration-[var(--motion-base)] ease-[var(--ease-standard)] " +
    "hover:border-[var(--color-border-violet)] hover:shadow-[var(--shadow-hover)] " +
    "motion-safe:hover:-translate-y-0.5 cursor-pointer",

  feature:
    "bg-[var(--color-violet-ghost)] " +
    "border border-[var(--color-border-violet)] " +
    "shadow-[var(--shadow-rest)]",

  dark:
    "bg-[var(--color-surface-dark)] text-[var(--color-text-on-dark)] " +
    "border border-[var(--color-border-on-dark)] " +
    "shadow-[var(--shadow-rest)]",
}

/**
 * Card · primary surface for grouped content.
 *
 * Props:
 *   variant?  · "static" (default) · "interactive" · "feature" · "dark"
 *   padding?  · "none" · "sm" · "md" (default) · "lg"
 *   as?       · "div" (default) · "a" · "article" · "button" — element type
 *   className?· escape hatch
 *   ...rest   · passed to underlying element
 */
const Card = forwardRef(function Card(
  {
    children,
    variant = "static",
    padding = "md",
    as = "div",
    className = "",
    ...rest
  },
  ref,
) {
  const Component = as
  return (
    <Component
      ref={ref}
      data-on-dark={variant === "dark" ? "" : undefined}
      className={[
        "rounded-[14px] block",
        VARIANT_CLASS[variant] || VARIANT_CLASS.static,
        PADDING_CLASS[padding] ?? PADDING_CLASS.md,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </Component>
  )
})

// ── Card.Header ────────────────────────────────────────────────────────────
// Sizes use the platform `text-card` (titles) and `text-body` (subtitles)
// tokens instead of arbitrary px so future type-scale changes propagate.
function CardHeader({ title, subtitle, action, className = "" }) {
  return (
    <div
      className={[
        "flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
        className,
      ].join(" ")}
    >
      <div className="min-w-0 flex-1">
        {title && (
          <h3 className="text-card text-[var(--color-violet)]">
            {title}
          </h3>
        )}
        {subtitle && (
          <p className="mt-1 text-body text-[var(--color-text-secondary)]">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

// ── Card.Body ──────────────────────────────────────────────────────────────
function CardBody({ children, className = "" }) {
  return <div className={`text-body ${className}`}>{children}</div>
}

// ── Card.Footer ────────────────────────────────────────────────────────────
function CardFooter({ children, className = "" }) {
  return (
    <div
      className={[
        "flex flex-wrap items-center justify-end gap-3 pt-4 mt-4",
        "border-t border-[var(--color-border-subtle)]",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  )
}

Card.Header = CardHeader
Card.Body = CardBody
Card.Footer = CardFooter

export default Card
export { Card, CardHeader, CardBody, CardFooter }
