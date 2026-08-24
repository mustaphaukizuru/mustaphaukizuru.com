 
// ════════════════════════════════════════════════════════════════════════════
// Drawer (Sheet) · canonical implementation · v2.0
// ────────────────────────────────────────────────────────────────────────────
// Slide-in panel for secondary workflows: mini-cart, filters, edit-in-place,
// contextual detail, mobile navigation. Not a substitute for Modal — Modal
// is for blocking decisions, Drawer is for parallel work.
//
// Sides:   right (default) · left · bottom
// Sizes:   sm 360 · md 440 (default) · lg 560 · xl 720 · full · none
//
// Behaviours: identical accessibility contract to Modal (dialogCore):
// role="dialog", aria-modal, labelled, focus trap + restore, Escape
// (top-most only), backdrop click, ref-counted scroll lock, reduced-motion
// aware slide, portal to <body>.
//
// Structural note — the panel is split into a non-animated `fixed`
// positioning wrapper (owns top/right/bottom + 100dvh) and an inner
// motion.aside that only carries the transform. Putting `position: fixed`
// and `transform` on the same node makes Safari/Chromium compute the height
// inconsistently (content-height instead of viewport-height) — the wrapper
// keeps dimensions immune to that.
//
// Props (superset of Modal's; see Modal.jsx for the shared ones)
//   side                 "right" | "left" | "bottom"
//   size                 see above; "none" lets `className` size the panel
//   bare                 caller owns header/body/footer; panel is a flex
//                        column with no padding
//   transition           { enter, exit, ease } — override slide timing
//   panelRef             optional ref forwarded to the role="dialog" node
//   footer               node rendered in a Drawer.Footer slot
// ════════════════════════════════════════════════════════════════════════════

import { useRef, useId } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
  useDialogBehaviour,
  useDialogMotion,
  DialogPortal,
  dialogCloseButtonClass,
  EASE_OUT_EXPO,
  cx,
} from "./dialogCore"

const WRAPPER_BY_SIDE = {
  right: "top-0 right-0 bottom-0 justify-end",
  left: "top-0 left-0 bottom-0 justify-start",
  bottom: "left-0 right-0 bottom-0",
}

const SIZE_BY_SIDE = {
  right: { sm: "w-[360px]", md: "w-[440px]", lg: "w-[560px]", xl: "w-[720px]", full: "w-full", none: "w-full" },
  left: { sm: "w-[360px]", md: "w-[440px]", lg: "w-[560px]", xl: "w-[720px]", full: "w-full", none: "w-full" },
  bottom: { sm: "h-[40vh]", md: "h-[55vh]", lg: "h-[70vh]", xl: "h-[85vh]", full: "h-full", none: "" },
}

const MOTION_BY_SIDE = { right: "slide-right", left: "slide-left", bottom: "slide-up" }

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
  transition,
  panelRef: externalPanelRef,
  footer,
  closeLabel,
  onBackdropClick,
}) {
  const { t } = useTranslation("common")
  const internalRef = useRef(null)
  const panelRef = externalPanelRef || internalRef
  const reactId = useId()
  const titleId = `${reactId}-title`
  const descId = `${reactId}-desc`

  useDialogBehaviour({
    open,
    onClose,
    containerRef: panelRef,
    dismissOnEsc,
    initialFocusRef,
    initialFocus,
  })

  const { backdrop, panel } = useDialogMotion(MOTION_BY_SIDE[side] || "slide-right", {
    enter: transition?.enter ?? 0.32,
    exit: transition?.exit ?? 0.26,
    ease: transition?.ease ?? EASE_OUT_EXPO,
  })

  const labelledBy = ariaLabelledBy || (title ? titleId : undefined)
  const describedBy = ariaDescribedBy || (description ? descId : undefined)
  const sideSizes = SIZE_BY_SIDE[side] || SIZE_BY_SIDE.right
  const sizeClass = sideSizes[size] ?? sideSizes.md
  const isBottom = side === "bottom"

  const wrapperStyle = {
    ...(zIndex != null ? { zIndex } : null),
    pointerEvents: "none",
    ...(isBottom ? null : { height: "100dvh", maxHeight: "100dvh" }),
  }
  const zClass = zIndex != null ? "" : "z-[var(--z-modal)]"

  function handleBackdrop(e) {
    onBackdropClick?.(e)
    if (dismissOnBackdrop) onClose?.("backdrop")
  }

  const panelClass = bare
    ? cx("relative flex w-full flex-col overflow-hidden", isBottom ? "" : "h-full", className)
    : cx(
        "relative flex w-full flex-col overflow-hidden",
        isBottom ? "max-h-[90vh] rounded-t-[18px]" : "h-full",
        "bg-[var(--color-surface-card)] text-[var(--color-text-primary)]",
        "shadow-[var(--shadow-overlay)] border border-[var(--color-border-subtle)]",
        className
      )

  return (
    <DialogPortal>
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop — its own fixed layer so it covers the viewport
                regardless of the panel wrapper's dimensions. */}
            <motion.div
              key="drawer-backdrop"
              {...backdrop}
              onClick={handleBackdrop}
              aria-hidden="true"
              className={cx(
                "fixed inset-0",
                zClass,
                backdropClassName || "bg-[rgba(26,27,35,0.55)]",
                wrapperClassName
              )}
              style={zIndex != null ? { zIndex } : undefined}
            />

            {/* Positioning wrapper (no transform) */}
            <div
              key="drawer-panel-wrapper"
              className={cx(
                "fixed flex",
                zClass,
                WRAPPER_BY_SIDE[side] || WRAPPER_BY_SIDE.right,
                isBottom ? "w-full" : "max-w-full",
                sizeClass,
                wrapperClassName
              )}
              style={wrapperStyle}
            >
              <motion.aside
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={labelledBy ? undefined : ariaLabel}
                aria-labelledby={labelledBy}
                aria-describedby={describedBy}
                tabIndex={-1}
                {...panel}
                style={{ pointerEvents: "auto", ...(isBottom ? null : { height: "100%" }), ...panelStyle }}
                className={panelClass}
              >
                {bare ? (
                  children
                ) : (
                  <>
                    {(title || description) && (
                      <div className="relative flex shrink-0 items-start gap-4 px-6 py-5 pr-16 border-b border-[var(--color-border-subtle)]">
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
                    )}

                    {!hideClose && (
                      <button
                        type="button"
                        onClick={() => onClose?.("close_button")}
                        aria-label={closeLabel || t("system.closePanel")}
                        className={cx("cursor-pointer absolute right-3 top-3 z-10", dialogCloseButtonClass)}
                      >
                        <X className="h-5 w-5" aria-hidden="true" />
                      </button>
                    )}

                    <div className={cx("min-h-0 flex-1 overflow-y-auto p-6", bodyClassName)}>{children}</div>

                    {footer ? <DrawerFooter className="shrink-0">{footer}</DrawerFooter> : null}
                  </>
                )}
              </motion.aside>
            </div>
          </>
        )}
      </AnimatePresence>
    </DialogPortal>
  )
}

// ── Drawer.Footer ──────────────────────────────────────────────────────────
function DrawerFooter({ children, align = "end", className = "" }) {
  const alignClass =
    align === "between" ? "justify-between" : align === "start" ? "justify-start" : "justify-end"
  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-3 px-6 py-4 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]",
        alignClass,
        className
      )}
    >
      {children}
    </div>
  )
}

Drawer.Footer = DrawerFooter

export default Drawer
export { Drawer, DrawerFooter }
export const Sheet = Drawer
export const SheetFooter = DrawerFooter
