 
// ════════════════════════════════════════════════════════════════════════════
// Modal (Dialog) · canonical implementation · v2.0
// ────────────────────────────────────────────────────────────────────────────
// The ONE dialog surface in the app. Use sparingly — only for blocking,
// focused workflows (delete confirm, payment confirm, brief data entry,
// command palette, full-screen viewers).
//
// Behaviours (all built-in, none optional):
//   · role="dialog" + aria-modal + aria-labelledby / aria-label
//   · Focus moves into the dialog on open; the previously-focused element
//     is restored on close (hooks/useFocusTrap).
//   · Tab / Shift+Tab wrap inside the dialog.
//   · Escape closes (top-most dialog only) unless `dismissOnEsc={false}`.
//   · Backdrop click closes unless `dismissOnBackdrop={false}`.
//   · Body scroll locked while open (ref-counted, nested-safe).
//   · Framer transitions respect prefers-reduced-motion.
//   · Renders into <body> via a portal.
//
// Props
//   open, onClose(reason)          reason ∈ "esc" | "backdrop" | "close_button"
//   title, description             rendered in the default header; drive
//                                  aria-labelledby / aria-describedby
//   ariaLabel / ariaLabelledBy     for title-less dialogs (custom chrome)
//   size                           sm 480 · md 600 (default) · lg 760 ·
//                                  xl 920 · 2xl 1120 · full (viewport,
//                                  16px inset on sm+) · none (caller sizes)
//   placement                      "center" (default, bottom-sheet on
//                                  mobile) · "middle" (always centred) · "top"
//   motion                         "scale" (default) · "slide-up" · "fade"
//   bare                           true → no default header / padding /
//                                  surface classes; caller owns the chrome
//   hideClose                      suppress the built-in X button
//   className / panelStyle         panel element class / inline style
//   bodyClassName                  scroll body class (non-bare only)
//   backdropClassName              override backdrop tint / blur
//   zIndex                         numeric override (default --z-modal)
//   initialFocusRef                element to focus on open
//   footer                         node rendered in a Modal.Footer slot
//   closeLabel                     aria-label for the X button
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

import { useRef, useId } from "react"
import { m, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  useDialogBehaviour,
  useDialogMotion,
  DialogPortal,
  dialogCloseButtonClass,
  cx,
} from "./dialogCore"

const SIZE_CLASS = {
  sm: "max-w-[480px]",
  md: "max-w-[600px]",
  lg: "max-w-[760px]",
  xl: "max-w-[920px]",
  "2xl": "max-w-[1120px]",
  full: "h-full w-full sm:h-[calc(100%-32px)] sm:w-[calc(100%-32px)]",
  none: "",
}

const PLACEMENT_CLASS = {
  center: "items-end sm:items-center justify-center",
  top: "items-start justify-center",
  middle: "items-center justify-center",
}

function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  placement = "center",
  motion: motionPreset = "scale",
  dismissOnEsc = true,
  dismissOnBackdrop = true,
  initialFocusRef,
  initialFocus,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  bare = false,
  hideClose = false,
  className = "",
  panelStyle,
  bodyClassName = "",
  backdropClassName,
  wrapperClassName = "",
  zIndex,
  footer,
  closeLabel,
  onBackdropClick,
}) {
  const { t } = useTranslation("common")
  const dialogRef = useRef(null)
  const reactId = useId()
  const titleId = `${reactId}-title`
  const descId = `${reactId}-desc`

  useDialogBehaviour({
    open,
    onClose,
    containerRef: dialogRef,
    dismissOnEsc,
    initialFocusRef,
    initialFocus,
  })

  const { backdrop, panel } = useDialogMotion(motionPreset)

  const labelledBy = ariaLabelledBy || (title ? titleId : undefined)
  const describedBy = ariaDescribedBy || (description ? descId : undefined)
  const isFull = size === "full"

  const wrapperStyle = zIndex != null ? { zIndex } : undefined
  const wrapperZ = zIndex != null ? "" : "z-[var(--z-modal)]"

  function handleBackdrop(e) {
    onBackdropClick?.(e)
    if (dismissOnBackdrop) onClose?.("backdrop")
  }

  const panelClass = bare
    ? cx("relative w-full", SIZE_CLASS[size] ?? SIZE_CLASS.md, className)
    : cx(
        "relative w-full",
        SIZE_CLASS[size] ?? SIZE_CLASS.md,
        isFull ? "" : "mx-0 sm:mx-4",
        "bg-[var(--color-surface-card)] text-[var(--color-text-primary)]",
        isFull ? "rounded-none sm:rounded-[18px]" : "rounded-t-[18px] sm:rounded-[18px]",
        "shadow-[var(--shadow-overlay)] border border-[var(--color-border-subtle)]",
        isFull ? "" : "max-h-[90vh]",
        "overflow-hidden flex flex-col",
        className
      )

  return (
    <DialogPortal>
      <AnimatePresence>
        {open && (
          <div
            className={cx(
              "fixed inset-0 flex",
              wrapperZ,
              PLACEMENT_CLASS[placement] || PLACEMENT_CLASS.center,
              isFull ? "" : placement === "top" ? "p-3 pt-[6vh] sm:p-4 sm:pt-[12vh]" : "",
              wrapperClassName
            )}
            style={wrapperStyle}
          >
            {/* Backdrop */}
            <m.div
              {...backdrop}
              onClick={handleBackdrop}
              className={cx(
                "absolute inset-0",
                backdropClassName || "bg-[rgb(var(--color-charcoal-rgb)/0.55)] backdrop-blur-[2px]"
              )}
              aria-hidden="true"
            />

            {/* Dialog */}
            <m.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label={labelledBy ? undefined : ariaLabel}
              aria-labelledby={labelledBy}
              aria-describedby={describedBy}
              tabIndex={-1}
              {...panel}
              style={panelStyle}
              className={panelClass}
            >
              {bare ? (
                children
              ) : (
                <>
                  {(title || description) && (
                    <div className="flex items-start gap-4 p-6 pr-16 border-b border-[var(--color-border-subtle)]">
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

                  {!hideClose && (
                    <button
                      type="button"
                      onClick={() => onClose?.("close_button")}
                      aria-label={closeLabel || t("system.closeDialog")}
                      className={cx("cursor-pointer absolute right-3 top-3 z-10", dialogCloseButtonClass)}
                    >
                      <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                  )}

                  <div className={cx("min-h-0 flex-1 overflow-y-auto p-6", bodyClassName)}>{children}</div>

                  {footer ? <ModalFooter className="mx-0 mb-0 mt-0 shrink-0">{footer}</ModalFooter> : null}
                </>
              )}
            </m.div>
          </div>
        )}
      </AnimatePresence>
    </DialogPortal>
  )
}

// ── Modal.Footer ───────────────────────────────────────────────────────────
function ModalFooter({ children, align = "end", className = "" }) {
  const alignClass =
    align === "between" ? "justify-between" : align === "start" ? "justify-start" : "justify-end"
  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-3 px-6 py-4 -mx-6 -mb-6 mt-6",
        "border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]",
        "rounded-b-[18px]",
        alignClass,
        className
      )}
    >
      {children}
    </div>
  )
}

Modal.Footer = ModalFooter

export default Modal
export { Modal, ModalFooter }
export const Dialog = Modal
export const DialogFooter = ModalFooter
