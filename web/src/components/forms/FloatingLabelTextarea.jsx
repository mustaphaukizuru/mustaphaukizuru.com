import { forwardRef, useId, useState } from "react"

/**
 * FloatingLabelTextarea · companion to FloatingLabelInput for multi-line
 *
 * Same floating-label motion treatment, but rendered around a `<textarea>`
 * with a configurable `rows` prop and an optional `maxLength` counter
 * shown in the bottom-right corner of the field while focused.
 *
 * See FloatingLabelInput.jsx for the rationale on :placeholder-shown
 * driving the label position via CSS.
 */
const FloatingLabelTextarea = forwardRef(function FloatingLabelTextarea(
  {
    label,
    error,
    hint,
    id,
    className = "",
    textareaClassName = "",
    rows = 4,
    required = false,
    value,
    defaultValue,
    maxLength,
    ...rest
  },
  ref,
) {
  const generatedId = useId()
  const fieldId     = id || generatedId
  const errorId     = `${fieldId}-error`
  const hintId      = `${fieldId}-hint`

  const [focused, setFocused] = useState(false)
  // Track length only when a counter is requested. Read from value when
  // controlled, else from a small piece of internal state for the
  // uncontrolled case.
  const [internalLen, setInternalLen] = useState(
    typeof defaultValue === "string" ? defaultValue.length : 0
  )
  const liveLen = typeof value === "string" ? value.length : internalLen

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
        <textarea
          {...rest}
          ref={ref}
          id={fieldId}
          rows={rows}
          placeholder=" "
          required={required}
          value={value}
          defaultValue={defaultValue}
          maxLength={maxLength}
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
          onChange={(e) => {
            if (typeof value !== "string") setInternalLen(e.target.value.length)
            rest.onChange?.(e)
          }}
          className={`peer block w-full resize-none bg-transparent px-4 pt-6 pb-3 text-[15px] leading-relaxed text-charcoal outline-none placeholder:text-transparent disabled:cursor-not-allowed disabled:opacity-60 ${textareaClassName}`}
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

        {/* Inline counter — only when maxLength is set and the field is
            focused, to avoid distracting numeric noise in the resting
            state. */}
        {maxLength && focused && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-2 right-3 font-mono text-[10.5px] tabular-nums text-charcoal-80/65"
          >
            {liveLen}/{maxLength}
          </span>
        )}
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

export default FloatingLabelTextarea
