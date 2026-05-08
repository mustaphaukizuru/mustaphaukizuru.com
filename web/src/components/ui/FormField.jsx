// ════════════════════════════════════════════════════════════════════════════
// FormField · ui composite · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Wrapper for arbitrary controls that need a label / hint / error stack
// matching the rest of the form system. Use this when you need to render a
// non-standard control (custom file dropper, tag input, color picker)
// alongside <Input>/<Textarea>/<Select> and want everything to align.
//
// Composition:
//   <FormField label="Cover image" hint="JPG/PNG up to 5MB" error={err}>
//     <CustomDropper />
//   </FormField>
// ════════════════════════════════════════════════════════════════════════════

import { useId, cloneElement, isValidElement, Children } from "react"

/**
 * FormField · label + hint + error stack around an arbitrary control.
 *
 * Props:
 *   label?, hint?, error?, required?
 *   id?       · forwarded to children via cloneElement (when child accepts it)
 *   className?· outer wrapper
 *   children  · the actual control
 */
export default function FormField({
  label,
  hint,
  error,
  required,
  id: idProp,
  className = "",
  children,
}) {
  const reactId = useId()
  const id = idProp || `ff-${reactId}`
  const helpId = `${id}-help`
  const hasError = Boolean(error)

  // Auto-wire id + aria onto the first valid child if it doesn't already have them.
  const enhancedChildren = Children.map(children, (child, idx) => {
    if (!isValidElement(child)) return child
    if (idx !== 0) return child
    const next = {}
    if (!child.props.id) next.id = id
    if (!child.props["aria-describedby"] && (hint || error)) {
      next["aria-describedby"] = helpId
    }
    if (hasError && child.props["aria-invalid"] === undefined) {
      next["aria-invalid"] = true
    }
    return cloneElement(child, next)
  })

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
      {enhancedChildren}
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
}

export { FormField }
