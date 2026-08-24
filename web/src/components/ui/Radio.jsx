// ════════════════════════════════════════════════════════════════════════════
// Radio · ui primitive · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Single radio button + RadioGroup container with full keyboard
// navigation (Arrow keys move selection, Space/Enter selects, Tab moves out
// of the group as a single tab-stop per WAI-ARIA pattern).
//
// Sizes:    sm (16px) · md (20px default) · lg (24px)
// States:   default · hover · focus-visible · selected · error · disabled
//
// Token references:
//   --color-action-primary, --color-border-default, --color-feedback-danger
// ════════════════════════════════════════════════════════════════════════════

import {
  forwardRef,
  useId,
  createContext,
  useContext,
  useRef,
  Children,
  cloneElement,
  isValidElement,
} from "react"

const SIZE = {
  sm: { box: "h-4 w-4", dot: "h-1.5 w-1.5", text: "text-[13px]" },
  md: { box: "h-5 w-5", dot: "h-2 w-2", text: "text-[14px]" },
  lg: { box: "h-6 w-6", dot: "h-2.5 w-2.5", text: "text-[15px]" },
}

const RadioContext = createContext(null)

/**
 * Radio · single radio (must be inside <Radio.Group>).
 *
 * Props:
 *   value           · string (required) — what the option represents
 *   label?          · ReactNode
 *   description?    · string
 *   disabled?       · boolean
 *   className?      · escape hatch on the outer label
 */
const Radio = forwardRef(function Radio(
  {
    value,
    label,
    description,
    disabled = false,
    id: idProp,
    className = "",
    ...rest
  },
  ref,
) {
  const ctx = useContext(RadioContext)
  if (!ctx) {
    if (typeof console !== "undefined") {
       
      console.warn("<Radio> must be rendered inside <Radio.Group>.")
    }
  }
  const reactId = useId()
  const id = idProp || `rad-${reactId}`
  const helpId = `${id}-help`
  const cfg = SIZE[ctx?.size || "md"] || SIZE.md
  const isChecked = ctx?.value === value
  const isDisabled = disabled || ctx?.disabled
  const hasError = Boolean(ctx?.error)

  return (
    <label
      htmlFor={id}
      className={[
        "group inline-flex items-start gap-3 select-none",
        isDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <input
        ref={ref}
        id={id}
        type="radio"
        name={ctx?.name}
        value={value}
        checked={isChecked}
        disabled={isDisabled}
        required={ctx?.required}
        aria-invalid={hasError || undefined}
        aria-describedby={description ? helpId : undefined}
        onChange={(e) => ctx?.onChange?.(value, e)}
        className="peer sr-only"
        {...rest}
      />

      <span
        aria-hidden="true"
        className={[
          "relative flex shrink-0 items-center justify-center mt-[2px]",
          cfg.box,
          "rounded-full border bg-[var(--color-surface-card)]",
          "transition-[background-color,border-color,box-shadow]",
          "duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
          hasError
            ? "border-[var(--color-feedback-danger)]"
            : "border-[var(--color-border-default)] group-hover:border-[var(--color-border-strong)]",
          isChecked &&
            "border-[var(--color-action-primary)]",
          "peer-focus-visible:shadow-[0_0_0_3px_rgba(93,63,211,0.18)]",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {isChecked && (
          <span
            className={[
              cfg.dot,
              "rounded-full bg-[var(--color-action-primary)]",
              "transition-transform duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
            ].join(" ")}
          />
        )}
      </span>

      {(label || description) && (
        <span className="min-w-0">
          {label && (
            <span
              className={[
                "block leading-[1.4] font-medium text-[var(--color-text-primary)]",
                cfg.text,
              ].join(" ")}
            >
              {label}
            </span>
          )}
          {description && (
            <span
              id={helpId}
              className="mt-0.5 block text-[12px] leading-[1.5] text-[var(--color-text-muted)]"
            >
              {description}
            </span>
          )}
        </span>
      )}
    </label>
  )
})

/**
 * RadioGroup · container that owns the value + provides context to children.
 *
 * Props:
 *   label?, description?, error?    · header copy
 *   name?                           · DOM name (one per group)
 *   value, onChange                 · controlled selection (string)
 *   size?                           · "sm" · "md" (default) · "lg"
 *   orientation?                    · "vertical" (default) · "horizontal"
 *   required?, disabled?
 *   options?                        · convenience: [{ value, label, description, disabled }]
 *                                     when provided, children are ignored
 */
function RadioGroup({
  label,
  description,
  error,
  name,
  value,
  onChange,
  size = "md",
  orientation = "vertical",
  required = false,
  disabled = false,
  options,
  children,
  className = "",
}) {
  const reactId = useId()
  const groupName = name || `radiogroup-${reactId}`
  const groupRef = useRef(null)

  // Roving keyboard nav inside the group
  const handleKeyDown = (e) => {
    if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(e.key)) return
    const radios = Array.from(
      groupRef.current?.querySelectorAll('input[type="radio"]:not(:disabled)') || [],
    )
    if (!radios.length) return
    const currentIdx = radios.findIndex((r) => r.value === value)
    const next =
      e.key === "ArrowDown" || e.key === "ArrowRight"
        ? radios[(currentIdx + 1) % radios.length]
        : radios[(currentIdx - 1 + radios.length) % radios.length]
    if (next) {
      e.preventDefault()
      next.focus()
      onChange?.(next.value, e)
    }
  }

  const ctxValue = {
    name: groupName,
    value,
    onChange,
    size,
    disabled,
    required,
    error,
  }

  return (
    <RadioContext.Provider value={ctxValue}>
      <fieldset className={`flex flex-col gap-3 ${className}`}>
        {label && (
          <legend className="text-[12px] font-semibold text-[var(--color-text-secondary)]">
            {label}
            {required && (
              <span
                className="ml-0.5 text-[var(--color-feedback-danger)]"
                aria-hidden="true"
              >
                *
              </span>
            )}
          </legend>
        )}
        {description && (
          <p className="-mt-1 text-[12px] leading-[1.5] text-[var(--color-text-muted)]">
            {description}
          </p>
        )}
        <div
          ref={groupRef}
          role="radiogroup"
          aria-invalid={Boolean(error) || undefined}
          onKeyDown={handleKeyDown}
          className={[
            "flex gap-3",
            orientation === "horizontal" ? "flex-row flex-wrap gap-x-6" : "flex-col",
          ].join(" ")}
        >
          {options
            ? options.map((opt) => (
                <Radio
                  key={opt.value}
                  value={opt.value}
                  label={opt.label}
                  description={opt.description}
                  disabled={opt.disabled}
                />
              ))
            : Children.map(children, (child) =>
                isValidElement(child) ? cloneElement(child) : child,
              )}
        </div>
        {error && (
          <p className="text-[12px] leading-[1.5] text-[var(--color-feedback-danger-text)]">
            {error}
          </p>
        )}
      </fieldset>
    </RadioContext.Provider>
  )
}

Radio.Group = RadioGroup

export default Radio
export { Radio, RadioGroup }
