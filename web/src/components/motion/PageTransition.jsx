import { useLocation, useNavigationType } from "react-router-dom"
import { m, AnimatePresence, useReducedMotion } from "framer-motion"

/**
 * PageTransition · route-level transitions (roadmap step 37)
 *
 * Wraps `<Routes>` and keys a motion container on `pathname` so every route
 * change gets a short cross-fade with a directional 12px slide:
 *   - PUSH / REPLACE → new page enters from the right, old page exits left
 *   - POP (browser back/forward) → the reverse, so "back" visibly rewinds
 *
 * Design decisions:
 *   - `mode="popLayout"`: the exiting page is popped out of flow (absolute)
 *     so the incoming page — and any Suspense fallback for a slow lazy
 *     route — renders immediately underneath the fade instead of the page
 *     blanking the way `mode="wait"` would. Requires `position: relative`
 *     on the host (done below).
 *   - Duration 240ms enter / 180ms exit, `--ease-out-soft` curve.
 *   - `useReducedMotion` → children rendered untouched (instant swap).
 *   - Admin / dashboard routes (incl. `/es/...` prefixed) are keyed on a
 *     constant so navigating inside those shells never animates.
 *   - Scroll: nothing here touches scroll — ScrollToTopOnNavigate (or Lenis)
 *     keeps its own behaviour. The container carries NO `will-change`:
 *     a persistent one makes this a containing block for every
 *     `position: fixed` descendant in the app. See the note below.
 *   - Shared elements: cards use `layoutId="product-cover-<slug>"` /
 *     `"project-cover-<slug>"` and the detail pages carry the same id, so the
 *     cover flies into the hero while the page cross-fades.
 */

const NO_TRANSITION = /^(?:\/[a-z]{2})?\/(?:admin|dashboard)(?:\/|$)/i
const EASE_OUT_SOFT = [0.22, 1, 0.36, 1] // mirrors --ease-out-soft in index.css
const SHIFT = 12

const variants = {
  initial: ({ dir, instant }) => (instant ? { opacity: 1, x: 0 } : { opacity: 0, x: SHIFT * dir }),
  animate: ({ instant }) => ({
    opacity: 1,
    x: 0,
    transition: instant ? { duration: 0 } : { duration: 0.24, ease: EASE_OUT_SOFT },
  }),
  exit: ({ dir, instant }) =>
    instant
      ? { opacity: 1, x: 0, transition: { duration: 0 } }
      : { opacity: 0, x: -SHIFT * dir, transition: { duration: 0.18, ease: EASE_OUT_SOFT } },
}

export default function PageTransition({ children }) {
  const { pathname } = useLocation()
  const navType = useNavigationType()
  const reduced = useReducedMotion()

  if (reduced) return children

  const shell = NO_TRANSITION.test(pathname)
  const custom = { dir: navType === "POP" ? -1 : 1, instant: shell }

  return (
    <div style={{ position: "relative" }}>
      <AnimatePresence mode="popLayout" initial={false} custom={custom}>
        <m.div
          key={shell ? "shell" : pathname}
          custom={custom}
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          /* NO `willChange` here, and that is a fix rather than an omission.
           *
           * This wrapper contains every route in the app, and a persistent
           * `will-change: transform` makes it a CONTAINING BLOCK for
           * `position: fixed` descendants. So nothing fixed inside a page
           * was ever fixed to the VIEWPORT — it was fixed to the document.
           * Measured on the dashboard at 375x812:
           *
           *   the mobile bottom tab bar   top: 1901px, off-screen at every
           *                               scroll position. The primary
           *                               navigation on a phone was invisible.
           *   the mobile nav drawer       2003px tall, with the theme control
           *                               at y=1873 and SIGN OUT at y=1943,
           *                               both unreachable.
           *   the cookie banner           floating mid-page over the cards
           *                               instead of pinned to the bottom.
           *
           * Framer Motion sets and clears `will-change` around its own
           * animations; hardcoding it in `style` keeps it forever and buys
           * a GPU hint for a 240ms cross-fade at the cost of every fixed
           * overlay in the product. */
        >
          {children}
        </m.div>
      </AnimatePresence>
    </div>
  )
}
