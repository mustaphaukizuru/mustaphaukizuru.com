import { useLocation } from "react-router-dom"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"

/**
 * PageTransition · cross-fade + tiny rise between routes
 *
 * Wrap the `<Routes>` element (or its parent <Suspense>) inside this
 * component to get a quiet fade + 12px rise between route changes. Uses
 * `useLocation().pathname` as the AnimatePresence key so route changes
 * trigger exit/enter cleanly. Respects prefers-reduced-motion by
 * collapsing to a snap-cut (no animation).
 *
 * Usage:
 *   <PageTransition>
 *     <Routes>
 *       <Route ... />
 *     </Routes>
 *   </PageTransition>
 *
 * Why we wrap a wrapper around Routes rather than per-route: the
 * component-based <Routes> doesn't expose per-route motion lifecycle
 * without significant restructuring. Animating the pathname-keyed
 * container is the lightest-touch way to get the effect without
 * touching every route definition.
 */
export default function PageTransition({ children }) {
  const location = useLocation()
  const reduced  = useReducedMotion()

  if (reduced) return children

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{    opacity: 0, y: -8 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        style={{ willChange: "opacity, transform" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
