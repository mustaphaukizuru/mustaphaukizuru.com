import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../i18n/hooks/useLanguage";
import { pathWithLanguage } from "../i18n/utils/pathWithLanguage";

// LanguageSwitcher v5 - segmented EN/ES toggle with brand-aligned flags.
// EN uses Union Jack (UK / English language flag - the convention for
// language flags is country-of-origin, and English originates from England).
// ES uses Mexican flag (LATAM market via MercadoPago, Mexican Spanish register).
// Three variants: default (navbar pill), text (footer compact), icon (mobile).

function FlagEN({ className = "h-3 w-[18px]" }) {
  return (
    <svg viewBox="0 0 60 30" xmlns="http://www.w3.org/2000/svg"
      className={"shrink-0 rounded-[2px] shadow-[0_0_0_0.5px_rgba(0,0,0,0.08)] " + className}
      aria-hidden="true">
      {/* Blue background */}
      <rect width="60" height="30" fill="#012169" />
      {/* White saltire (St Andrew's Cross + St Patrick's Cross background) */}
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#FFFFFF" strokeWidth="6" />
      {/* Red saltire (St Patrick's Cross) - simplified centered version */}
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="2" />
      {/* White St George's Cross background */}
      <path d="M30,0 V30 M0,15 H60" stroke="#FFFFFF" strokeWidth="10" />
      {/* Red St George's Cross */}
      <path d="M30,0 V30 M0,15 H60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}

function FlagMX({ className = "h-3 w-[18px]" }) {
  return (
    <svg viewBox="0 0 21 12" xmlns="http://www.w3.org/2000/svg"
      className={"shrink-0 rounded-[2px] shadow-[0_0_0_0.5px_rgba(0,0,0,0.08)] " + className}
      aria-hidden="true">
      <rect width="7" height="12" x="0" fill="#006847" />
      <rect width="7" height="12" x="7" fill="#FFFFFF" />
      <rect width="7" height="12" x="14" fill="#CE1126" />
      <circle cx="10.5" cy="6" r="1.6" fill="#8C6135" />
      <circle cx="10.5" cy="6" r="1.0" fill="#A4D65E" opacity="0.9" />
    </svg>
  );
}

export default function LanguageSwitcher({ variant = "default", tone = "light", className = "" }) {
  const { lang, setLang } = useLanguage();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isDark = tone === "dark";

  const switchTo = (next) => {
    if (next === lang) return;
    setLang(next);
    const target = pathWithLanguage(location.pathname, next) +
                   (location.search || "") + (location.hash || "");
    navigate(target, { replace: false });
  };

  if (variant === "text") {
    const activeClass = isDark ? "text-terracotta" : "text-violet";
    const inactiveClass = isDark ? "text-white/65 hover:text-white" : "text-charcoal/55 hover:text-violet";
    const dotClass = isDark ? "text-white/35" : "text-charcoal/30";
    return (
      <div role="group" aria-label={t("language.ariaSelector")} className={"inline-flex items-center gap-1.5 text-[12px] " + className}>
        <button type="button" onClick={() => switchTo("en")} aria-pressed={lang === "en"}
          aria-label={t("language.switchTo", { lang: t("language.english") })}
          className={"inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-semibold transition " + (lang === "en" ? activeClass : inactiveClass)}>
          <FlagEN className="h-3 w-[18px]" />EN
        </button>
        <span className={dotClass}>|</span>
        <button type="button" onClick={() => switchTo("es")} aria-pressed={lang === "es"}
          aria-label={t("language.switchTo", { lang: t("language.spanish") })}
          className={"inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-semibold transition " + (lang === "es" ? activeClass : inactiveClass)}>
          <FlagMX className="h-3 w-[18px]" />ES
        </button>
      </div>
    );
  }

  if (variant === "icon") {
    return (
      <div role="group" aria-label={t("language.ariaSelector")} className={"inline-flex items-center gap-1 " + className}>
        <button type="button" onClick={() => switchTo("en")} aria-pressed={lang === "en"}
          aria-label={t("language.switchTo", { lang: t("language.english") })}
          className={"inline-flex items-center justify-center rounded-md p-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 " + (lang === "en" ? "ring-2 ring-violet/60" : "opacity-55 hover:opacity-100")}>
          <FlagEN className="h-4 w-6" />
        </button>
        <button type="button" onClick={() => switchTo("es")} aria-pressed={lang === "es"}
          aria-label={t("language.switchTo", { lang: t("language.spanish") })}
          className={"inline-flex items-center justify-center rounded-md p-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 " + (lang === "es" ? "ring-2 ring-violet/60" : "opacity-55 hover:opacity-100")}>
          <FlagMX className="h-4 w-6" />
        </button>
      </div>
    );
  }

  return (
    <div role="group" aria-label={t("language.ariaSelector")}
      className={"inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-white p-0.5 " + className}>
      <button type="button" onClick={() => switchTo("en")} aria-pressed={lang === "en"}
        aria-label={t("language.switchTo", { lang: t("language.english") })}
        className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 " + (lang === "en" ? "bg-violet text-white shadow-[0_2px_6px_rgba(93,63,211,0.18)]" : "text-charcoal/70 hover:bg-violet-pale hover:text-violet")}>
        <FlagEN className="h-3 w-[18px]" />EN
      </button>
      <button type="button" onClick={() => switchTo("es")} aria-pressed={lang === "es"}
        aria-label={t("language.switchTo", { lang: t("language.spanish") })}
        className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 " + (lang === "es" ? "bg-violet text-white shadow-sm" : "text-charcoal/70 hover:text-violet")}>
        <FlagMX className="h-3 w-[18px]" />ES
      </button>
    </div>
  );
}
