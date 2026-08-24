 
// ════════════════════════════════════════════════════════════════════════════
// Input · system primitive · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Composition:
//   ┌──────────────────────────────────────┐
//   │ Label  (text-meta, top-aligned)      │
//   ├──────────────────────────────────────┤
//   │ [icon] field [trailing] (44px tall)  │
//   ├──────────────────────────────────────┤
//   │ Helper / Error  (text-meta below)    │
//   └──────────────────────────────────────┘
//
// Behaviours:
//   · Border-color transitions on focus to violet (2px); on error to danger.
//   · Helper text and error text share the same line — error takes priority.
//   · Auto-generates an id when one isn't supplied so label htmlFor works.
//   · `aria-invalid` and `aria-describedby` wired automatically.
//
// Token references:
//   --input-height (44px), --color-border-default/strong, --color-action-primary,
//   --color-feedback-danger(-text), --radius-md, --motion-fast, --ease-standard
// ════════════════════════════════════════════════════════════════════════════

import { forwardRef, useId } from "react"

const FIELD_BASE =
  "w-full h-11 px-4 text-[14px] leading-[1.4] " +
  "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] " +
  "placeholder:text-[var(--color-text-muted)] " +
  "rounded-[10px] border " +
  "transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-standard)] " +
  "focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed " +
  "disabled:bg-[var(--color-surface-elevated)]"

const STATE_BORDER = {
  default:
    "border-[var(--color-border-default)] " +
    "hover:border-[var(--color-border-strong)] " +
    "focus:border-[var(--color-action-primary)] focus:shadow-[0_0_0_3px_rgba(93,63,211,0.12)]",
  error:
    "border-[var(--color-feedback-danger)] " +
    "focus:border-[var(--color-feedback-danger)] focus:shadow-[0_0_0_3px_rgba(220,38,38,0.15)]",
}

/**
 * Input · single-line text field with label, helper, and error support.
 *
 * Props:
 *   label?       · string — top-aligned label (visually + accessibly)
 *   hint?        · string — helper copy below the field (left-aligned)
 *   error?       · string — error copy; takes precedence over hint
 *   icon?        · Lucide component — leading icon inside the field
 *   trailing?    · ReactNode — right-aligned content (e.g. unit, action)
 *   required?    · boolean — appends a subtle "*" to the label
 *   className?   · string — applied to the OUTER wrapper
 *   inputClass?  · string — applied to the INPUT element only
 *   ...rest      · all standard <input> props (type, value, onChange, etc.)
 */
const Input = forwardRef(function Input(
  {
    label,
    hint,
    error,
    icon: Icon,
    trailing,
    required,
    id: idProp,
    className = "",
    inputClass = "",
    ...rest
  },
  ref,
) {
  const reactId = useId()
  const id = idProp || `inp-${reactId}`
  const helpId = `${id}-help`
  const hasError = Boolean(error)

  const fieldClass = [
    FIELD_BASE,
    STATE_BORDER[hasError ? "error" : "default"],
    Icon ? "pl-11" : "",
    trailing ? "pr-12" : "",
    inputClass,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="text-[12px] font-semibold text-[var(--color-text-secondary)]"
        >
          {label}
          {required && <span className="ml-0.5 text-[var(--color-feedback-danger)]" aria-hidden="true">*</span>}
        </label>
      )}

      <div className="relative">
        {Icon && (
          <Icon
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-[var(--color-text-muted)]"
            aria-hidden="true"
          />
        )}
        <input
          ref={ref}
          id={id}
          required={required}
          aria-invalid={hasError || undefined}
          aria-describedby={hint || error ? helpId : undefined}
          className={fieldClass}
          {...rest}
        />
        {trailing && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-[var(--color-text-muted)]">
            {trailing}
          </div>
        )}
      </div>

      {(hint || error) && (
        <p
          id={helpId}
          className={
            hasError
              ? "text-[12px] leading-[1.5] text-[var(--color-feedback-danger-text)]"
              : "text-[12px] leading-[1.5] text-[var(--color-text-muted)]"
          }
        >
          {error || hint}
        </p>
      )}
    </div>
  )
})

export default Input
export { Input }
