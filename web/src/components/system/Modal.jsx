// ════════════════════════════════════════════════════════════════════════════
// Modal · system surface · v1.0
// ────────────────────────────────────────────────────────────────────────────
// Accessible dialog. Use sparingly — only for blocking, focused workflows
// (delete confirm, payment confirm, brief data entry).
//
// Behaviours:
//   · Focus moves to the dialog on open; previously-focused element is
//     restored on close.
//   · Tab + Shift+Tab are trapped inside the dialog.
//   · Escape closes the dialog (unless `dismissOnEsc={false}`).
//   · Backdrop click closes the dialog (unless `dismissOnBackdrop={false}`).
//   · Body scroll is locked while the dialog is open.
//   · Framer Motion springs the dialog in/out (respects reduced-motion).
//   · Renders into <body> via a portal — escapes any overflow:hidden ancestors.
//
// Sizes (max-width):
//   sm 480 · md 600 (default) · lg 760 · xl 920
//
// Composition:
//   <Modal open onClose={...} title="Cancel booking" description="…">
//     <p>Body…</p>
//     <Modal.Footer>
//       <Button variant="ghost" onClick={...}>Keep it</Button>
//       <Button variant="destructive" onClick={...}>Cancel booking</Button>
//     </Modal.Footer>
//   </Modal>
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useId } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"

import { useTranslation } from "react-i18next"
const SIZE_CLASS = {
  sm: "max-w-[480px]",
  md: "max-w-[600px]",
  lg: "max-w-[760px]",
  xl: "max-w-[920px]",
}

// Selector for "natively focusable" elements used by the focus trap.
const FOCUSABLE_SEL =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  dismissOnEsc = true,
  dismissOnBackdrop = true,
  initialFocusRef,
  className = "",
}) {
  const { t } = useTranslation("common")
  const dialogRef = useRef(null)
  const previouslyFocused = useRef(null)
  const reactId = useId()
  const titleId = `${reactId}-title`
  const descId = `${reactId}-desc`

  // ── Focus management ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement
    const dialog = dialogRef.current

    // Defer focus to next tick so the dialog has mounted
    const t = setTimeout(() => {
      const target =
        initialFocusRef?.current ||
        dialog?.querySelector(FOCUSABLE_SEL) ||
        dialog
      target?.focus({ preventScroll: true })
    }, 0)

    return () => {
      clearTimeout(t)
      // Restore focus to the originating element
      if (previouslyFocused.current && typeof previouslyFocused.current.focus === "function") {
        previouslyFocused.current.focus({ preventScroll: true })
      }
    }
  }, [open, initialFocusRef])

  // ── Body scroll lock ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = original
    }
  }, [open])

  // ── Keyboard handling: ESC + focus trap ─────────────────────────────────
  useEffect(() => {
    if (!open) return

    const handleKey = (e) => {
      if (e.key === "Escape" && dismissOnEsc) {
        e.stopPropagation()
        onClose?.()
        return
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll(FOCUSABLE_SEL)
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

  // SSR / non-DOM safety — portals require document
  if (typeof document === "undefined") return null

  const node = (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={dismissOnBackdrop ? onClose : undefined}
            className="absolute inset-0 bg-[rgba(26,27,35,0.55)] backdrop-blur-[2px]"
            aria-hidden="true"
          />

          {/* Dialog */}
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={[
              "relative w-full mx-0 sm:mx-4",
              SIZE_CLASS[size] || SIZE_CLASS.md,
              "bg-[var(--color-surface-card)] text-[var(--color-text-primary)]",
              "rounded-t-[18px] sm:rounded-[18px] shadow-[var(--shadow-overlay)]",
              "border border-[var(--color-border-subtle)]",
              "max-h-[90vh] overflow-hidden flex flex-col",
              className,
            ].join(" ")}
          >
            {/* Header */}
            {(title || description) && (
              <div className="flex items-start gap-4 p-6 pr-14 border-b border-[var(--color-border-subtle)]">
                <div className="min-w-0 flex-1">
                  {title && (
                    <h2 id={titleId} className="text-[20px] font-bold leading-[1.3] text-[var(--color-violet)]">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p id={descId} className="mt-1 text-[14px] leading-[1.55] text-[var(--color-text-secondary)]">
                      {description}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Close button, always present, top-right */}
            <button
              type="button"
              onClick={onClose}
              aria-label={t("system.closeDialog")}
              className="absolute right-4 top-4 z-10 rounded-md p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] transition-colors duration-[var(--motion-fast)]"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            {/* Body, scrolls if content overflows */}
            <div className="overflow-y-auto p-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )

  return createPortal(node, document.body)
}

// ── Modal.Footer ───────────────────────────────────────────────────────────
function ModalFooter({ children, align = "end", className = "" }) {
  const alignClass =
    align === "between"
      ? "justify-between"
      : align === "start"
      ? "justify-start"
      : "justify-end"
  return (
    <div
      className={[
        "flex flex-wrap items-center gap-3 px-6 py-4 -mx-6 -mb-6 mt-6",
        "border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]",
        "rounded-b-[18px]",
        alignClass,
        className,
      ].join(" ")}
    >
      {children}
    </div>
  )
}

Modal.Footer = ModalFooter

export default Modal
export { Modal, ModalFooter }
