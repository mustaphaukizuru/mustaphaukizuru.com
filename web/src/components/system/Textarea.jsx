// ════════════════════════════════════════════════════════════════════════════
// Textarea · system primitive · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Mirrors Input's label/helper/error pattern. Uses min-height instead of
// fixed height — grows with rows. Optional auto-grow handler for ergonomic
// long-form composition (contact, support, project briefs).
// ════════════════════════════════════════════════════════════════════════════

import { forwardRef, useId, useEffect, useRef } from "react"

const FIELD_BASE =
  "w-full px-4 py-3 text-[14px] leading-[1.55] " +
  "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] " +
  "placeholder:text-[var(--color-text-muted)] " +
  "rounded-[10px] border resize-y " +
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
 * Textarea · multi-line text input.
 *
 * Props (in addition to standard <textarea> attrs):
 *   label?      · string
 *   hint?       · string
 *   error?      · string
 *   maxLength?  · number — when set, shows a live counter under the field
 *   autoGrow?   · boolean — resize-to-fit content as the user types
 *   className?  · outer wrapper class
 *   inputClass? · textarea-only class
 */
const Textarea = forwardRef(function Textarea(
  {
    label,
    hint,
    error,
    required,
    autoGrow = false,
    maxLength,
    rows = 4,
    id: idProp,
    className = "",
    inputClass = "",
    onInput,
    value,
    defaultValue,
    ...rest
  },
  refProp,
) {
  const reactId = useId()
  const id = idProp || `txt-${reactId}`
  const helpId = `${id}-help`
  const hasError = Boolean(error)

  // Internal ref used for autoGrow; merge with external ref so consumers keep control.
  const innerRef = useRef(null)
  const setRefs = (node) => {
    innerRef.current = node
    if (typeof refProp === "function") refProp(node)
    else if (refProp) refProp.current = node
  }

  // Resize on mount and whenever value changes (controlled mode)
  useEffect(() => {
    if (!autoGrow || !innerRef.current) return
    const el = innerRef.current
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [autoGrow, value])

  const handleInput = (e) => {
    if (autoGrow && innerRef.current) {
      innerRef.current.style.height = "auto"
      innerRef.current.style.height = `${innerRef.current.scrollHeight}px`
    }
    if (onInput) onInput(e)
  }

  const fieldClass = [
    FIELD_BASE,
    STATE_BORDER[hasError ? "error" : "default"],
    autoGrow ? "overflow-hidden resize-none" : "",
    inputClass,
  ]
    .filter(Boolean)
    .join(" ")

  // Counter — controlled value preferred; falls back to defaultValue length
  const currentLength =
    typeof value === "string" ? value.length : typeof defaultValue === "string" ? defaultValue.length : 0

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

      <textarea
        ref={setRefs}
        id={id}
        rows={rows}
        required={required}
        maxLength={maxLength}
        value={value}
        defaultValue={defaultValue}
        onInput={handleInput}
        aria-invalid={hasError || undefined}
        aria-describedby={hint || error ? helpId : undefined}
        className={fieldClass}
        {...rest}
      />

      {(hint || error || maxLength) && (
        <div className="flex items-start justify-between gap-3">
          <p
            id={helpId}
            className={
              hasError
                ? "text-[12px] leading-[1.5] text-[var(--color-feedback-danger-text)]"
                : "text-[12px] leading-[1.5] text-[var(--color-text-muted)]"
            }
          >
            {error || hint || ""}
          </p>
          {maxLength && (
            <span
              className="shrink-0 text-[11px] tabular-nums text-[var(--color-text-muted)]"
              aria-live="polite"
            >
              {currentLength}/{maxLength}
            </span>
          )}
        </div>
      )}
    </div>
  )
})

export default Textarea
export { Textarea }
