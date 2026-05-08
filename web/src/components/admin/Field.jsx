import { useId } from "react"
import { AlertCircle } from "lucide-react"

/* ──────────────────────────────────────────────────────────────────────────
 *  Field · F10.I · Batch 6B-3
 *
 *  Labelled field wrapper that handles:
 *    - Label + required asterisk
 *    - Optional hint text below input
 *    - Optional inline error message (red, with icon)
 *    - Auto-generated id linking label and input via htmlFor
 *
 *  Pages render an input/select/textarea inside Field and pass the id
 *  forward via the render prop or via useId pattern.
 *
 *  ── API ─────────────────────────────────────────────────────────────────
 *
 *  <Field label="Title" required hint="Shown on the public page" error={errors.title}>
 *    {(id) => <input id={id} ... />}
 *  </Field>
 *
 *  Or pass children directly when ID linking isn't critical:
 *
 *  <Field label="Title" required>
 *    <input ... />
 *  </Field>
 *  ──────────────────────────────────────────────────────────────────── */

export function Field({ label, required, hint, error, children, className = "" }) {
  const generatedId = useId()
  const fieldId = `field-${generatedId}`
  const hintId = hint ? `${fieldId}-hint` : undefined
  const errorId = error ? `${fieldId}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined

  // Children can be a render prop (for id linking + describedBy) or plain JSX
  const rendered = typeof children === "function"
    ? children(fieldId, describedBy)
    : children

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={typeof children === "function" ? fieldId : undefined}
          className="mb-1 block text-meta font-semibold text-charcoal-80"
        >
          {label}
          {required && <span className="ml-1 text-rose-600" aria-label="required">*</span>}
        </label>
      )}
      {rendered}
      {hint && !error && (
        <p id={hintId} className="mt-1 text-micro text-charcoal-80/55">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 flex items-start gap-1 text-micro text-rose-600" role="alert">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Input class helper · consistent styling token-aligned with v3
 *
 *  Returns a string of classes. Use for any <input>, <select>, or
 *  <textarea> within an admin form so the visual language stays unified.
 *
 *  Variants:
 *    - default: white bg, violet border on focus, azure focus ring
 *    - error: rose border + ring on error state
 *  ──────────────────────────────────────────────────────────────────── */
export function inputClass({ error = false, className = "" } = {}) {
  return [
    "w-full rounded-lg bg-white px-3 py-2 text-meta text-violet outline-none transition",
    "placeholder:text-charcoal-80/35",
    error
      ? "border border-rose-300 focus:border-rose-400 focus:ring-[3px] focus:ring-rose-200/50"
      : "border border-charcoal-80/15 focus:border-violet/40 focus:ring-[3px] focus:ring-azure/20",
    "disabled:cursor-not-allowed disabled:bg-charcoal-80/5 disabled:opacity-60",
    className,
  ].join(" ")
}

/* ──────────────────────────────────────────────────────────────────────────
 *  FormInput · convenience wrapper for the most common case
 *
 *  Renders a labelled <input> with hint/error in one component. For
 *  complex cases (textarea, select, custom widgets), use <Field> +
 *  <input className={inputClass()} /> directly.
 *  ──────────────────────────────────────────────────────────────────── */
export function FormInput({
  label,
  required,
  hint,
  error,
  type = "text",
  value,
  onChange,
  placeholder,
  disabled,
  ...inputProps
}) {
  return (
    <Field label={label} required={required} hint={hint} error={error}>
      {(id, describedBy) => (
        <input
          id={id}
          type={type}
          value={value ?? ""}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          aria-required={required ? "true" : undefined}
          className={inputClass({ error: Boolean(error) })}
          {...inputProps}
        />
      )}
    </Field>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 *  FormTextarea · convenience wrapper
 *  ──────────────────────────────────────────────────────────────────── */
export function FormTextarea({
  label,
  required,
  hint,
  error,
  value,
  onChange,
  rows = 3,
  placeholder,
  disabled,
  ...textareaProps
}) {
  return (
    <Field label={label} required={required} hint={hint} error={error}>
      {(id, describedBy) => (
        <textarea
          id={id}
          rows={rows}
          value={value ?? ""}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          aria-required={required ? "true" : undefined}
          className={inputClass({ error: Boolean(error) })}
          {...textareaProps}
        />
      )}
    </Field>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 *  FormSelect · convenience wrapper for <select>
 *  ──────────────────────────────────────────────────────────────────── */
export function FormSelect({
  label,
  required,
  hint,
  error,
  value,
  onChange,
  options = [],
  placeholder,
  disabled,
  ...selectProps
}) {
  return (
    <Field label={label} required={required} hint={hint} error={error}>
      {(id, describedBy) => (
        <select
          id={id}
          value={value ?? ""}
          onChange={onChange}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          aria-required={required ? "true" : undefined}
          className={inputClass({ error: Boolean(error) })}
          {...selectProps}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => {
            const value = typeof opt === "object" ? opt.value : opt
            const label = typeof opt === "object" ? opt.label : opt
            return <option key={value} value={value}>{label}</option>
          })}
        </select>
      )}
    </Field>
  )
}

export default Field
