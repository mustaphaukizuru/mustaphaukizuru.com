// ════════════════════════════════════════════════════════════════════════════
// IconButton · ui primitive · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Square button containing only an icon. Use for: close-buttons, menu
// triggers, table row actions, toolbar icons. Always provide `label` for
// screen readers — the visible icon alone is not accessible.
//
// Sizes: sm (32) · md (36 default) · lg (40)
// Variants: ghost (default) · soft · outline · solid · destructive
// ════════════════════════════════════════════════════════════════════════════

import { forwardRef } from "react"

const SIZE = {
  sm: { box: "h-8 w-8", icon: "h-4 w-4", radius: "rounded-[8px]" },
  md: { box: "h-9 w-9", icon: "h-4.5 w-4.5", radius: "rounded-[10px]" },
  lg: { box: "h-10 w-10", icon: "h-5 w-5", radius: "rounded-[10px]" },
}

const VARIANT = {
  ghost:
    "bg-transparent text-[var(--color-text-secondary)] " +
    "hover:bg-[var(--color-violet-pale)] hover:text-[var(--color-violet)]",
  soft:
    "bg-[var(--color-violet-pale)] text-[var(--color-violet)] " +
    "hover:bg-[var(--color-violet-pale)] hover:brightness-95",
  outline:
    "bg-[var(--color-surface-card)] text-[var(--color-text-secondary)] " +
    "border border-[var(--color-border-subtle)] " +
    "hover:border-[var(--color-border-violet)] hover:text-[var(--color-violet)] " +
    "hover:bg-[var(--color-violet-pale)]",
  solid:
    "bg-[var(--color-action-primary)] text-[var(--color-text-on-violet)] " +
    "shadow-[var(--shadow-lift-1)] " +
    "hover:bg-[var(--color-action-primary-hover)]",
  destructive:
    "bg-transparent text-[var(--color-feedback-danger)] " +
    "hover:bg-[var(--color-feedback-danger-bg)]",
}

/**
 * IconButton · square icon-only button.
 *
 * Props:
 *   icon      · Lucide icon component (required)
 *   label     · accessible label (required)
 *   size?     · "sm" · "md" (default) · "lg"
 *   variant?  · "ghost" (default) · "soft" · "outline" · "solid" · "destructive"
 *   loading?  · boolean — replaces icon with spinner
 *   as?       · "button" (default) · "a"
 *   className?· escape hatch
 *   ...rest   · forwarded
 */
const IconButton = forwardRef(function IconButton(
  {
    icon: Icon,
    label,
    size = "md",
    variant = "ghost",
    loading = false,
    as = "button",
    type,
    disabled,
    className = "",
    ...rest
  },
  ref,
) {
  const Component = as
  const cfg = SIZE[size] || SIZE.md
  const isDisabled = disabled || loading

  const elementType =
    Component === "button" ? { type: type || "button" } : {}

  return (
    <Component
      ref={ref}
      aria-label={label}
      aria-disabled={isDisabled || undefined}
      aria-busy={loading || undefined}
      disabled={Component === "button" ? isDisabled : undefined}
      className={[
        "relative inline-flex items-center justify-center select-none",
        "transition-[background-color,color,border-color,box-shadow,transform]",
        "duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
        "focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgb(var(--color-violet-rgb)/0.18)]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "motion-safe:active:translate-y-[1px]",
        cfg.box,
        cfg.radius,
        VARIANT[variant] || VARIANT.ghost,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...elementType}
      {...rest}
    >
      {loading ? (
        <span
          className={`${cfg.icon} animate-spin rounded-full border-2 border-current/40 border-t-current`}
          aria-hidden="true"
        />
      ) : Icon ? (
        <Icon className={cfg.icon} aria-hidden="true" />
      ) : null}
    </Component>
  )
})

export default IconButton
export { IconButton }
