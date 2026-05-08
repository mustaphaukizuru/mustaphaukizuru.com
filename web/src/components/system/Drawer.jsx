// ════════════════════════════════════════════════════════════════════════════
// Drawer · system surface · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Slide-in panel for secondary workflows: filters, edit-in-place, contextual
// detail, mobile navigation. Not a substitute for Modal — Modal is for
// blocking decisions, Drawer is for parallel work.
//
// Sides:   right (default) · left · bottom
// Sizes:   sm 360 · md 440 (default) · lg 560 · xl 720
//
// Behaviours:
//   · Focus, ESC, and body-scroll-lock identical to Modal.
//   · Backdrop click dismisses (override with `dismissOnBackdrop={false}`).
//   · Spring slide-in matches the design-system ease-spring curve.
//   · `bottom` side becomes a mobile sheet — full-width, rounded top corners.
//   · Renders into <body> via portal.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useId } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"

import { useTranslation } from "react-i18next"
const FOCUSABLE_SEL =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

const SIDE_CLASS = {
  right: "right-0 top-0 h-full",
  left: "left-0 top-0 h-full",
  bottom: "left-0 right-0 bottom-0 w-full max-h-[90vh] rounded-t-[18px]",
}

const SIZE_BY_SIDE = {
  right: { sm: "w-[360px]", md: "w-[440px]", lg: "w-[560px]", xl: "w-[720px]" },
  left: { sm: "w-[360px]", md: "w-[440px]", lg: "w-[560px]", xl: "w-[720px]" },
  bottom:{ sm: "h-[40vh]", md: "h-[55vh]", lg: "h-[70vh]", xl: "h-[85vh]" },
}

const motionVariants = {
  right: { initial: { x: "100%" }, animate: { x: 0 }, exit: { x: "100%" } },
  left: { initial: { x: "-100%" }, animate: { x: 0 }, exit: { x: "-100%" } },
  bottom: { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } },
}

function Drawer({
  open,
  onClose,
  side = "right",
  size = "md",
  title,
  description,
  children,
  dismissOnEsc = true,
  dismissOnBackdrop = true,
  className = "",
}) {
  const { t } = useTranslation("common")
  const panelRef = useRef(null)
  const previouslyFocused = useRef(null)
  const reactId = useId()
  const titleId = `${reactId}-title`
  const descId = `${reactId}-desc`

  useEffect(() => {
    if (!open) return
    previouslyFocused.current = document.activeElement
    const t = setTimeout(() => {
      const target = panelRef.current?.querySelector(FOCUSABLE_SEL) || panelRef.current
      target?.focus({ preventScroll: true })
    }, 0)
    return () => {
      clearTimeout(t)
      if (previouslyFocused.current?.focus) {
        previouslyFocused.current.focus({ preventScroll: true })
      }
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = original
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKey = (e) => {
      if (e.key === "Escape" && dismissOnEsc) {
        e.stopPropagation()
        onClose?.()
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll(FOCUSABLE_SEL)
        if (!focusables.length) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open, onClose, dismissOnEsc])

  if (typeof document === "undefined") return null

  const sizeClass = (SIZE_BY_SIDE[side] || SIZE_BY_SIDE.right)[size] || SIZE_BY_SIDE.right.md

  const node = (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[var(--z-modal)]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={dismissOnBackdrop ? onClose : undefined}
            className="absolute inset-0 bg-[rgba(26,27,35,0.55)]"
            aria-hidden="true"
          />
          <motion.aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            initial={motionVariants[side].initial}
            animate={motionVariants[side].animate}
            exit={motionVariants[side].exit}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className={[
              "absolute bg-[var(--color-surface-card)] text-[var(--color-text-primary)]",
              "shadow-[var(--shadow-overlay)] border border-[var(--color-border-subtle)]",
              "flex flex-col",
              SIDE_CLASS[side] || SIDE_CLASS.right,
              sizeClass,
              "max-w-full",
              className,
            ].join(" ")}
          >
            {/* Header */}
            <div className="flex items-start gap-4 px-6 py-5 pr-14 border-b border-[var(--color-border-subtle)]">
              <div className="min-w-0 flex-1">
                {title && (
                  <h2 id={titleId} className="text-[18px] font-bold leading-[1.3] text-[var(--color-violet)]">
                    {title}
                  </h2>
                )}
                {description && (
                  <p id={descId} className="mt-1 text-[13px] leading-[1.55] text-[var(--color-text-secondary)]">
                    {description}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label={t("system.closePanel")}
              className="absolute right-4 top-4 rounded-md p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] transition-colors duration-[var(--motion-fast)]"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="flex-1 overflow-y-auto p-6">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )

  return createPortal(node, document.body)
}

// ── Drawer.Footer ──────────────────────────────────────────────────────────
function DrawerFooter({ children, align = "end", className = "" }) {
  const alignClass =
    align === "between"
      ? "justify-between"
      : align === "start"
      ? "justify-start"
      : "justify-end"
  return (
    <div
      className={[
        "flex flex-wrap items-center gap-3 px-6 py-4 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]",
        alignClass,
        className,
      ].join(" ")}
    >
      {children}
    </div>
  )
}

Drawer.Footer = DrawerFooter

export default Drawer
export { Drawer, DrawerFooter }
