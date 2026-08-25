 
// ════════════════════════════════════════════════════════════════════════════
// Button · system primitive · v1.0
// ────────────────────────────────────────────────────────────────────────────
// 4 variants  · primary | secondary | ghost | destructive
// 3 sizes     · sm 36px | md 44px | lg 52px
// 5 states    · default | hover | focus-visible | active | loading | disabled
//
// Behaviours:
//   · Loading preserves width — replaces inner content with a spinner only,
//     never collapses the button.
//   · Icon-text gap uses the design-system token (--icon-gap-body 8px,
//     --icon-gap-hero 12px). `tone="hero"` switches to the wider gap.
//   · Focus-visible uses the global ring from tokens.css; on dark surfaces
//     wrap with `[data-on-dark]` to swap to the white ring.
//   · ARIA: aria-busy, aria-disabled, aria-live for loading announcements.
//
// Token references (see web/src/styles/tokens.css):
//   --color-action-primary, --color-action-primary-hover, --color-action-primary-active
//   --color-action-ghost-hover, --color-action-destructive(-hover)
//   --color-text-on-violet, --color-text-link
//   --button-height-sm/md/lg, --icon-gap-body, --icon-gap-hero
//   --radius-md, --motion-fast, --ease-standard
// ════════════════════════════════════════════════════════════════════════════

import { forwardRef } from "react"
import { Loader2 } from "lucide-react"

// Size → height + horizontal padding + text size + radius (Tailwind classes)
const SIZE_CLASS = {
  sm: "h-9 px-4 text-[13px] rounded-[10px]", // 36px
  md: "h-11 px-5 text-[14px] rounded-[10px]", // 44px
  lg: "h-13 px-6 text-[15px] rounded-[12px]", // 52px (h-13 = 52px via arbitrary)
}

// Loading-spinner sizing per button size — keeps optical weight consistent
const SPINNER_SIZE = {
  sm: "h-4 w-4",
  md: "h-[18px] w-[18px]",
  lg: "h-5 w-5",
}

// Icon sizing per button size
const ICON_SIZE = {
  sm: "h-4 w-4",
  md: "h-[18px] w-[18px]",
  lg: "h-5 w-5",
}

// Variant base (color + border + shadow at rest)
const VARIANT_CLASS = {
  primary:
    "bg-[var(--color-action-primary)] text-[var(--color-text-on-violet)] " +
    "shadow-[0_4px_14px_rgb(var(--color-violet-rgb)/0.18)] " +
    "hover:bg-[var(--color-action-primary-hover)] hover:shadow-[0_8px_22px_rgb(var(--color-violet-rgb)/0.24)] " +
    "active:bg-[var(--color-action-primary-active)] active:shadow-[0_2px_8px_rgb(var(--color-violet-rgb)/0.20)]",

  secondary:
    "bg-[var(--color-action-secondary)] text-[var(--color-action-primary)] " +
    "border border-[var(--color-border-violet-strong)] " +
    "hover:bg-[var(--color-action-secondary-hover)] hover:border-[var(--color-action-primary-hover)] " +
    "active:bg-[var(--color-violet-pale)]",

  ghost:
    "bg-transparent text-[var(--color-action-primary)] " +
    "hover:bg-[var(--color-action-ghost-hover)] " +
    "active:bg-[var(--color-violet-pale)]",

  destructive:
    "bg-[var(--color-action-destructive)] text-[var(--color-text-on-violet)] " +
    "shadow-[0_4px_14px_rgb(var(--color-rose-rgb)/0.18)] " +
    "hover:bg-[var(--color-action-destructive-hover)] " +
    "active:bg-[var(--color-action-destructive-active)]",
}

const BASE_CLASS =
  "relative inline-flex items-center justify-center " +
  "font-semibold tracking-[-0.005em] whitespace-nowrap select-none " +
  "transition-[background-color,border-color,box-shadow,transform] " +
  "duration-[var(--motion-fast)] ease-[var(--ease-standard)] " +
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none " +
  "disabled:hover:translate-y-0 motion-safe:hover:-translate-y-px " +
  "active:translate-y-0"

/**
 * Button · primary call-to-action and action surfaces across the app.
 *
 * Props:
 *   variant?  · "primary" (default) · "secondary" · "ghost" · "destructive"
 *   size?     · "sm" · "md" (default) · "lg"
 *   tone?     · "body" (default) · "hero"   — switches icon-text gap to 12px
 *   icon?     · Lucide icon component (renders left of children)
 *   iconRight?· Lucide icon component (renders right of children)
 *   loading?  · boolean — replaces content with spinner, preserves width
 *   fullWidth?· boolean — block-level button (w-full)
 *   as?       · "button" (default) · "a" — render as anchor when navigating
 *   className?· string — escape hatch; appended last
 *   ...rest   · forwarded to the underlying element (onClick, type, href, etc.)
 *
 * Refs are forwarded to the underlying element for focus management.
 */
const Button = forwardRef(function Button(
  {
    children,
    variant = "primary",
    size = "md",
    tone = "body",
    icon: Icon,
    iconRight: IconRight,
    loading = false,
    fullWidth = false,
    as = "button",
    type,
    disabled,
    className = "",
    ...rest
  },
  ref,
) {
  const Component = as
  const gapStyle = { gap: tone === "hero" ? "var(--icon-gap-hero)" : "var(--icon-gap-body)" }
  const isDisabled = disabled || loading

  // Pass `type="button"` by default for <button> — prevents accidental form submit
  const elementType =
    Component === "button" ? { type: type || "button" } : Component === "a" ? {} : {}

  return (
    <Component
      ref={ref}
      disabled={Component === "button" ? isDisabled : undefined}
      aria-disabled={isDisabled || undefined}
      aria-busy={loading || undefined}
      className={[
        BASE_CLASS,
        SIZE_CLASS[size] || SIZE_CLASS.md,
        VARIANT_CLASS[variant] || VARIANT_CLASS.primary,
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={gapStyle}
      {...elementType}
      {...rest}
    >
      {/* Loading state: spinner replaces inner content but width is preserved
          by the invisible content underneath (visibility:hidden — keeps layout). */}
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2
            className={`${SPINNER_SIZE[size] || SPINNER_SIZE.md} animate-spin`}
            aria-hidden="true"
          />
          <span className="sr-only" role="status" aria-live="polite">
            Loading
          </span>
        </span>
      )}

      <span
        className={`inline-flex items-center ${loading ? "invisible" : ""}`}
        style={gapStyle}
      >
        {Icon && <Icon className={`${ICON_SIZE[size] || ICON_SIZE.md} shrink-0`} aria-hidden="true" />}
        {children}
        {IconRight && (
          <IconRight className={`${ICON_SIZE[size] || ICON_SIZE.md} shrink-0`} aria-hidden="true" />
        )}
      </span>
    </Component>
  )
})

export default Button
export { Button }
