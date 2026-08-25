/**
 * Device/preference gate for the Home hero depth layer (roadmap step 34).
 * Every condition must hold, otherwise the static gradient stays alone.
 * Runs only in the browser; returns false when matchMedia is unavailable.
 */
export function canRenderHeroDepth() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false
  if (!window.matchMedia("(min-width: 1024px)").matches) return false
  if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return false
  if (navigator.connection?.saveData === true) return false
  if ((navigator.hardwareConcurrency ?? 0) < 4) return false
  return true
}

/**
 * Wait for `window` load, then for an idle slot (fallback 1500 ms), then call `cb`.
 * Returns a cancel function.
 */
export function scheduleAfterLoad(cb) {
  let idleId = null
  let timerId = null
  let cancelled = false

  const idle = () => {
    if (cancelled) return
    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(() => !cancelled && cb(), { timeout: 3000 })
    } else {
      timerId = window.setTimeout(() => !cancelled && cb(), 1500)
    }
  }

  if (document.readyState === "complete") idle()
  else window.addEventListener("load", idle, { once: true })

  return () => {
    cancelled = true
    window.removeEventListener("load", idle)
    if (idleId != null && typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idleId)
    if (timerId != null) window.clearTimeout(timerId)
  }
}
