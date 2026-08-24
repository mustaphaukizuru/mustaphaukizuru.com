/* ──────────────────────────────────────────────────────────────────────────
 *  Bound admin form fields · roadmap step 30
 *
 *  Thin wrappers around components/admin/Field that read/write a single
 *  path on a `useForm` instance:
 *
 *    <TextField form={form} name="title" label="Title" required />
 *    <SelectField form={form} name="status" label="Status" options={[...]} />
 *    <CheckboxField form={form} name="isVisible" label="Visible" />
 *
 *  Errors come from form.errors[name]; the wrapper marks aria-invalid and
 *  links the message via aria-describedby.
 *  ──────────────────────────────────────────────────────────────────── */

import { Field, inputClass } from "../Field"

function useBound(form, name) {
  return {
    value: form.getValue(name),
    error: form.errors?.[name],
    onChange: form.handleChange(name),
  }
}

export function TextField({ form, name, label, required, hint, type = "text", className = "", mono = false, ...rest }) {
  const { value, error, onChange } = useBound(form, name)
  return (
    <Field label={label} required={required} hint={hint} error={error} className={className}>
      {(id, describedBy) => (
        <input
          id={id}
          type={type}
          value={value ?? ""}
          onChange={onChange}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          aria-required={required ? "true" : undefined}
          className={inputClass({ error: Boolean(error), className: mono ? "font-mono" : "" })}
          {...rest}
        />
      )}
    </Field>
  )
}

export function NumberField(props) {
  return <TextField type="number" mono {...props} />
}

export function DateField(props) {
  return <TextField type="date" mono {...props} />
}

export function TextAreaField({ form, name, label, required, hint, rows = 3, className = "", ...rest }) {
  const { value, error, onChange } = useBound(form, name)
  return (
    <Field label={label} required={required} hint={hint} error={error} className={className}>
      {(id, describedBy) => (
        <textarea
          id={id}
          rows={rows}
          value={value ?? ""}
          onChange={onChange}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          aria-required={required ? "true" : undefined}
          className={inputClass({ error: Boolean(error), className: "resize-y" })}
          {...rest}
        />
      )}
    </Field>
  )
}

export function SelectField({ form, name, label, required, hint, options = [], placeholder, className = "", ...rest }) {
  const { value, error, onChange } = useBound(form, name)
  return (
    <Field label={label} required={required} hint={hint} error={error} className={className}>
      {(id, describedBy) => (
        <select
          id={id}
          value={value ?? ""}
          onChange={onChange}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          aria-required={required ? "true" : undefined}
          className={inputClass({ error: Boolean(error) })}
          {...rest}
        >
          {placeholder != null && <option value="">{placeholder}</option>}
          {options.map((opt) => {
            const v = typeof opt === "object" ? opt.value : opt
            const l = typeof opt === "object" ? opt.label : opt
            return <option key={v} value={v}>{l}</option>
          })}
        </select>
      )}
    </Field>
  )
}

export function CheckboxField({ form, name, label, hint, className = "", ...rest }) {
  const { value, error, onChange } = useBound(form, name)
  return (
    <div className={className}>
      <label className="flex items-center gap-2 text-meta text-charcoal">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={onChange}
          className="h-4 w-4 rounded border-charcoal-80/25 text-violet focus:ring-azure/40"
          {...rest}
        />
        <span>{label}</span>
      </label>
      {hint && !error && <p className="mt-1 text-micro text-charcoal-80/55">{hint}</p>}
      {error && <p className="mt-1 text-micro text-rose-600" role="alert">{error}</p>}
    </div>
  )
}
