// ════════════════════════════════════════════════════════════════════════════
// Checkbox · ui primitive · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Accessible checkbox supporting unchecked / checked / indeterminate.
// Wraps a hidden native <input type="checkbox"> for free form-association
// and screen-reader semantics, painted over with a brand-aligned mark.
//
// Dumb component: receives `checked` + `onChange`, never fetches data.
//
// Sizes:    sm (16px) · md (20px default) · lg (24px)
// States:   default · hover · focus-visible · checked · indeterminate
//           · error · disabled
//
// Token references:
//   --color-action-primary      · checked fill
//   --color-border-default      · idle border
//   --color-feedback-danger     · error border
//   --motion-fast / --ease-standard
// ════════════════════════════════════════════════════════════════════════════

import { forwardRef, useId, useEffect, useRef, useState } from "react"
import { Check, Minus } from "lucide-react"

const SIZE = {
  sm: { box: "h-4 w-4", icon: "h-3 w-3", text: "text-[13px]" },
  md: { box: "h-5 w-5", icon: "h-3.5 w-3.5", text: "text-[14px]" },
  lg: { box: "h-6 w-6", icon: "h-4 w-4", text: "text-[15px]" },
}

/**
 * Checkbox · single boolean toggle, label-aware.
 *
 * Props:
 *   label?         · ReactNode — label sits to the right of the box
 *   description?   · string — secondary copy below the label
 *   checked?       · boolean (controlled)
 *   defaultChecked?· boolean (uncontrolled)
 *   onChange?      · (checked, event) => void
 *   indeterminate? · boolean — visual third-state
 *   error?         · string — switches the box border to danger; shown below
 *   size?          · "sm" · "md" (default) · "lg"
 *   disabled?      · boolean
 *   required?      · boolean
 *   name?, value?  · standard form attrs
 *   className?     · escape hatch on the outer label
 */
const Checkbox = forwardRef(function Checkbox(
  {
    label,
    description,
    checked,
    defaultChecked,
    onChange,
    indeterminate = false,
    error,
    size = "md",
    disabled = false,
    required = false,
    id: idProp,
    className = "",
    ...rest
  },
  refProp,
) {
  const reactId = useId()
  const id = idProp || `chk-${reactId}`
  const helpId = `${id}-help`
  const hasError = Boolean(error)
  const cfg = SIZE[size] || SIZE.md
  const isControlled = typeof checked === "boolean"

  // Track checked locally so we can render the correct mark — works for both
  // controlled (synced via prop) and uncontrolled (driven by the input)
  const [internalChecked, setInternalChecked] = useState(Boolean(defaultChecked))
  const isChecked = isControlled ? checked : internalChecked

  // Merge external + internal ref; native indeterminate is set imperatively
  const innerRef = useRef(null)
  const setRefs = (node) => {
    innerRef.current = node
    if (typeof refProp === "function") refProp(node)
    else if (refProp) refProp.current = node
  }

  useEffect(() => {
    if (innerRef.current) innerRef.current.indeterminate = Boolean(indeterminate)
  }, [indeterminate])

  const handleChange = (e) => {
    if (!isControlled) setInternalChecked(e.target.checked)
    onChange?.(e.target.checked, e)
  }

  return (
    <label
      htmlFor={id}
      className={[
        "group inline-flex items-start gap-3 select-none",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Visually-hidden native input, the source of truth for a11y + forms */}
      <input
        ref={setRefs}
        id={id}
        type="checkbox"
        checked={isControlled ? checked : undefined}
        defaultChecked={isControlled ? undefined : defaultChecked}
        onChange={handleChange}
        disabled={disabled}
        required={required}
        aria-invalid={hasError || undefined}
        aria-describedby={description || error ? helpId : undefined}
        className="peer sr-only"
        {...rest}
      />

      {/* Custom box, styles react to peer state via Tailwind peer-* */}
      <span
        aria-hidden="true"
        className={[
          "relative flex shrink-0 items-center justify-center mt-[2px]",
          cfg.box,
          "rounded-[6px] border bg-[var(--color-surface-card)]",
          "transition-[background-color,border-color,box-shadow]",
          "duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
          hasError
            ? "border-[var(--color-feedback-danger)]"
            : "border-[var(--color-border-default)] group-hover:border-[var(--color-border-strong)]",
          isChecked || indeterminate
            ? "bg-[var(--color-action-primary)] border-[var(--color-action-primary)]"
            : "",
          "peer-focus-visible:shadow-[0_0_0_3px_rgba(93,63,211,0.18)]",
          hasError && "peer-focus-visible:shadow-[0_0_0_3px_rgba(220,38,38,0.18)]",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {indeterminate ? (
          <Minus
            strokeWidth={3}
            className={`${cfg.icon} text-[var(--color-text-on-violet)]`}
          />
        ) : isChecked ? (
          <Check
            strokeWidth={3}
            className={`${cfg.icon} text-[var(--color-text-on-violet)]`}
          />
        ) : null}
      </span>

      {(label || description || error) && (
        <span className="min-w-0">
          {label && (
            <span
              className={[
                "block leading-[1.4] font-medium text-[var(--color-text-primary)]",
                cfg.text,
              ].join(" ")}
            >
              {label}
              {required && (
                <span
                  className="ml-1 text-[var(--color-feedback-danger)]"
                  aria-hidden="true"
                >
                  *
                </span>
              )}
            </span>
          )}
          {description && !error && (
            <span
              id={helpId}
              className="mt-0.5 block text-[12px] leading-[1.5] text-[var(--color-text-muted)]"
            >
              {description}
            </span>
          )}
          {error && (
            <span
              id={helpId}
              className="mt-0.5 block text-[12px] leading-[1.5] text-[var(--color-feedback-danger-text)]"
            >
              {error}
            </span>
          )}
        </span>
      )}
    </label>
  )
})

// ── CheckboxGroup ──────────────────────────────────────────────────────────
// Convenience wrapper for multi-select lists. Accepts an `options` array
// and an array `value`, returns the new array via `onChange`.
function CheckboxGroup({
  label,
  description,
  options = [],
  value = [],
  onChange,
  size = "md",
  className = "",
  orientation = "vertical",
  error,
}) {
  const handleToggle = (optValue, isChecked) => {
    if (!onChange) return
    if (isChecked) onChange([...value, optValue])
    else onChange(value.filter((v) => v !== optValue))
  }

  return (
    <fieldset className={`flex flex-col gap-3 ${className}`}>
      {label && (
        <legend className="text-[12px] font-semibold text-[var(--color-text-secondary)]">
          {label}
        </legend>
      )}
      {description && (
        <p className="-mt-1 text-[12px] leading-[1.5] text-[var(--color-text-muted)]">
          {description}
        </p>
      )}
      <div
        className={[
          "flex gap-3",
          orientation === "horizontal" ? "flex-row flex-wrap gap-x-6" : "flex-col",
        ].join(" ")}
      >
        {options.map((opt) => (
          <Checkbox
            key={opt.value}
            label={opt.label}
            description={opt.description}
            value={opt.value}
            checked={value.includes(opt.value)}
            disabled={opt.disabled}
            size={size}
            onChange={(c) => handleToggle(opt.value, c)}
          />
        ))}
      </div>
      {error && (
        <p className="text-[12px] leading-[1.5] text-[var(--color-feedback-danger-text)]">
          {error}
        </p>
      )}
    </fieldset>
  )
}

Checkbox.Group = CheckboxGroup

export default Checkbox
export { Checkbox, CheckboxGroup }
