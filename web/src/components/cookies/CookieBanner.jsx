/* ════════════════════════════════════════════════════════════════════════
   CookieBanner.jsx · GDPR-compliant cookie consent banner
   ────────────────────────────────────────────────────────────────────────
   Renders only when the user has not yet decided. Provides three explicit
   actions: {t("cookies.acceptAll")}, {t("cookies.rejectAll")}, Manage preferences (granular). Uses
   Framer Motion for the entrance/exit and brand tokens (#5D3FD3 / #1A1B23)
   for visual consistency with the rest of the site.

   Accessibility:
     · role="dialog" + aria-modal="false" so it announces but does not trap
     · Each control is a real <button> with discernible label
     · Visible at 14px+ and meets WCAG AA contrast on the dark surface

   Placement: mount once at the root of the app (App.jsx).
   ════════════════════════════════════════════════════════════════════════ */

import { useState } from "react"
import { Link } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Cookie, ShieldCheck, Settings, Check, X } from "lucide-react"
import { useCookieConsent, COOKIE_CATEGORIES } from "../../context/CookieConsentContext"
import { useTranslation } from "react-i18next"

/* ── Granular preferences modal ─────────────────────────────────────────── */
function PreferencesModal({ open, onClose }) {
  const { t } = useTranslation("common")
  const { categories, setCategories, acceptAll, rejectAll } = useCookieConsent()

  // Local draft state so toggling doesn't persist until "{t("cookies.savePrefs")}"
  const [draft, setDraft] = useState(() => ({ ...categories }))

  function toggle(key) {
    setDraft((d) => ({ ...d, [key]: !d[key] }))
  }

  function handleSave() {
    setCategories(draft)
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm"
            aria-hidden="true"
          />
          {/* Modal */}
          <motion.div
            key="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-prefs-title"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed left-1/2 top-1/2 z-[121] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-[#1A1B23]/15 bg-white shadow-[0_30px_80px_rgba(93,63,211,0.25)]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#1A1B23]/10 px-6 py-5">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[#EDE9FB] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5D3FD3]">
                  <Cookie className="h-3 w-3" /> {t("cookies.title")}
                </div>
                <h2 id="cookie-prefs-title" className="mt-2 text-[20px] font-bold text-[#5D3FD3]">
                  {t("cookies.subtitle")}
                </h2>
                <p className="mt-1 text-[12.5px] leading-5 text-[#1A1B23]/75">
                  {t("cookies.toggleNote")}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("cookies.closeAria")}
                className="-mt-1 -mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#1A1B23]/55 transition hover:bg-[#F5F2FE] hover:text-[#5D3FD3]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[55vh] overflow-y-auto px-6 py-5">
              <ul className="flex flex-col gap-3">
                {COOKIE_CATEGORIES.map((cat) => {
                  const enabled = Boolean(draft[cat.key])
                  return (
                    <li
                      key={cat.key}
                      className="rounded-xl border border-[#1A1B23]/12 bg-[#fafafa] p-4 transition hover:border-[#5D3FD3]/20"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-[14px] font-bold text-[#5D3FD3]">{cat.title}</h3>
                            {cat.locked && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#e5f4e8] px-2 py-0.5 text-[10px] font-semibold text-[#3b8f47]">
                                <ShieldCheck className="h-2.5 w-2.5" /> {t("cookies.alwaysOn")}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[12px] leading-5 text-[#1A1B23]/75">{cat.description}</p>
                          <p className="mt-1.5 font-mono text-[10.5px] text-[#1A1B23]/55">
                            Examples: {cat.examples}
                          </p>
                        </div>

                        <button
                          type="button"
                          role="switch"
                          aria-checked={enabled}
                          aria-label={`Toggle ${cat.title}`}
                          disabled={cat.locked}
                          onClick={() => !cat.locked && toggle(cat.key)}
                          className={[
                            "relative h-6 w-11 shrink-0 rounded-full transition",
                            enabled ? "bg-[#5D3FD3]" : "bg-[#1A1B23]/25",
                            cat.locked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:opacity-90",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all",
                              enabled ? "left-[22px]" : "left-0.5",
                            ].join(" ")}
                          />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#1A1B23]/10 bg-[#F8FAFC] px-6 py-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { rejectAll(); onClose() }}
                  className="rounded-xl border border-[#5D3FD3]/20 bg-white px-4 py-2.5 text-[12.5px] font-semibold text-[#5D3FD3] transition hover:bg-[#EDE9FB]"
                >
                  {t("cookies.rejectAll")}
                </button>
                <button
                  type="button"
                  onClick={() => { acceptAll(); onClose() }}
                  className="rounded-xl border border-[#5D3FD3]/20 bg-white px-4 py-2.5 text-[12.5px] font-semibold text-[#5D3FD3] transition hover:bg-[#EDE9FB]"
                >
                  {t("cookies.acceptAll")}
                </button>
              </div>
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center gap-2 rounded-xl bg-[#5D3FD3] px-5 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_8px_22px_rgba(93,63,211,0.25)] transition hover:bg-[#4A2EAB]"
              >
                <Check className="h-4 w-4" /> {t("cookies.savePrefs2")}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ── Banner ─────────────────────────────────────────────────────────────── */
export default function CookieBanner() {
  const { t } = useTranslation("common")
  const { decided, acceptAll, rejectAll } = useCookieConsent()
  const [prefsOpen, setPrefsOpen] = useState(false)

  // Once the user has decided, the banner stays hidden until consent is reset
  // (e.g. via the "Cookie preferences" link in the footer or a policy bump).
  if (decided && !prefsOpen) return <PreferencesModal open={false} onClose={() => setPrefsOpen(false)} />

  return (
    <>
      <AnimatePresence>
        {!decided && (
          <motion.aside
            role="dialog"
            aria-modal="false"
            aria-label={t("cookies.consentAria")}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-3 bottom-3 z-[110] sm:inset-x-6 sm:bottom-6"
          >
            <div className="mx-auto flex max-w-5xl flex-col gap-4 rounded-2xl border border-[#1A1B23]/12 bg-white/95 p-5 shadow-[0_30px_80px_rgba(93,63,211,0.18)] backdrop-blur-md sm:flex-row sm:items-center sm:gap-6 sm:p-6">
              <div className="flex shrink-0 items-start gap-3 sm:items-center">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EDE9FB] text-[#5D3FD3]">
                  <Cookie className="h-5 w-5" />
                </div>
                <div className="sm:hidden">
                  <h2 className="text-[15px] font-bold text-[#5D3FD3]">{t("cookies.bannerTitle")}</h2>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h2 className="hidden text-[15px] font-bold text-[#5D3FD3] sm:block">{t("cookies.yourPrivacy")}</h2>
                <p className="mt-1 text-[12.5px] leading-5 text-[#1A1B23]/80 sm:text-[13px]">
                  {t("cookies.shortBody")}<Link to="/cookies" className="font-semibold text-[#5D3FD3] underline-offset-2 hover:underline">
                    {t("cookies.policyLink")}
                  </Link>{" "}
                  or adjust preferences any time.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <button
                  type="button"
                  onClick={() => setPrefsOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#5D3FD3]/20 bg-white px-4 py-2.5 text-[12.5px] font-semibold text-[#5D3FD3] transition hover:bg-[#EDE9FB]"
                >
                  <Settings className="h-4 w-4" /> Manage
                </button>
                <button
                  type="button"
                  onClick={rejectAll}
                  className="inline-flex items-center justify-center rounded-xl border border-[#5D3FD3]/20 bg-white px-4 py-2.5 text-[12.5px] font-semibold text-[#5D3FD3] transition hover:bg-[#EDE9FB]"
                >
                  {t("cookies.rejectAll")}
                </button>
                <button
                  type="button"
                  onClick={acceptAll}
                  className="inline-flex items-center justify-center rounded-xl bg-[#5D3FD3] px-5 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_8px_22px_rgba(93,63,211,0.25)] transition hover:bg-[#4A2EAB]"
                >
                  {t("cookies.acceptAll")}
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <PreferencesModal open={prefsOpen} onClose={() => setPrefsOpen(false)} />
    </>
  )
}
