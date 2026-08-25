import { forwardRef, useId, useState } from "react"

/**
 * FloatingLabelInput · branded floating-label input
 *
 * Visual states:
 *   resting (empty, unfocused): label centred over the input baseline
 *   filled / focused          : label scales 0.78 and lifts to the
 *                               top-left corner of the field
 *
 * The label animation is CSS-only (no Framer Motion needed) so input
 * focus is instantaneous and a11y trees stay quiet. Both label position
 * states are derived from `:placeholder-shown` so the JS doesn't need
 * to track value — the input owns its state, the label reacts to it.
 *
 * The component forwards refs and any standard input props so it drops
 * into existing form-handling code (react-hook-form, controlled state,
 * uncontrolled defaults) without changes.
 *
 * Required: `label`. Optional `error` shows a tinted error message and
 * tints the border. Optional `hint` shows below the input.
 *
 * Brand:
 *   - Border default: slate-200 hairline
 *   - Focus ring: violet
 *   - Error tint: rose-700
 *   - Filled state has a subtle white-on-mist contrast against page bg
 */
const FloatingLabelInput = forwardRef(function FloatingLabelInput(
  {
    label,
    error,
    hint,
    id,
    className = "",
    inputClassName = "",
    type = "text",
    required = false,
    ...rest
  },
  ref,
) {
  const generatedId = useId()
  const fieldId     = id || generatedId
  const errorId     = `${fieldId}-error`
  const hintId      = `${fieldId}-hint`

  // Track focus so the focus ring can colour-shift even when filled.
  const [focused, setFocused] = useState(false)

  const borderColor = error
    ? "border-rose-700/60 focus-within:border-rose-700"
    : focused
      ? "border-violet"
      : "border-slate-200 hover:border-slate-300"

  const ringColor = error
    ? "focus-within:ring-rose-700/20"
    : "focus-within:ring-violet/20"

  return (
    <div className={className}>
      <div
        className={`relative rounded-xl border bg-white transition-colors ${borderColor} focus-within:ring-[3px] ${ringColor}`}
      >
        {/* Placeholder is forced to a single space so :placeholder-shown
            evaluates against emptiness — the floating label sits on top
            and is the user-visible "placeholder". We spread `rest` FIRST
            so caller-supplied placeholders (legacy/translation strings)
            are silently overridden by our space, otherwise the floating
            label CSS would never trigger. */}
        <input
          {...rest}
          ref={ref}
          id={fieldId}
          type={type}
          placeholder=" "
          required={required}
          aria-invalid={!!error || undefined}
          aria-describedby={[error ? errorId : null, hint ? hintId : null]
            .filter(Boolean)
            .join(" ") || undefined}
          onFocus={(e) => {
            setFocused(true)
            rest.onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            rest.onBlur?.(e)
          }}
          className={`peer block w-full bg-transparent px-4 pt-6 pb-2 text-[15px] text-charcoal outline-none placeholder:text-transparent disabled:cursor-not-allowed disabled:opacity-60 ${inputClassName}`}
        />
        <label
          htmlFor={fieldId}
          className={`pointer-events-none absolute left-4 origin-left text-[15px] text-charcoal-80/65 transition-all duration-200 ease-out
            top-4 peer-placeholder-shown:top-4 peer-placeholder-shown:scale-100 peer-placeholder-shown:text-charcoal-80/65
            peer-focus:top-1.5 peer-focus:scale-[0.78] peer-focus:text-violet
            peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:scale-[0.78]
            ${error ? "peer-focus:text-rose-700 peer-[:not(:placeholder-shown)]:text-rose-700" : ""}`}
        >
          {label}
          {required && <span aria-hidden="true" className="ml-0.5 text-rose-700">*</span>}
        </label>
      </div>

      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-[12px] text-charcoal-80/65">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 text-[12px] font-medium text-rose-700">
          {error}
        </p>
      )}
    </div>
  )
})

export default FloatingLabelInput
