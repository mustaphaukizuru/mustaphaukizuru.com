/**
 * MotionProvider · roadmap step 32
 *
 * Single LazyMotion boundary for the whole app. Every animated element in
 * src/ uses the lightweight `m.*` components (not `motion.*`), so the
 * initial bundle only carries the framer-motion core; the feature runtime
 * (`domMax` — needed because layout / layoutId animations are in use in
 * Toast, CartPage, MobileMenu, UpcomingMeetingBanner)
 * is loaded async from ./features.js as its own chunk.
 *
 * `strict` throws in dev if a `motion.*` component slips back in.
 */
import { LazyMotion } from "framer-motion"

const loadFeatures = () => import("./features.js").then((mod) => mod.default)

export default function MotionProvider({ children }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      {children}
    </LazyMotion>
  )
}
