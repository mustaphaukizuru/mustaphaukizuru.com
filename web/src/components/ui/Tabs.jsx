/* eslint-disable react-refresh/only-export-components -- component file also exports shared helpers/constants (imported by pages) */
// ════════════════════════════════════════════════════════════════════════════
// Tabs · ui composite · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Headless-style tabs with brand-styled visuals. WAI-ARIA "tabs" pattern:
//   · Arrow keys move active tab, Home/End jump
//   · Tab moves focus to the active panel
//   · `manual` mode delays activation until Enter/Space; default is `automatic`
//
// Variants:
//   · "underline" (default) — minimal, marketing & dashboard
//   · "pill"                — soft chips, settings panels
//   · "segmented"           — joined toggle group, filters
//
// Composition:
//   <Tabs value={tab} onValueChange={setTab} variant="underline">
//     <Tabs.List ariaLabel="Sections">
//       <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
//       <Tabs.Trigger value="files" badge={fileCount}>Files</Tabs.Trigger>
//     </Tabs.List>
//     <Tabs.Panel value="overview">…</Tabs.Panel>
//     <Tabs.Panel value="files">…</Tabs.Panel>
//   </Tabs>
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

const TabsContext = createContext(null)

/**
 * Tabs · root container, owns selected value.
 *
 * Props:
 *   value, onValueChange      · controlled value
 *   defaultValue              · uncontrolled
 *   variant?                  · "underline" (default) · "pill" · "segmented"
 *   activation?               · "automatic" (default) · "manual"
 *   className?                · outer wrapper
 */
function Tabs({
  value,
  defaultValue,
  onValueChange,
  variant = "underline",
  activation = "automatic",
  className = "",
  children,
}) {
  const isControlled = value !== undefined
  const [internal, setInternal] = useState(defaultValue)
  const current = isControlled ? value : internal

  const setValue = (v) => {
    if (!isControlled) setInternal(v)
    onValueChange?.(v)
  }

  const reactId = useId()

  return (
    <TabsContext.Provider
      value={{ value: current, setValue, variant, activation, baseId: reactId }}
    >
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

// ── Tabs.List ──────────────────────────────────────────────────────────────
function TabsList({ children, ariaLabel, className = "" }) {
  const { variant } = useContext(TabsContext)
  const listRef = useRef(null)

  const handleKeyDown = (e) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return
    const triggers = Array.from(
      listRef.current?.querySelectorAll('[role="tab"]:not([disabled])') || [],
    )
    if (!triggers.length) return
    const current = triggers.indexOf(document.activeElement)
    let next = current
    if (e.key === "ArrowRight") next = (current + 1) % triggers.length
    if (e.key === "ArrowLeft") next = (current - 1 + triggers.length) % triggers.length
    if (e.key === "Home") next = 0
    if (e.key === "End") next = triggers.length - 1
    if (next !== current && triggers[next]) {
      e.preventDefault()
      triggers[next].focus()
    }
  }

  const variantClass =
    variant === "pill"
      ? "inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface-elevated)] p-1"
      : variant === "segmented"
      ? "inline-flex items-center rounded-[10px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-1"
      : "flex items-center gap-1 border-b border-[var(--color-border-subtle)]"

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={[variantClass, className].filter(Boolean).join(" ")}
    >
      {children}
    </div>
  )
}

// ── Tabs.Trigger ───────────────────────────────────────────────────────────
function TabsTrigger({
  value: triggerValue,
  children,
  disabled = false,
  badge,
  icon: Icon,
  className = "",
}) {
  const { value, setValue, variant, activation, baseId } = useContext(TabsContext)
  const isActive = value === triggerValue
  const tabId = `${baseId}-tab-${triggerValue}`
  const panelId = `${baseId}-panel-${triggerValue}`

  const onActivate = () => {
    if (disabled) return
    setValue(triggerValue)
  }

  const onKey = (e) => {
    if (activation === "manual" && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault()
      onActivate()
    }
  }

  const baseInteractive =
    "inline-flex items-center gap-2 font-semibold whitespace-nowrap " +
    "transition-[color,background-color,border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-standard)] " +
    "focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgb(var(--color-violet-rgb)/0.18)] " +
    "disabled:opacity-50 disabled:cursor-not-allowed"

  let visual
  if (variant === "pill") {
    visual = isActive
      ? "bg-[var(--color-surface-card)] text-[var(--color-violet)] shadow-[0_2px_8px_rgb(var(--color-violet-rgb)/0.10)] rounded-full px-3.5 py-1.5 text-[13px]"
      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-full px-3.5 py-1.5 text-[13px]"
  } else if (variant === "segmented") {
    visual = isActive
      ? "bg-[var(--color-violet-pale)] text-[var(--color-violet)] rounded-[8px] px-3.5 py-1.5 text-[13px]"
      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-[8px] px-3.5 py-1.5 text-[13px]"
  } else {
    // underline
    visual = isActive
      ? "text-[var(--color-violet)] border-b-2 border-[var(--color-action-primary)] -mb-px px-1 py-3 text-[14px]"
      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border-b-2 border-transparent -mb-px px-1 py-3 text-[14px]"
  }

  return (
    <button
      type="button"
      role="tab"
      id={tabId}
      aria-selected={isActive}
      aria-controls={panelId}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      onClick={() => activation === "automatic" && onActivate()}
      onFocus={() => activation === "automatic" && onActivate()}
      onKeyDown={onKey}
      className={[baseInteractive, visual, className].filter(Boolean).join(" ")}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
      {children}
      {badge !== undefined && badge !== null && (
        <span
          className={[
            "ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10.5px] font-bold tabular-nums",
            isActive
              ? "bg-[var(--color-action-primary)] text-[var(--color-text-on-violet)]"
              : "bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)]",
          ].join(" ")}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

// ── Tabs.Panel ─────────────────────────────────────────────────────────────
function TabsPanel({ value: panelValue, children, className = "", forceMount = false }) {
  const { value, baseId } = useContext(TabsContext)
  const isActive = value === panelValue
  const tabId = `${baseId}-tab-${panelValue}`
  const panelId = `${baseId}-panel-${panelValue}`

  if (!isActive && !forceMount) return null

  return (
    <div
      role="tabpanel"
      id={panelId}
      aria-labelledby={tabId}
      hidden={!isActive}
      tabIndex={0}
      className={[
        "focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgb(var(--color-violet-rgb)/0.18)] rounded-[8px]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  )
}

Tabs.List = TabsList
Tabs.Trigger = TabsTrigger
Tabs.Panel = TabsPanel

export default Tabs
export { Tabs, TabsList, TabsTrigger, TabsPanel }

// Convenience: detect children for auto-rendering scenarios
export function useTabsContext() {
  return useContext(TabsContext)
}

// Optional helper to validate composition during development
export function validateTabsChildren(children) {
  if (typeof children === "undefined") return true
  let ok = true
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) ok = false
  })
  return ok
}
