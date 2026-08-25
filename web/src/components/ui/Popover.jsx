// ════════════════════════════════════════════════════════════════════════════
// Popover · ui surface · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Floating panel anchored to a trigger. Uses click-to-open semantics
// (vs. Tooltip's hover/focus). Manages outside-click + Escape dismissal,
// portal rendering, and viewport-aware positioning.
//
// Use for: rich filter panels, sharing controls, mini editors, popovers
// over an icon button. For menus with selectable items, prefer
// <DropdownMenu>. For blocking decisions, use <Modal>.
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

const OFFSET = 8

/**
 * Popover · click-anchored floating panel.
 *
 * Props:
 *   trigger     · ReactElement — the clickable trigger (will be cloned)
 *   children    · ReactNode — the panel body
 *   open?, onOpenChange? · controlled mode (omit both for uncontrolled)
 *   side?       · "bottom" (default) · "top" · "left" · "right"
 *   align?      · "start" · "center" · "end" (default "start")
 *   className?  · class on the floating panel
 *   panelClass? · alias of className for clarity
 *   width?      · CSS width (e.g. "320px") — defaults to natural
 */
export default function Popover({
  trigger,
  children,
  open: openProp,
  onOpenChange,
  side = "bottom",
  align = "start",
  className = "",
  panelClass = "",
  width,
}) {
  const isControlled = typeof openProp === "boolean"
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isControlled ? openProp : internalOpen
  const setOpen = (v) => {
    if (!isControlled) setInternalOpen(v)
    onOpenChange?.(v)
  }

  const reactId = useId()
  const panelId = `pop-${reactId}`
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const [coords, setCoords] = useState({ top: 0, left: 0 })

  // Position calc
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !panelRef.current) return undefined
    const update = () => {
      const t = triggerRef.current.getBoundingClientRect()
      const p = panelRef.current.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight

      let top = 0
      let left = 0

      // Vertical placement
      if (side === "top") {
        top = t.top - p.height - OFFSET
      } else if (side === "bottom") {
        top = t.bottom + OFFSET
      } else if (side === "left") {
        top = align === "end" ? t.bottom - p.height : align === "center" ? t.top + t.height / 2 - p.height / 2 : t.top
      } else {
        top = align === "end" ? t.bottom - p.height : align === "center" ? t.top + t.height / 2 - p.height / 2 : t.top
      }

      // Horizontal placement
      if (side === "left") {
        left = t.left - p.width - OFFSET
      } else if (side === "right") {
        left = t.right + OFFSET
      } else {
        left =
          align === "end"
            ? t.right - p.width
            : align === "center"
            ? t.left + t.width / 2 - p.width / 2
            : t.left
      }

      // Clamp inside viewport with 8px gutter
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

  // Outside click + Escape
  useEffect(() => {
    if (!open) return undefined
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
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Wire trigger
  if (!isValidElement(trigger)) {
    if (typeof console !== "undefined") {
       
      console.warn("<Popover> requires a single React element as `trigger`.")
    }
    return null
  }
  const wiredTrigger = cloneElement(trigger, {
    ref: (node) => {
      triggerRef.current = node
      const orig = trigger.ref
      if (typeof orig === "function") orig(node)
      else if (orig && typeof orig === "object") orig.current = node
    },
    onClick: (e) => {
      trigger.props.onClick?.(e)
      setOpen(!open)
    },
    "aria-expanded": open,
    "aria-controls": panelId,
    "aria-haspopup": "dialog",
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
                id={panelId}
                role="dialog"
                initial={{ opacity: 0, y: side === "top" ? 4 : -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: side === "top" ? 4 : -4, scale: 0.98 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: "fixed",
                  top: coords.top,
                  left: coords.left,
                  width,
                  zIndex: "var(--z-popover, 80)",
                }}
                className={[
                  "rounded-[14px] border border-[var(--color-border-subtle)]",
                  "bg-[var(--color-surface-card)] text-[var(--color-text-primary)]",
                  "shadow-[var(--shadow-overlay)] p-3",
                  className,
                  panelClass,
                ].join(" ")}
              >
                {children}
              </m.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  )
}

export { Popover }
