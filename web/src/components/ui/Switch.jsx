// ════════════════════════════════════════════════════════════════════════════
// Switch · ui primitive · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Toggle switch (on/off). Use for instant-effect settings: notifications,
// dark mode, sidebar collapse, "Show archived". For persisted form values
// that submit later, prefer <Checkbox>.
//
// Sizes: sm (28×16) · md (36×20 default) · lg (44×24)
// States: default · hover · focus-visible · checked · disabled
//
// Token references:
//   --color-action-primary, --color-border-strong, --color-surface-elevated
// ════════════════════════════════════════════════════════════════════════════

import { forwardRef, useId, useState } from "react"

const SIZE = {
  sm: { track: "h-4 w-7", thumb: "h-3 w-3", slide: "translate-x-3", text: "text-[13px]" },
  md: { track: "h-5 w-9", thumb: "h-4 w-4", slide: "translate-x-4", text: "text-[14px]" },
  lg: { track: "h-6 w-11", thumb: "h-5 w-5", slide: "translate-x-5", text: "text-[15px]" },
}

/**
 * Switch · binary on/off toggle with label.
 *
 * Props:
 *   label?         · ReactNode — sits to the right of the switch
 *   description?   · string — secondary copy below the label
 *   checked?       · boolean (controlled)
 *   defaultChecked?· boolean
 *   onChange?      · (checked, event) => void
 *   size?          · "sm" · "md" (default) · "lg"
 *   disabled?      · boolean
 *   labelPosition? · "right" (default) · "left"
 *   className?     · escape hatch on the outer label
 */
const Switch = forwardRef(function Switch(
  {
    label,
    description,
    checked,
    defaultChecked,
    onChange,
    size = "md",
    disabled = false,
    labelPosition = "right",
    id: idProp,
    className = "",
    ...rest
  },
  ref,
) {
  const reactId = useId()
  const id = idProp || `sw-${reactId}`
  const helpId = `${id}-help`
  const cfg = SIZE[size] || SIZE.md
  const isControlled = typeof checked === "boolean"
  const [internal, setInternal] = useState(Boolean(defaultChecked))
  const isOn = isControlled ? checked : internal

  const handleChange = (e) => {
    if (!isControlled) setInternal(e.target.checked)
    onChange?.(e.target.checked, e)
  }

  const Track = (
    <span
      aria-hidden="true"
      className={[
        "relative inline-flex shrink-0 items-center rounded-full",
        "transition-[background-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
        cfg.track,
        isOn
          ? "bg-[var(--color-action-primary)]"
          : "bg-[var(--color-border-strong)]",
        "peer-focus-visible:shadow-[0_0_0_3px_rgb(var(--color-violet-rgb)/0.18)]",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        className={[
          "absolute left-0.5 inline-block rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.18)]",
          "transition-transform duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
          cfg.thumb,
          isOn ? cfg.slide : "translate-x-0",
        ].join(" ")}
      />
    </span>
  )

  const Body = (
    <>
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
    </>
  )

  return (
    <label
      htmlFor={id}
      className={[
        "group inline-flex items-center gap-3 select-none",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        labelPosition === "left" ? "flex-row-reverse justify-between" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <input
        ref={ref}
        id={id}
        type="checkbox"
        role="switch"
        checked={isControlled ? checked : undefined}
        defaultChecked={isControlled ? undefined : defaultChecked}
        onChange={handleChange}
        disabled={disabled}
        aria-checked={isOn}
        aria-describedby={description ? helpId : undefined}
        className="peer sr-only"
        {...rest}
      />
      {Track}
      {Body}
    </label>
  )
})

export default Switch
export { Switch }
