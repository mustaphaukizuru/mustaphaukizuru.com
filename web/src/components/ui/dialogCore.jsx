/* eslint-disable react-refresh/only-export-components -- shared dialog plumbing (hooks + tiny presentational pieces) */
// ════════════════════════════════════════════════════════════════════════════
// dialogCore · shared behaviour for Modal + Drawer
// ────────────────────────────────────────────────────────────────────────────
// One place for the accessibility contract every overlay in the app must
// honour. Modal.jsx and Drawer.jsx compose these; nothing else should.
//
//   · useDialogBehaviour — Escape (top-most dialog only), focus trap with
//     focus restore, ref-counted body scroll lock, open/close stack.
//   · useDialogMotion    — prefers-reduced-motion aware framer variants.
//   · DialogPortal       — renders into <body>, SSR-safe.
//   · dialogCloseButtonClass — the shared "X" affordance styling.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { useReducedMotion } from "framer-motion"

import useFocusTrap from "../../hooks/useFocusTrap"
import useBodyScrollLock from "../../hooks/useBodyScrollLock"

// ── Open-dialog stack ───────────────────────────────────────────────────────
// Escape must only dismiss the dialog on top. Each open dialog pushes a
// token; the keydown handler checks it is the last entry before closing.
const dialogStack = []

/**
 * @param {object} args
 * @param {boolean}  args.open
 * @param {Function} args.onClose        — called with a reason string: "esc"
 * @param {object}   args.containerRef   — ref of the role="dialog" element
 * @param {boolean}  [args.dismissOnEsc=true]
 * @param {object}   [args.initialFocusRef]
 * @param {boolean|"container"} [args.initialFocus]
 * @param {boolean}  [args.lockScroll=true]
 */
export function useDialogBehaviour({
  open,
  onClose,
  containerRef,
  dismissOnEsc = true,
  initialFocusRef,
  initialFocus,
  lockScroll = true,
}) {
  const token = useRef({})
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useBodyScrollLock(Boolean(open && lockScroll))
  useFocusTrap(containerRef, Boolean(open), { initialFocusRef, initialFocus })

  useEffect(() => {
    if (!open) return undefined
    const me = token.current
    dialogStack.push(me)

    function onKey(e) {
      if (e.key !== "Escape" || e.defaultPrevented) return
      if (dialogStack[dialogStack.length - 1] !== me) return
      if (!dismissOnEsc) return
      e.stopPropagation()
      onCloseRef.current?.("esc")
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      const i = dialogStack.indexOf(me)
      if (i !== -1) dialogStack.splice(i, 1)
    }
  }, [open, dismissOnEsc])
}

// ── Motion ──────────────────────────────────────────────────────────────────
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1]
export const EASE_SOFT = [0.22, 1, 0.36, 1]

/**
 * Returns `{ reduce, backdrop, panel }` framer props. Under
 * prefers-reduced-motion the panel collapses to a short opacity fade and
 * the backdrop to an instant swap, so the end state is identical without
 * any translation/scale.
 *
 * @param {"scale"|"slide-up"|"slide-right"|"slide-left"|"slide-down"|"fade"} preset
 * @param {{ enter?: number, exit?: number, ease?: number[] }} [timing]
 */
export function useDialogMotion(preset = "scale", timing = {}) {
  const reduce = useReducedMotion()
  const enter = timing.enter ?? 0.24
  const exit = timing.exit ?? 0.18
  const ease = timing.ease ?? EASE_SOFT

  const backdrop = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: reduce ? 0 : Math.min(enter, 0.2), ease: "linear" },
  }

  if (reduce) {
    return {
      reduce,
      backdrop,
      panel: {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.12, ease: "linear" },
      },
    }
  }

  const PRESETS = {
    fade: { from: {}, to: {} },
    scale: { from: { y: 24, scale: 0.98 }, to: { y: 0, scale: 1 }, out: { y: 16, scale: 0.98 } },
    "slide-up": { from: { y: "100%" }, to: { y: 0 } },
    "slide-down": { from: { y: -12, scale: 0.98 }, to: { y: 0, scale: 1 }, out: { y: -8, scale: 0.98 } },
    "slide-right": { from: { x: "100%" }, to: { x: 0 } },
    "slide-left": { from: { x: "-100%" }, to: { x: 0 } },
  }
  const p = PRESETS[preset] || PRESETS.scale
  const isFull = preset === "slide-up" || preset === "slide-right" || preset === "slide-left"

  return {
    reduce,
    backdrop,
    panel: {
      initial: { opacity: isFull ? 1 : 0, ...p.from },
      animate: { opacity: 1, ...p.to, transition: { duration: enter, ease } },
      exit: { opacity: isFull ? 1 : 0, ...(p.out || p.from), transition: { duration: exit, ease } },
    },
  }
}

// ── Portal ──────────────────────────────────────────────────────────────────
export function DialogPortal({ children }) {
  if (typeof document === "undefined") return null
  return createPortal(children, document.body)
}

// ── Shared close-button styling ─────────────────────────────────────────────
export const dialogCloseButtonClass =
  "inline-flex h-10 w-10 items-center justify-center rounded-full cursor-pointer " +
  "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] " +
  "transition-colors duration-[var(--motion-fast)]"

export function cx(...parts) {
  return parts.filter(Boolean).join(" ")
}
