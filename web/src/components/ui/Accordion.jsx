// ════════════════════════════════════════════════════════════════════════════
// Accordion · ui composite · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Disclosure list with one or many panels open at a time.
//
// Modes:
//   · "single"   — only one item open at a time (default)
//   · "multiple" — any number of items can be open
//
// Accessibility:
//   · Each header is a real <button> with aria-expanded + aria-controls
//   · Panel uses role="region" + aria-labelledby
//   · Keyboard: Enter/Space toggles; Arrow keys move between headers; Home/End
// ════════════════════════════════════════════════════════════════════════════

import {
  createContext,
  useContext,
  useId,
  useRef,
  useState,
  Children,
  isValidElement,
} from "react"
import { m, AnimatePresence } from "framer-motion"
import { ChevronDown } from "lucide-react"

const AccordionContext = createContext(null)

/**
 * Accordion · root container.
 *
 * Props:
 *   type?           · "single" (default) · "multiple"
 *   value?          · controlled — string for "single", string[] for "multiple"
 *   defaultValue?   · uncontrolled
 *   onValueChange?  · callback
 *   collapsible?    · single mode — allow closing the active item (default true)
 *   variant?        · "bordered" (default) · "ghost" · "card"
 *   className?
 */
function Accordion({
  type = "single",
  value,
  defaultValue,
  onValueChange,
  collapsible = true,
  variant = "bordered",
  className = "",
  children,
}) {
  const isControlled = value !== undefined
  const [internal, setInternal] = useState(
    defaultValue ?? (type === "multiple" ? [] : ""),
  )
  const current = isControlled ? value : internal

  const setVal = (v) => {
    if (!isControlled) setInternal(v)
    onValueChange?.(v)
  }

  const toggle = (itemValue) => {
    if (type === "multiple") {
      const set = new Set(current || [])
      if (set.has(itemValue)) set.delete(itemValue)
      else set.add(itemValue)
      setVal(Array.from(set))
    } else {
      if (current === itemValue) {
        setVal(collapsible ? "" : itemValue)
      } else {
        setVal(itemValue)
      }
    }
  }

  const isOpen = (itemValue) =>
    type === "multiple"
      ? Array.isArray(current) && current.includes(itemValue)
      : current === itemValue

  const reactId = useId()
  const wrapperRef = useRef(null)

  const handleKeyDown = (e) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return
    const headers = Array.from(
      wrapperRef.current?.querySelectorAll('[data-accordion-trigger]') || [],
    )
    if (!headers.length) return
    const cur = headers.indexOf(document.activeElement)
    let next = cur
    if (e.key === "ArrowDown") next = (cur + 1) % headers.length
    if (e.key === "ArrowUp") next = (cur - 1 + headers.length) % headers.length
    if (e.key === "Home") next = 0
    if (e.key === "End") next = headers.length - 1
    if (next !== cur) {
      e.preventDefault()
      headers[next]?.focus()
    }
  }

  const wrapperClass =
    variant === "card"
      ? "rounded-[14px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] divide-y divide-[var(--color-border-subtle)] shadow-[var(--shadow-rest)] overflow-hidden"
      : variant === "ghost"
      ? "divide-y divide-[var(--color-border-subtle)]"
      : "rounded-[10px] border border-[var(--color-border-subtle)] divide-y divide-[var(--color-border-subtle)] overflow-hidden"

  return (
    <AccordionContext.Provider value={{ isOpen, toggle, baseId: reactId, variant }}>
      <div
        ref={wrapperRef}
        onKeyDown={handleKeyDown}
        className={[wrapperClass, className].filter(Boolean).join(" ")}
      >
        {children}
      </div>
    </AccordionContext.Provider>
  )
}

// ── Accordion.Item ─────────────────────────────────────────────────────────
function AccordionItem({ value, children, className = "", disabled = false }) {
  const ctx = useContext(AccordionContext)
  const open = ctx?.isOpen(value)

  return (
    <div
      data-accordion-item
      data-state={open ? "open" : "closed"}
      data-disabled={disabled || undefined}
      className={[
        "bg-[var(--color-surface-card)]",
        disabled && "opacity-60 pointer-events-none",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {Children.map(children, (child) => {
        if (!isValidElement(child)) return child
        return (
          <ItemContextProvider value={value}>
            {child}
          </ItemContextProvider>
        )
      })}
    </div>
  )
}

// Internal nested context to thread `value` to Trigger/Content
const ItemContext = createContext(null)
function ItemContextProvider({ value, children }) {
  return <ItemContext.Provider value={value}>{children}</ItemContext.Provider>
}

// ── Accordion.Trigger ──────────────────────────────────────────────────────
function AccordionTrigger({ children, icon: ExtraIcon, className = "" }) {
  const ctx = useContext(AccordionContext)
  const value = useContext(ItemContext)
  const open = ctx?.isOpen(value)
  const triggerId = `${ctx?.baseId}-trigger-${value}`
  const panelId = `${ctx?.baseId}-panel-${value}`

  return (
    <h3 className="m-0">
      <button
        type="button"
        id={triggerId}
        data-accordion-trigger
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => ctx?.toggle(value)}
        className={[
          "cursor-pointer group flex w-full items-center justify-between gap-4 px-4 py-4 text-left",
          "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
          "hover:bg-[var(--color-violet-ghost)] focus:outline-none",
          "focus-visible:ring-[3px] focus-visible:ring-[rgb(var(--color-violet-rgb)/0.18)]",
          className,
        ].join(" ")}
      >
        <span className="flex min-w-0 items-center gap-3">
          {ExtraIcon && (
            <ExtraIcon
              className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]"
              aria-hidden="true"
            />
          )}
          <span className="text-[14.5px] font-semibold text-[var(--color-text-primary)]">
            {children}
          </span>
        </span>
        <ChevronDown
          className={[
            "h-4 w-4 shrink-0 text-[var(--color-text-muted)]",
            "transition-transform duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
            open ? "rotate-180" : "rotate-0",
          ].join(" ")}
          aria-hidden="true"
        />
      </button>
    </h3>
  )
}

// ── Accordion.Content ──────────────────────────────────────────────────────
function AccordionContent({ children, className = "" }) {
  const ctx = useContext(AccordionContext)
  const value = useContext(ItemContext)
  const open = ctx?.isOpen(value)
  const triggerId = `${ctx?.baseId}-trigger-${value}`
  const panelId = `${ctx?.baseId}-panel-${value}`

  return (
    <AnimatePresence initial={false}>
      {open && (
        <m.section
          key="content"
          id={panelId}
          role="region"
          aria-labelledby={triggerId}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden"
        >
          <div
            className={[
              "px-4 pb-4 pt-0 text-[14px] leading-[1.65] text-[var(--color-text-secondary)]",
              className,
            ].join(" ")}
          >
            {children}
          </div>
        </m.section>
      )}
    </AnimatePresence>
  )
}

Accordion.Item = AccordionItem
Accordion.Trigger = AccordionTrigger
Accordion.Content = AccordionContent

export default Accordion
export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
