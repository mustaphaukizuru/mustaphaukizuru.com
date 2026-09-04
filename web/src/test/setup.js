/**
 * Shared setup for the frontend unit lane.
 *
 * Three things every suite needs and none should repeat:
 *   1. jest-dom matchers (toBeInTheDocument and friends).
 *   2. A clean browser between tests. jsdom keeps one window for the whole
 *      FILE, so localStorage, cookies and listeners leak from test to test
 *      exactly the way the backend suite's process.env leaks between files.
 *      Wiping here means a suite can never depend on the order it runs in.
 *   3. matchMedia, which jsdom does not implement and which the motion
 *      layer calls on mount through useReducedMotion.
 */
import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, beforeEach, vi } from "vitest"

// jsdom ships no matchMedia; framer-motion's reduced-motion hook needs it.
// Defaults to "no preference" so components render their normal path.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

/** Remove every cookie jsdom currently holds for this document. */
function clearCookies() {
  for (const pair of document.cookie.split(";")) {
    const name = pair.split("=")[0]?.trim()
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
  }
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  clearCookies()
})

afterEach(() => {
  cleanup()
  clearCookies()
  localStorage.clear()
  vi.unstubAllGlobals()
})
