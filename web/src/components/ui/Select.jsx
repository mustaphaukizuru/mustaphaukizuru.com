// ════════════════════════════════════════════════════════════════════════════
// Select · ui primitive · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Brand-styled <select>. Uses the native control under the hood for
// accessibility, mobile parity, and zero JS for keyboard nav. The visual
// shell mirrors <Input> for consistency in any form column.
//
// For a richer combobox with search/filter, use the future <Combobox>;
// this primitive intentionally stays simple and reliable.
//
// Token references:
//   --input-height, --color-border-default/strong,
//   --color-action-primary, --color-feedback-danger
// ════════════════════════════════════════════════════════════════════════════

import { forwardRef, useId } from "react"
import { ChevronDown } from "lucide-react"

const FIELD_BASE =
  "appearance-none w-full h-11 pl-4 pr-10 text-[14px] leading-[1.4] " +
  "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] " +
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
 * Select · drop-down select control.
 *
 * Props:
 *   label?, hint?, error?, required?
 *   placeholder?  · string — first non-selectable option
 *   options?      · [{ value, label, disabled? }] — convenience API
 *   children?     · custom <option> children if you need optgroups, etc.
 *   className?    · outer wrapper
 *   selectClass?  · inner select element only
 *   ...rest       · standard <select> attrs
 */
const Select = forwardRef(function Select(
  {
    label,
    hint,
    error,
    required,
    placeholder,
    options,
    children,
    id: idProp,
    className = "",
    selectClass = "",
    ...rest
  },
  ref,
) {
  const reactId = useId()
  const id = idProp || `sel-${reactId}`
  const helpId = `${id}-help`
  const hasError = Boolean(error)

  const cls = [
    FIELD_BASE,
    STATE_BORDER[hasError ? "error" : "default"],
    selectClass,
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
          {required && (
            <span className="ml-0.5 text-[var(--color-feedback-danger)]" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <div className="relative">
        <select
          ref={ref}
          id={id}
          required={required}
          aria-invalid={hasError || undefined}
          aria-describedby={hint || error ? helpId : undefined}
          className={cls}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          )}
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>

        <ChevronDown
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]"
          aria-hidden="true"
        />
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

export default Select
export { Select }
