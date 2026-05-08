import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowUp } from "lucide-react"

import { useTranslation } from "react-i18next"
/**
 * ScrollToTop · F11.C · Batch 2
 *
 * Floating back-to-top button rendered globally. Appears after the user has
 * scrolled past 400 px and disappears when they scroll back up. Click triggers
 * a smooth scroll to the document top.
 *
 * Layout:
 *   - Fixed bottom-right
 *   - Bottom inset = 1.5rem desktop · 5rem mobile (clears the OS bottom nav
 *     bar / browser chrome on iOS Safari and Chrome Android)
 *   - Above the OfflineBanner (z-40 vs banner's z-50)
 *
 * A11y: aria-label, focus-visible Deep Azure ring, keyboard-activatable.
 *
 * Note: This file used to contain the route-change scroll reset effect.
 * That effect now lives in ScrollToTopOnNavigate.jsx.
 */
export default function ScrollToTop() {
  const { t } = useTranslation("common")
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 400)
    }
    onScroll() // initialize on mount
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  function handleClick() {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" })
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={handleClick}
          aria-label={t("system.scrollTop")}
          initial={{ opacity: 0, y: 12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.9 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.95 }}
          className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-violet text-white shadow-[0_12px_32px_rgba(93,63,211,0.32)] transition-colors hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 focus-visible:ring-offset-2 sm:bottom-8 sm:right-8"
        >
          <ArrowUp className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />
        </motion.button>
      )}
    </AnimatePresence>
  )
}
