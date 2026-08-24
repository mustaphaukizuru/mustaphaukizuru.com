/* ════════════════════════════════════════════════════════════════════════
   useFocusTrap · keyboard accessibility primitive
   ────────────────────────────────────────────────────────────────────────
   Traps Tab / Shift+Tab inside a container while `active` is true.
   Restores focus to the previously-focused element on deactivation.

   Why this exists:
     · WCAG 2.1 §2.4.3 "Focus Order" — when a modal/drawer is open,
       Tab focus must cycle WITHIN it. Without a trap, Tab from the
       last focusable element jumps to background page content, losing
       the user's orientation and visible focus indicator.

   Usage:
     const ref = useRef(null)
     useFocusTrap(ref, isMenuOpen, { initialFocusRef })
     return <aside ref={ref}>...</aside>

   Options (all optional, read live — object identity does not matter):
     · initialFocusRef  — ref of the element to focus on activation.
                          Falls back to the first focusable descendant,
                          then to the container itself (tabindex=-1).
     · initialFocus     — false to skip initial focus entirely (the
                          caller manages it), "container" to focus the
                          container rather than its first child.
     · returnFocus      — false to skip focus restore on deactivation.
     · returnFocusRef   — explicit element to return focus to.
     · focusDelay       — ms to defer the initial focus (default 80) so
                          transform-based entrance animations settle
                          before the browser scrolls the target into view.

   Behavior:
     · On `active` transition false → true: captures document.activeElement,
       then focuses the initial target.
     · While active: intercepts Tab / Shift+Tab at the document level and
       wraps last → first / first → last. Focus that escapes the container
       (e.g. via a click on the backdrop) is pulled back on the next Tab.
       Other keys propagate normally so Esc-to-close still works.
     · On `active` transition true → false: restores focus to the captured
       element if it is still in the DOM and still focusable.

   Performance:
     · Re-queries focusable elements on every Tab press rather than
       caching at activation — handles dynamically-rendered content.
       Negligible cost: querySelectorAll on a small subtree.
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef } from "react"

// Native focusable selector — covers links, buttons, form fields, and
// any element with an explicit tabindex (excluding -1 which is "focusable
// programmatically but not via Tab"). Mirrors the selector used by
// focus-trap, ally.js, and Reach UI's own trap.
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "audio[controls]",
  "video[controls]",
  "summary",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(", ")

function isVisible(el) {
  if (el.getAttribute("aria-hidden") === "true") return false
  if (el.closest("[inert]")) return false
  // `display: none` ancestors zero out the client rects; fixed-position
  // elements have offsetParent === null but still have a rect.
  if (el.offsetParent === null && el.getClientRects().length === 0) return false
  return true
}

export function getFocusableElements(container) {
  if (!container) return []
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(isVisible)
}

function safeFocus(el) {
  if (!el || typeof el.focus !== "function") return false
  try {
    el.focus({ preventScroll: true })
  } catch {
    return false
  }
  return document.activeElement === el
}

export default function useFocusTrap(containerRef, active, options = {}) {
  // Options are read through a ref so callers can pass an inline object
  // literal without re-triggering the effect (which would re-capture
  // `previouslyFocused` on every render and break focus restore).
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  // Survives across re-renders so the cleanup path can restore focus.
  const previouslyFocusedRef = useRef(null)

  useEffect(() => {
    if (!active) return undefined
    const container = containerRef.current
    if (!container) return undefined

    previouslyFocusedRef.current = document.activeElement

    const opts = optionsRef.current || {}

    // ── Initial focus ────────────────────────────────────────────────────
    let initialFocusTimer = null
    if (opts.initialFocus !== false) {
      const delay = typeof opts.focusDelay === "number" ? opts.focusDelay : 80
      initialFocusTimer = window.setTimeout(() => {
        const current = optionsRef.current || {}
        const explicit = current.initialFocusRef?.current
        if (explicit && container.contains(explicit) && safeFocus(explicit)) return

        if (current.initialFocus !== "container") {
          const first = getFocusableElements(container)[0]
          if (first && safeFocus(first)) return
        }

        // Last resort — make the container itself focusable so screen
        // readers announce the dialog and Tab starts from inside it.
        if (!container.hasAttribute("tabindex")) container.setAttribute("tabindex", "-1")
        safeFocus(container)
      }, delay)
    }

    // ── Tab wrap ─────────────────────────────────────────────────────────
    function handleKeyDown(e) {
      if (e.key !== "Tab" || e.defaultPrevented) return
      if (!document.contains(container)) return

      const focusables = getFocusableElements(container)
      const activeEl = document.activeElement
      const inside = container.contains(activeEl)

      if (focusables.length === 0) {
        // Nothing tabbable — keep focus parked on the container.
        e.preventDefault()
        if (!container.hasAttribute("tabindex")) container.setAttribute("tabindex", "-1")
        safeFocus(container)
        return
      }

      const first = focusables[0]
      const last = focusables[focusables.length - 1]

      if (e.shiftKey) {
        if (!inside || activeEl === first || activeEl === container) {
          e.preventDefault()
          safeFocus(last)
        }
      } else if (!inside || activeEl === last) {
        e.preventDefault()
        safeFocus(first)
      }
    }

    document.addEventListener("keydown", handleKeyDown, true)

    return () => {
      if (initialFocusTimer) window.clearTimeout(initialFocusTimer)
      document.removeEventListener("keydown", handleKeyDown, true)

      const current = optionsRef.current || {}
      const previous = current.returnFocusRef?.current || previouslyFocusedRef.current
      previouslyFocusedRef.current = null
      if (current.returnFocus === false) return
      if (
        previous &&
        previous !== document.body &&
        typeof previous.focus === "function" &&
        document.contains(previous)
      ) {
        // Defer one frame — the trap usually deactivates during an exit
        // animation / unmount, and focusing synchronously can be undone
        // by React removing the dialog node right after.
        window.requestAnimationFrame(() => {
          if (document.contains(previous)) safeFocus(previous)
        })
      }
    }
  }, [active, containerRef])
}
