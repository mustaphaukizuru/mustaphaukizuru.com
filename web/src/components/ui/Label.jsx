// ════════════════════════════════════════════════════════════════════════════
// Label · ui primitive · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Standalone form label, used when composing custom field layouts where
// <Input>/<Textarea>/<Select> aren't appropriate (e.g. file upload, custom
// pickers, group of switches). Matches the inline label style used by the
// other form primitives so columns line up.
// ════════════════════════════════════════════════════════════════════════════

import { forwardRef } from "react"

/**
 * Label · semantic <label> aligned to the form-system design tokens.
 *
 * Props:
 *   htmlFor?      · id of the field this labels
 *   required?     · boolean — appends a subtle red asterisk
 *   muted?        · boolean — softens to text-muted (used for optional hints)
 *   size?         · "sm" (12px) (default) · "md" (13px) · "lg" (14px)
 *   className?    · escape hatch
 */
const Label = forwardRef(function Label(
  { children, htmlFor, required, muted, size = "sm", className = "", ...rest },
  ref,
) {
  const sizeClass = {
    sm: "text-[12px]",
    md: "text-[13px]",
    lg: "text-[14px]",
  }[size] || "text-[12px]"

  return (
    <label
      ref={ref}
      htmlFor={htmlFor}
      className={[
        "font-semibold leading-[1.4]",
        sizeClass,
        muted
          ? "text-[var(--color-text-muted)]"
          : "text-[var(--color-text-secondary)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
      {required && (
        <span className="ml-0.5 text-[var(--color-feedback-danger)]" aria-hidden="true">
          *
        </span>
      )}
    </label>
  )
})

export default Label
export { Label }
