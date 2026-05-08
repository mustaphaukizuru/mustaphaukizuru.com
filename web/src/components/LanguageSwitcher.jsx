import { useNavigate, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useLanguage } from "../i18n/hooks/useLanguage"
import { pathWithLanguage } from "../i18n/utils/pathWithLanguage"

/**
 * LanguageSwitcher · I18N02
 *
 * Segmented EN/ES toggle. Brand v3.0 styling — Royal Violet active state
 * on Cloud Mist canvas, slate-200 outer pill border. Two display variants:
 *
 *   <LanguageSwitcher />              // default · navbar pill
 *   <LanguageSwitcher variant="text" /> // footer · compact text-only
 *   <LanguageSwitcher variant="icon" /> // mobile · just EN/ES badges
 *
 * Behaviour: clicking the inactive language updates i18n + localStorage,
 * then navigates to the equivalent URL in the target language (e.g.
 * /about → /es/about). Replace=false so users can hit the back button to
 * return to the previous language.
 */
export default function LanguageSwitcher({ variant = "default", tone = "light", className = "" }) {
  const { lang, setLang } = useLanguage()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const isDark = tone === "dark"

  const switchTo = (next) => {
    if (next === lang) return
    setLang(next)
    const target = pathWithLanguage(location.pathname, next) +
                   (location.search || "") + (location.hash || "")
    navigate(target, { replace: false })
  }

  if (variant === "text") {
    const activeClass = isDark ? "text-terracotta" : "text-violet"
    const inactiveClass = isDark
      ? "text-white/65 hover:text-white"
      : "text-charcoal/55 hover:text-violet"
    const dotClass = isDark ? "text-white/35" : "text-charcoal/30"
    return (
      <div role="group" aria-label={t("language.ariaSelector")}
           className={`inline-flex items-center gap-1.5 text-[12px] ${className}`}>
        <button
          type="button"
          onClick={() => switchTo("en")}
          aria-pressed={lang === "en"}
          className={`rounded px-1.5 py-0.5 font-semibold transition ${
            lang === "en" ? activeClass : inactiveClass
          }`}
        >EN</button>
        <span className={dotClass}>|</span>
        <button
          type="button"
          onClick={() => switchTo("es")}
          aria-pressed={lang === "es"}
          className={`rounded px-1.5 py-0.5 font-semibold transition ${
            lang === "es" ? activeClass : inactiveClass
          }`}
        >ES</button>
      </div>
    )
  }

  // Default · segmented pill
  return (
    <div
      role="group"
      aria-label={t("language.ariaSelector")}
      className={`inline-flex items-center gap-0.5 rounded-full border border-[#DCDCE4] bg-white p-0.5 ${className}`}
    >
      <button
        type="button"
        onClick={() => switchTo("en")}
        aria-pressed={lang === "en"}
        aria-label={t("language.switchTo", { lang: t("language.english") })}
        className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 ${
          lang === "en"
            ? "bg-violet text-white shadow-[0_2px_6px_rgba(93,63,211,0.18)]"
            : "text-charcoal/70 hover:bg-[#EDE9FB] hover:text-violet"
        }`}
      >EN</button>
      <button
        type="button"
        onClick={() => switchTo("es")}
        aria-pressed={lang === "es"}
        aria-label={t("language.switchTo", { lang: t("language.spanish") })}
        className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 ${
          lang === "es"
            ? "bg-violet text-white shadow-sm"
            : "text-charcoal/70 hover:text-violet"
        }`}
      >ES</button>
    </div>
  )
}
