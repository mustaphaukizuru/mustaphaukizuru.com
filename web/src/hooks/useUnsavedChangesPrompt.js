import { useEffect } from "react"

/* ──────────────────────────────────────────────────────────────────────────
 *  useUnsavedChangesPrompt · F10.I · Batch 6B-3
 *
 *  Warns the user when they try to leave a form with unsaved changes.
 *  Two layers of protection:
 *
 *    1. `beforeunload` event — handles browser-level navigation:
 *       tab close, full page reload (Ctrl+R / Cmd+R), URL bar change,
 *       back/forward buttons. Browsers display a generic "Changes you
 *       made may not be saved" dialog.
 *
 *    2. Intra-app guard — for clicking <Link>s or programmatic
 *       navigate() calls inside the SPA. Implemented as a global click
 *       handler on internal anchors that confirms with the user before
 *       allowing default behavior.
 *
 *  ── Why not react-router's useBlocker? ─────────────────────────────────
 *  The codebase uses react-router-dom v6 in non-data-router mode (no
 *  createBrowserRouter), where useBlocker is not available. This hook
 *  works with both modes. If the project later migrates to data router,
 *  this hook can be replaced with useBlocker for cleaner intra-SPA
 *  blocking.
 *
 *  ── API ─────────────────────────────────────────────────────────────────
 *
 *  function MyForm() {
 *    const [isDirty, setIsDirty] = useState(false)
 *    useUnsavedChangesPrompt(isDirty)
 *    // ...
 *  }
 *
 *  ── Best practice ──────────────────────────────────────────────────────
 *  After a successful save, clear `isDirty` to release the lock so the
 *  user can navigate away normally. After a successful create that
 *  redirects to /:id/edit, clear before the redirect.
 *  ──────────────────────────────────────────────────────────────────── */

const PROMPT_MESSAGE = "You have unsaved changes. Are you sure you want to leave?"

export default function useUnsavedChangesPrompt(when) {
  // ── Layer 1: beforeunload (browser-level) ──────────────────────────
  useEffect(() => {
    if (!when) return undefined
    function handleBeforeUnload(event) {
      // Modern browsers display their own generic warning text.
      // Setting returnValue is required for the prompt to show.
      event.preventDefault()
      event.returnValue = PROMPT_MESSAGE
      return PROMPT_MESSAGE
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [when])

  // ── Layer 2: intra-app link click guard ────────────────────────────
  // Wraps all internal anchor clicks in a window.confirm() prompt while
  // `when` is true. Uses event capture so it runs before react-router's
  // own click handler.
  useEffect(() => {
    if (!when) return undefined
    function handleClick(event) {
      // Only interested in plain primary-button anchor clicks
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const anchor = event.target.closest && event.target.closest("a")
      if (!anchor) return

      // Skip external + new-tab + download anchors
      const href = anchor.getAttribute("href")
      if (!href || href.startsWith("#")) return
      if (anchor.target === "_blank") return
      if (anchor.hasAttribute("download")) return

      // Skip same-page anchors
      try {
        const url = new URL(href, window.location.origin)
        if (url.origin !== window.location.origin) return
        if (url.pathname === window.location.pathname && url.search === window.location.search) return
      } catch {
        return
      }

      // Final confirm gate
      const proceed = window.confirm(PROMPT_MESSAGE)
      if (!proceed) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    document.addEventListener("click", handleClick, true)
    return () => document.removeEventListener("click", handleClick, true)
  }, [when])
}

/**
 * Tiny helper for pages that want to compute `isDirty` by deep-comparing
 * their current form state to the last persisted snapshot. JSON.stringify
 * is intentional — this is fine for small flat form objects (which is the
 * shape our admin forms have). For deeply nested objects, swap for
 * lodash.isEqual.
 */
export function computeIsDirty(currentForm, savedSnapshot) {
  if (!savedSnapshot) return false
  try {
    return JSON.stringify(currentForm) !== JSON.stringify(savedSnapshot)
  } catch {
    return false
  }
}
