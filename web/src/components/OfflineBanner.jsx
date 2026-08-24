import { useEffect, useState } from "react"
import { m, AnimatePresence } from "framer-motion"
import { WifiOff, X } from "lucide-react"
import { useTranslation } from "react-i18next"

/* ──────────────────────────────────────────────────────────────────────────
 *  OfflineBanner · F11.E · Batch 2
 *
 *  Banner shown at the top of the viewport when navigator.onLine = false.
 *  Rose Signal background, Cloud Mist text, WifiOff icon, dismissible.
 *
 *  Auto-shows when the browser fires "offline", auto-hides when "online"
 *  fires. The dismissed state resets on each online ↔ offline transition so
 *  the user always sees the banner the next time they go offline (rather
 *  than silently failing).
 *
 *  Mounted globally in main.jsx alongside <App /> so it sits above every
 *  route's content. z-[60] keeps it above floating UI like the back-to-top
 *  button (z-40).
 *  ──────────────────────────────────────────────────────────────────────── */
export default function OfflineBanner() {
  const { t } = useTranslation("common")
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  )
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    function handleOnline() {
      setOffline(false)
      setDismissed(false)
    }
    function handleOffline() {
      setOffline(true)
      setDismissed(false)
    }
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  const visible = offline && !dismissed

  return (
    <AnimatePresence>
      {visible && (
        <m.div
          key="offline-banner"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          role="alert"
          aria-live="assertive"
          className="fixed inset-x-0 top-0 z-[60] bg-rose text-mist shadow-[0_12px_32px_rgba(225,29,72,0.30)]"
        >
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
            <WifiOff
              className="h-4 w-4 shrink-0"
              strokeWidth={2.2}
              aria-hidden="true"
            />
            <p className="flex-1 text-meta font-medium leading-tight">
              {t("offline.youreOffline")}
              <span className="ml-2 font-normal text-white/70">
                {t("offline.featuresHint")}
              </span>
            </p>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label={t("offline.dismissAria")}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-rose"
            >
              <X className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  )
}
