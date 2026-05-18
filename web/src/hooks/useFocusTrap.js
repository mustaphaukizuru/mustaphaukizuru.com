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
     useFocusTrap(ref, isMenuOpen)
     return <aside ref={ref}>...</aside>

   Behavior:
     · On `active` transition false → true: queries all focusable
       descendants, focuses the first one (override via initialFocusRef
       option), captures `document.activeElement` for later restoration.
     · While active: intercepts Tab (cycles last → first) and
       Shift+Tab (cycles first → last) at the document level. Other
       key events propagate normally so Esc-to-close still works.
     · On `active` transition true → false: restores focus to the
       captured element if it's still in the DOM.

   Performance:
     · Re-queries focusable elements on every Tab press rather than
       caching at activation — handles dynamically-rendered content
       (e.g., a logged-in user's profile card appearing after auth
       loads). Negligible cost: querySelectorAll on a small subtree.
   ════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef } from "react"

// Native focusable selector — covers links, buttons, form fields, and
// any element with an explicit tabindex (excluding -1 which is "focusable
// programmatically but not via Tab"). Mirrors the selector used by
// focus-trap, ally.js, and Reach UI's own trap.
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(", ")

export default function useFocusTrap(containerRef, active, options = {}) {
  // `previouslyFocusedRef` survives across re-renders so the cleanup
  // path can restore focus even if `options` object identity changes.
  const previouslyFocusedRef = useRef(null)

  useEffect(() => {
    if (!active) return undefined
    const container = containerRef.current
    if (!container) return undefined

    // Capture the element that had focus before the trap activates.
    // We'll restore focus here when the trap deactivates.
    previouslyFocusedRef.current = document.activeElement

    function getFocusable() {
      // NOTE: filter for visible elements — `display: none` ones are
      // queryable but not actually focusable; including them would
      // create a "phantom" tab stop.
      return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (el) => {
          if (el.offsetParent === null && el !== document.activeElement) return false
          if (el.getAttribute("aria-hidden") === "true") return false
          return true
        }
      )
    }

    // Initial focus — either an explicitly-passed ref or the first
    // focusable element inside the container. Deferred by one task so
    // entrance animations (transform-based slides) finish settling
    // before the browser scrolls the focused element into view.
    const initialFocusTimer = window.setTimeout(() => {
      const target = options.initialFocusRef?.current
      if (target && container.contains(target)) {
        target.focus({ preventScroll: true })
        return
      }
      const focusables = getFocusable()
      if (focusables.length > 0) {
        focusables[0].focus({ preventScroll: true })
      } else {
        // Make the container itself focusable as a last resort —
        // ensures screen readers announce the dialog title.
        container.setAttribute("tabindex", "-1")
        container.focus({ preventScroll: true })
      }
    }, 80)

    function handleKeyDown(e) {
      if (e.key !== "Tab") return
      const focusables = getFocusable()
      if (focusables.length === 0) {
        e.preventDefault()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const activeEl = document.activeElement

      if (e.shiftKey) {
        // Shift+Tab from first → wrap to last
        if (activeEl === first || !container.contains(activeEl)) {
          e.preventDefault()
          last.focus({ preventScroll: true })
        }
      } else {
        // Tab from last → wrap to first
        if (activeEl === last || !container.contains(activeEl)) {
          e.preventDefault()
          first.focus({ preventScroll: true })
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => {
      window.clearTimeout(initialFocusTimer)
      document.removeEventListener("keydown", handleKeyDown)
      // Restore focus to the previously-focused element if still in DOM.
      const previous = previouslyFocusedRef.current
      if (previous && typeof previous.focus === "function" && document.contains(previous)) {
        previous.focus({ preventScroll: true })
      }
      previouslyFocusedRef.current = null
    }
  }, [active, containerRef, options])
}
