import { useEffect, useState } from "react"

/**
 * useCapsLock — detect Caps Lock state from any keyboard event on the
 * window. Lightweight, dependency-free, SSR-safe.
 *
 * @returns {boolean} true when Caps Lock is currently active.
 *
 * Usage:
 *   const capsOn = useCapsLock()
 *   {capsOn && <span>Caps Lock is on</span>}
 *
 * Notes:
 *   - Modern browsers expose the modifier through KeyboardEvent.getModifierState.
 *   - We listen on `window` so we catch state changes even when focus is
 *     not on a specific input (e.g. user toggles Caps before typing).
 */
export default function useCapsLock() {
  const [on, setOn] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    function handler(e) {
      // getModifierState is well-supported on all evergreen browsers.
      if (typeof e.getModifierState === "function") {
        setOn(Boolean(e.getModifierState("CapsLock")))
      }
    }

    window.addEventListener("keydown", handler)
    window.addEventListener("keyup", handler)
    return () => {
      window.removeEventListener("keydown", handler)
      window.removeEventListener("keyup", handler)
    }
  }, [])

  return on
}
