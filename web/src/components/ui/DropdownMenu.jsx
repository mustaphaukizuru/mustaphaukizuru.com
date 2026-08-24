// ════════════════════════════════════════════════════════════════════════════
// DropdownMenu · ui surface · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Click-anchored selectable menu. WAI-ARIA "menu" pattern:
//   · Arrow keys move highlight, Enter/Space activates, Esc closes
//   · Type-ahead: pressing a letter jumps to the next item starting with it
//   · Outside click closes
//   · Roving tabindex on items so the menu has a single tab-stop
//
// Usage:
//   <DropdownMenu
//     trigger={<Button icon={MoreHorizontal} />}
//     items={[
//       { label: "Edit", icon: Pencil, onSelect: () => ... },
//       { label: "Duplicate", icon: Copy, onSelect: () => ... },
//       { type: "separator" },
//       { label: "Delete", icon: Trash2, danger: true, onSelect: () => ... },
//     ]}
//   />
//
// For richer popovers (forms, custom content) prefer <Popover>.
// ════════════════════════════════════════════════════════════════════════════

import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import { m, AnimatePresence } from "framer-motion"

const OFFSET = 6

/**
 * DropdownMenu · selectable items menu.
 *
 * Props:
 *   trigger        · ReactElement — clickable trigger
 *   items          · array of items (see shape below)
 *   side?, align?  · positioning, default bottom/start
 *   className?     · class on the floating panel
 *   width?         · CSS width
 *
 * Item shape:
 *   { label, onSelect, icon?, shortcut?, disabled?, danger? }
 *   { type: "separator" }
 *   { type: "label", label }    — section heading
 */
export default function DropdownMenu({
  trigger,
  items = [],
  side = "bottom",
  align = "start",
  className = "",
  width,
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const reactId = useId()
  const menuId = `dm-${reactId}`
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const itemRefs = useRef([])
  const typeBuffer = useRef("")
  const typeTimer = useRef(null)

  const selectableIdxs = items
    .map((it, i) => (it.type === "separator" || it.type === "label" || it.disabled ? -1 : i))
    .filter((i) => i !== -1)

  // Positioning
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !panelRef.current) return undefined
    const update = () => {
      const t = triggerRef.current.getBoundingClientRect()
      const p = panelRef.current.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight

      let top = side === "top" ? t.top - p.height - OFFSET : t.bottom + OFFSET
      let left =
        align === "end"
          ? t.right - p.width
          : align === "center"
          ? t.left + t.width / 2 - p.width / 2
          : t.left

      left = Math.max(8, Math.min(left, vw - p.width - 8))
      top = Math.max(8, Math.min(top, vh - p.height - 8))
      setCoords({ top, left })
    }
    update()
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [open, side, align])

  // Open lifecycle: focus first selectable, attach listeners
  useEffect(() => {
    if (!open) return undefined

    setActive(selectableIdxs[0] ?? 0)
    const t = setTimeout(() => {
      const node = itemRefs.current[selectableIdxs[0] ?? 0]
      node?.focus({ preventScroll: true })
    }, 10)

    const onDoc = (e) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onDoc)
    return () => {
      clearTimeout(t)
      document.removeEventListener("mousedown", onDoc)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const moveActive = (delta) => {
    if (!selectableIdxs.length) return
    const cur = selectableIdxs.indexOf(active)
    const nextIdxInList = (cur + delta + selectableIdxs.length) % selectableIdxs.length
    const next = selectableIdxs[nextIdxInList]
    setActive(next)
    itemRefs.current[next]?.focus({ preventScroll: true })
  }

  const onMenuKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      moveActive(1)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      moveActive(-1)
    } else if (e.key === "Home") {
      e.preventDefault()
      const first = selectableIdxs[0]
      setActive(first)
      itemRefs.current[first]?.focus()
    } else if (e.key === "End") {
      e.preventDefault()
      const last = selectableIdxs[selectableIdxs.length - 1]
      setActive(last)
      itemRefs.current[last]?.focus()
    } else if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    } else if (e.key === "Tab") {
      // Close on tab — tab moves focus out of the menu
      setOpen(false)
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      // Type-ahead
      clearTimeout(typeTimer.current)
      typeBuffer.current = (typeBuffer.current + e.key).toLowerCase()
      const match = selectableIdxs.find((i) =>
        items[i].label?.toLowerCase().startsWith(typeBuffer.current),
      )
      if (typeof match === "number") {
        setActive(match)
        itemRefs.current[match]?.focus()
      }
      typeTimer.current = setTimeout(() => {
        typeBuffer.current = ""
      }, 600)
    }
  }

  if (!isValidElement(trigger)) return null

  const wiredTrigger = cloneElement(trigger, {
    ref: (node) => {
      triggerRef.current = node
      const orig = trigger.ref
      if (typeof orig === "function") orig(node)
      else if (orig && typeof orig === "object") orig.current = node
    },
    onClick: (e) => {
      trigger.props.onClick?.(e)
      setOpen((v) => !v)
    },
    "aria-haspopup": "menu",
    "aria-expanded": open,
    "aria-controls": menuId,
  })

  return (
    <>
      {wiredTrigger}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <m.div
                ref={panelRef}
                id={menuId}
                role="menu"
                onKeyDown={onMenuKeyDown}
                initial={{ opacity: 0, y: side === "top" ? 4 : -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: side === "top" ? 4 : -4, scale: 0.98 }}
                transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: "fixed",
                  top: coords.top,
                  left: coords.left,
                  width,
                  zIndex: "var(--z-popover, 80)",
                }}
                className={[
                  "min-w-[180px] rounded-[12px] border border-[var(--color-border-subtle)]",
                  "bg-[var(--color-surface-card)] text-[var(--color-text-primary)]",
                  "shadow-[var(--shadow-overlay)] p-1.5",
                  className,
                ].join(" ")}
              >
                {items.map((it, i) => {
                  if (it.type === "separator") {
                    return (
                      <div
                        key={`sep-${i}`}
                        role="separator"
                        className="my-1 h-px bg-[var(--color-border-subtle)]"
                      />
                    )
                  }
                  if (it.type === "label") {
                    return (
                      <div
                        key={`lbl-${i}`}
                        className="px-2 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]"
                      >
                        {it.label}
                      </div>
                    )
                  }
                  const Icon = it.icon
                  const isDanger = Boolean(it.danger)
                  const isDisabled = Boolean(it.disabled)
                  return (
                    <button
                      key={`it-${i}`}
                      ref={(node) => {
                        itemRefs.current[i] = node
                      }}
                      type="button"
                      role="menuitem"
                      tabIndex={active === i ? 0 : -1}
                      disabled={isDisabled}
                      onClick={() => {
                        if (isDisabled) return
                        it.onSelect?.()
                        setOpen(false)
                      }}
                      onMouseEnter={() => !isDisabled && setActive(i)}
                      className={[
                        "group flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[13px] font-medium",
                        "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
                        "focus:outline-none",
                        isDisabled
                          ? "text-[var(--color-text-muted)] opacity-60 cursor-not-allowed"
                          : isDanger
                          ? "text-[var(--color-feedback-danger-text)] hover:bg-[var(--color-feedback-danger-bg)] focus:bg-[var(--color-feedback-danger-bg)]"
                          : "text-[var(--color-text-primary)] hover:bg-[var(--color-violet-pale)] focus:bg-[var(--color-violet-pale)] hover:text-[var(--color-violet)] focus:text-[var(--color-violet)]",
                      ].join(" ")}
                    >
                      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
                      <span className="flex-1 truncate">{it.label}</span>
                      {it.shortcut && (
                        <span className="ml-3 font-mono text-[11px] tracking-wider text-[var(--color-text-muted)]">
                          {it.shortcut}
                        </span>
                      )}
                    </button>
                  )
                })}
              </m.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  )
}

export { DropdownMenu }
