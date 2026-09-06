/* ════════════════════════════════════════════════════════════════════════
   CookieBanner.jsx · GDPR-compliant cookie consent banner
   ────────────────────────────────────────────────────────────────────────
   Renders only when the user has not yet decided. Provides three explicit
   actions: {t("cookies.acceptAll")}, {t("cookies.rejectAll")}, Manage preferences (granular). Uses
   Framer Motion for the entrance/exit and brand tokens (var(--color-violet) / var(--color-charcoal))
   for visual consistency with the rest of the site.

   Accessibility:
     · Banner is a non-modal role="region" (labelled) — it must not claim
       to be a dialog since it never traps focus or blocks the page.
     · The preferences panel is the canonical <Modal> (focus trap, Escape,
       scroll lock, reduced-motion aware).
     · Each control is a real <button> with discernible label
     · Visible at 14px+ and meets WCAG AA contrast on the dark surface

   Placement: mount once at the root of the app (App.jsx).
   ════════════════════════════════════════════════════════════════════════ */

import { useState } from "react"
import { LocalizedLink as Link } from "../LocalizedLink"
import { m, AnimatePresence } from "framer-motion"
import { Cookie, ShieldCheck, Settings, Check, X } from "lucide-react"
import { useCookieConsent, COOKIE_CATEGORIES } from "../../context/CookieConsentContext"
import { useTranslation } from "react-i18next"
import { Modal } from "../ui/Modal"

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
    <Modal
      open={open}
      onClose={onClose}
      bare
      hideClose
      ariaLabelledBy="cookie-prefs-title"
      placement="middle"
      size="none"
      zIndex={120}
      wrapperClassName="p-4"
      backdropClassName="bg-black/50 backdrop-blur-sm"
      className="max-w-2xl overflow-hidden rounded-2xl border border-charcoal/15 bg-white shadow-[0_30px_80px_rgb(var(--color-violet-rgb)/0.25)]"
    >
            <div className="flex items-start justify-between gap-4 border-b border-charcoal/10 px-6 py-5">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-violet-pale px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet">
                  <Cookie className="h-3 w-3" /> {t("cookies.title")}
                </div>
                <h2 id="cookie-prefs-title" className="mt-2 text-[20px] font-bold text-violet">
                  {t("cookies.subtitle")}
                </h2>
                <p className="mt-1 text-[12.5px] leading-5 text-charcoal/75">
                  {t("cookies.toggleNote")}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("cookies.closeAria")}
                className="cursor-pointer -mt-1 -mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-charcoal/65 transition hover:bg-violet-ghost hover:text-violet"
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
                      className="rounded-xl border border-charcoal/12 bg-mist p-4 transition hover:border-violet/20"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-[14px] font-bold text-violet">{cat.title}</h3>
                            {cat.locked && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-mint-100 px-2 py-0.5 text-[10px] font-semibold text-mint-800">
                                <ShieldCheck className="h-2.5 w-2.5" /> {t("cookies.alwaysOn")}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[12px] leading-5 text-charcoal/75">{cat.description}</p>
                          <p className="mt-1.5 font-mono text-[10.5px] text-charcoal/65">
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
                            enabled ? "bg-violet" : "bg-charcoal/25",
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

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-charcoal/10 bg-mist px-6 py-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { rejectAll(); onClose() }}
                  className="cursor-pointer rounded-xl border border-violet/20 bg-white px-4 py-2.5 text-[12.5px] font-semibold text-violet transition hover:bg-violet-pale"
                >
                  {t("cookies.rejectAll")}
                </button>
                <button
                  type="button"
                  onClick={() => { acceptAll(); onClose() }}
                  className="cursor-pointer rounded-xl border border-violet/20 bg-white px-4 py-2.5 text-[12.5px] font-semibold text-violet transition hover:bg-violet-pale"
                >
                  {t("cookies.acceptAll")}
                </button>
              </div>
              <button
                type="button"
                onClick={handleSave}
                className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-violet px-5 py-2.5 text-[12.5px] font-semibold text-white shadow-[var(--shadow-lift-2)] transition hover:bg-violet-deep"
              >
                <Check className="h-4 w-4" /> {t("cookies.savePrefs2")}
              </button>
            </div>
    </Modal>
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
          <m.aside
            role="region"
            aria-label={t("cookies.consentAria")}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-3 bottom-3 z-[110] sm:inset-x-6 sm:bottom-6"
          >
            <div className="mx-auto flex max-w-5xl flex-col gap-4 rounded-2xl border border-charcoal/12 bg-white/95 p-5 shadow-[0_30px_80px_rgb(var(--color-violet-rgb)/0.18)] backdrop-blur-md sm:flex-row sm:items-center sm:gap-6 sm:p-6">
              <div className="flex shrink-0 items-start gap-3 sm:items-center">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-pale text-violet">
                  <Cookie className="h-5 w-5" />
                </div>
                <div className="sm:hidden">
                  <h2 className="text-[15px] font-bold text-violet">{t("cookies.bannerTitle")}</h2>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h2 className="hidden text-[15px] font-bold text-violet sm:block">{t("cookies.yourPrivacy")}</h2>
                <p className="mt-1 text-[12.5px] leading-5 text-charcoal/80 sm:text-[13px]">
                  {t("cookies.shortBody")}<Link to="/cookies" className="cursor-pointer font-semibold text-violet underline-offset-2 hover:underline">
                    {t("cookies.policyLink")}
                  </Link>{" "}
                  {" "}{t("cookies.orAdjust")}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <button
                  type="button"
                  onClick={() => setPrefsOpen(true)}
                  className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-violet/20 bg-white px-4 py-2.5 text-[12.5px] font-semibold text-violet transition hover:bg-violet-pale"
                >
                  <Settings className="h-4 w-4" /> {t("cookies.manage")}
                </button>
                <button
                  type="button"
                  onClick={rejectAll}
                  className="cursor-pointer inline-flex items-center justify-center rounded-xl border border-violet/20 bg-white px-4 py-2.5 text-[12.5px] font-semibold text-violet transition hover:bg-violet-pale"
                >
                  {t("cookies.rejectAll")}
                </button>
                <button
                  type="button"
                  onClick={acceptAll}
                  className="cursor-pointer inline-flex items-center justify-center rounded-xl bg-violet px-5 py-2.5 text-[12.5px] font-semibold text-white shadow-[var(--shadow-lift-2)] transition hover:bg-violet-deep"
                >
                  {t("cookies.acceptAll")}
                </button>
              </div>
            </div>
          </m.aside>
        )}
      </AnimatePresence>

      <PreferencesModal open={prefsOpen} onClose={() => setPrefsOpen(false)} />
    </>
  )
}
