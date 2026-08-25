// ════════════════════════════════════════════════════════════════════════════
// Tooltip · ui primitive · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Lightweight on-hover / on-focus label. Uses a portal so it can never be
// clipped by `overflow:hidden` ancestors. Respects keyboard focus.
// Aria-described on the trigger via a stable id.
//
// Behaviours:
//   · Open on hover/focus, close on leave/blur
//   · 200ms open delay, 80ms close delay (feels intentional, not jumpy)
//   · Auto-flips to the opposite side if it would clip the viewport
//   · Reduced-motion: no scale animation, just fade
//
// Use sparingly. If the info is essential, put it in the visible UI.
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

const SIDE_OFFSET = 8

const SIDE_TRANSFORM = {
  top: { x: "-50%", y: "-100%" },
  bottom: { x: "-50%", y: "0%" },
  left: { x: "-100%", y: "-50%" },
  right: { x: "0%", y: "-50%" },
}

const SIDE_ENTER = {
  top: { y: 4, x: 0 },
  bottom: { y: -4, x: 0 },
  left: { x: 4, y: 0 },
  right: { x: -4, y: 0 },
}

/**
 * Tooltip · accessible label that floats next to its trigger.
 *
 * Props:
 *   children   · single React element to wrap (trigger)
 *   content    · ReactNode — tip body
 *   side?      · "top" (default) · "bottom" · "left" · "right"
 *   align?     · "center" (default) · "start" · "end"
 *   delay?     · ms before open (default 200)
 *   disabled?  · boolean — render trigger only
 *   className? · class added to the floating panel
 */
export default function Tooltip({
  children,
  content,
  side = "top",
  align = "center",
  delay = 200,
  disabled = false,
  className = "",
}) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0, side })
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const openTimer = useRef(null)
  const closeTimer = useRef(null)
  const reactId = useId()
  const tipId = `tip-${reactId}`

  const show = () => {
    clearTimeout(closeTimer.current)
    openTimer.current = setTimeout(() => setOpen(true), delay)
  }
  const hide = () => {
    clearTimeout(openTimer.current)
    closeTimer.current = setTimeout(() => setOpen(false), 80)
  }

  // Position calculation — runs after open and on resize/scroll
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !panelRef.current) return undefined
    const update = () => {
      const tRect = triggerRef.current.getBoundingClientRect()
      const pRect = panelRef.current.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight

      let chosenSide = side
      // Auto-flip vertically if no room
      if (side === "top" && tRect.top - pRect.height - SIDE_OFFSET < 8) chosenSide = "bottom"
      if (side === "bottom" && tRect.bottom + pRect.height + SIDE_OFFSET > vh - 8) chosenSide = "top"
      if (side === "left" && tRect.left - pRect.width - SIDE_OFFSET < 8) chosenSide = "right"
      if (side === "right" && tRect.right + pRect.width + SIDE_OFFSET > vw - 8) chosenSide = "left"

      let top = 0
      let left = 0
      switch (chosenSide) {
        case "top":
          top = tRect.top - SIDE_OFFSET
          left = align === "start" ? tRect.left : align === "end" ? tRect.right : tRect.left + tRect.width / 2
          break
        case "bottom":
          top = tRect.bottom + SIDE_OFFSET
          left = align === "start" ? tRect.left : align === "end" ? tRect.right : tRect.left + tRect.width / 2
          break
        case "left":
          top = align === "start" ? tRect.top : align === "end" ? tRect.bottom : tRect.top + tRect.height / 2
          left = tRect.left - SIDE_OFFSET
          break
        case "right":
        default:
          top = align === "start" ? tRect.top : align === "end" ? tRect.bottom : tRect.top + tRect.height / 2
          left = tRect.right + SIDE_OFFSET
      }
      setCoords({ top, left, side: chosenSide })
    }
    update()
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [open, side, align])

  // Cleanup timers on unmount
  useEffect(() => () => {
    clearTimeout(openTimer.current)
    clearTimeout(closeTimer.current)
  }, [])

  if (!isValidElement(children)) return children

  const trigger = cloneElement(children, {
    ref: (node) => {
      triggerRef.current = node
      const orig = children.ref
      if (typeof orig === "function") orig(node)
      // eslint-disable-next-line react-hooks/immutability -- forwarding the node to the child's own ref object inside a ref callback (not during render)
      else if (orig && typeof orig === "object") orig.current = node
    },
    onMouseEnter: (...args) => {
      children.props.onMouseEnter?.(...args)
      if (!disabled) show()
    },
    onMouseLeave: (...args) => {
      children.props.onMouseLeave?.(...args)
      if (!disabled) hide()
    },
    onFocus: (...args) => {
      children.props.onFocus?.(...args)
      if (!disabled) show()
    },
    onBlur: (...args) => {
      children.props.onBlur?.(...args)
      if (!disabled) hide()
    },
    "aria-describedby": disabled ? undefined : tipId,
  })

  const transform = SIDE_TRANSFORM[coords.side] || SIDE_TRANSFORM.top
  const enter = SIDE_ENTER[coords.side] || SIDE_ENTER.top

  const panel =
    typeof document !== "undefined"
      ? createPortal(
          <AnimatePresence>
            {open && !disabled && content && (
              <m.div
                ref={panelRef}
                id={tipId}
                role="tooltip"
                initial={{ opacity: 0, ...enter }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, ...enter }}
                transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: "fixed",
                  top: coords.top,
                  left: coords.left,
                  transform: `translate(${transform.x}, ${transform.y})`,
                  zIndex: "var(--z-tooltip, 90)",
                }}
                className={[
                  "pointer-events-none max-w-[260px] rounded-md px-2.5 py-1.5",
                  "bg-[var(--color-surface-dark)] text-[var(--color-text-on-dark)]",
                  "text-[12px] leading-[1.4] font-medium tracking-tight",
                  "shadow-[0_8px_24px_rgba(0,0,0,0.18)]",
                  className,
                ].join(" ")}
              >
                {content}
              </m.div>
            )}
          </AnimatePresence>,
          document.body,
        )
      : null

  return (
    <>
      {trigger}
      {panel}
    </>
  )
}

export { Tooltip }
