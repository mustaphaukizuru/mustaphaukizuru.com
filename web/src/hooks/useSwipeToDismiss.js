import { useEffect } from "react"

/** Distance, in px, a horizontal drag must cover before it counts as a dismissal. */
export const SWIPE_DISMISS_PX = 64

/** Below this, a gesture has not declared an axis yet and is ignored. */
const INTENT_THRESHOLD_PX = 10

/**
 * Swipe-to-dismiss for a slide-out drawer — the gesture users expect.
 *
 * Extracted from the public header's mobile menu so the dashboard drawer
 * behaves identically instead of carrying a second hand-rolled copy (the
 * same reasoning as the single-owner rule for session storage in
 * `lib/api.js`). Both drawers enter from the same edge, so both dismiss on
 * the same gesture.
 *
 * The rules that matter, and why:
 *   · Horizontal intent is REQUIRED (|dx| > |dy|). An earlier version closed
 *     on any vertical movement, which meant scrolling the nav list dismissed
 *     the menu — the bug that made the menu look like it "disappeared".
 *   · Listeners are attached to the panel, never the document, so nothing
 *     else on the page is affected by an open drawer.
 *   · Listeners are passive: this never blocks scrolling, it only observes.
 *
 * @param {import("react").RefObject<HTMLElement>} ref  the drawer panel
 * @param {boolean} open                               only listens while open
 * @param {(reason: string) => void} onClose           called once per gesture
 * @param {object} [options]
 * @param {"left"|"right"} [options.edge="right"]      edge the panel enters from
 * @param {number} [options.distance]                  override the dismiss distance
 */
export default function useSwipeToDismiss(ref, open, onClose, options = {}) {
  const { edge = "right", distance = SWIPE_DISMISS_PX } = options

  useEffect(() => {
    if (!open) return undefined
    const el = ref.current
    if (!el) return undefined

    let startX = null
    let startY = null
    let decided = null // null → undecided, "horizontal" | "vertical"

    function onTouchStart(e) {
      if (e.touches.length !== 1) return
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      decided = null
    }

    function onTouchMove(e) {
      if (startX == null) return
      const dx = e.touches[0].clientX - startX
      const dy = e.touches[0].clientY - startY

      if (decided === null) {
        if (Math.abs(dx) < INTENT_THRESHOLD_PX && Math.abs(dy) < INTENT_THRESHOLD_PX) return
        decided = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical"
      }
      // A vertical gesture belongs to the scrollable list — never dismiss.
      if (decided !== "horizontal") return

      // Away from the edge the panel came from.
      const travelled = edge === "right" ? dx : -dx
      if (travelled > distance) {
        startX = null // one dismissal per gesture
        onClose("swipe")
      }
    }

    function onTouchEnd() {
      startX = null
      startY = null
      decided = null
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true })
    el.addEventListener("touchmove", onTouchMove, { passive: true })
    el.addEventListener("touchend", onTouchEnd, { passive: true })
    el.addEventListener("touchcancel", onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener("touchstart", onTouchStart)
      el.removeEventListener("touchmove", onTouchMove)
      el.removeEventListener("touchend", onTouchEnd)
      el.removeEventListener("touchcancel", onTouchEnd)
    }
  }, [ref, open, onClose, edge, distance])
}
