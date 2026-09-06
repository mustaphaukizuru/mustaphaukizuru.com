import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Globe, ChevronDown, Check } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
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

  // I18N01/PERF · the target language's translations are a lazily-imported
  // chunk. Await setLang (which awaits the bundle) BEFORE navigating, so the
  // route change never paints a frame of raw translation keys.
  const switchTo = async (next) => {
    if (next === lang) return;
    try {
      await setLang(next);
    } catch {
      // Locale chunk failed to load — stay put rather than navigating into
      // an untranslated page.
      return;
    }
    const target = pathWithLanguage(location.pathname, next) +
                   (location.search || "") + (location.hash || "");
    navigate(target, { replace: false });
  };

  // Dropdown open state + close-on-outside-click / Escape (used by the
  // "dropdown" variant only; harmless no-op for the others).
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (variant === "dropdown") {
    const LANGS = [
      { code: "en", label: "EN", name: t("language.english"), Flag: FlagEN },
      { code: "es", label: "ES", name: t("language.spanish"), Flag: FlagMX },
    ];
    const current = LANGS.find((l) => l.code === lang) || LANGS[0];
    return (
      <div ref={ref} className={"relative " + className}>
        <button type="button" onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox" aria-expanded={open} aria-label={t("language.ariaSelector")}
          className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12.5px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 " + (isDark ? "text-white/80 hover:bg-white/10" : "text-charcoal-80/70 hover:bg-violet/8 hover:text-violet")}>
          <Globe className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          {current.label}
          <ChevronDown className={"h-3.5 w-3.5 transition-transform " + (open ? "rotate-180" : "")} aria-hidden="true" />
        </button>
        {/* Animated open/close. The panel used to appear and vanish with no
            transition at all, which reads as a glitch next to the rest of
            the site's motion. Slide-down + fade from the top-right origin,
            collapsed to an instant swap under prefers-reduced-motion. */}
        <AnimatePresence>
        {open && (
          <m.div role="listbox" aria-label={t("language.ariaSelector")}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: reduce ? 0.08 : 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full z-50 mt-2 w-40 origin-top-right overflow-hidden rounded-xl border border-charcoal-80/10 bg-white p-1 shadow-[0_12px_36px_rgb(var(--color-violet-rgb)/0.16)]">
            {LANGS.map(({ code, name, Flag }) => (
              <button key={code} type="button" role="option" aria-selected={lang === code}
                onClick={() => { switchTo(code); setOpen(false); }}
                className={"flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 " + (lang === code ? "bg-violet-pale text-violet" : "text-charcoal/80 hover:bg-violet-pale/50")}>
                <Flag className="h-3.5 w-[21px]" />
                <span className="flex-1 text-left">{name}</span>
                {lang === code ? <Check className="h-4 w-4 text-violet" aria-hidden="true" /> : null}
              </button>
            ))}
          </m.div>
        )}
        </AnimatePresence>
      </div>
    );
  }

  if (variant === "text") {
    const activeClass = isDark ? "text-terracotta" : "text-violet";
    // D4-2 · was `text-charcoal/55`, which composites to #818286 on white:
    // 3.83:1 at 12px, so axe flags it wherever this variant sits on a light
    // ground — the footer, the mobile menu, and now the dashboard header.
    // /70 measures 6.34:1 and is still visibly the unselected half next to
    // the violet active state. The dark tone is left alone: white/65 on
    // charcoal-deep is 8.35:1, and the only dark call site is the footer.
    const inactiveClass = isDark ? "text-white/65 hover:text-white" : "text-charcoal/70 hover:text-violet";
    const dotClass = isDark ? "text-white/35" : "text-charcoal/30";
    return (
      <div role="group" aria-label={t("language.ariaSelector")} className={"inline-flex items-center gap-1.5 text-[12px] " + className}>
        <button type="button" onClick={() => switchTo("en")} aria-pressed={lang === "en"}
          aria-label={t("language.switchToCode", { code: "EN", lang: t("language.english") })}
          className={"inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-semibold transition " + (lang === "en" ? activeClass : inactiveClass)}>
          <FlagEN className="h-3 w-[18px]" />EN
        </button>
        <span className={dotClass}>|</span>
        <button type="button" onClick={() => switchTo("es")} aria-pressed={lang === "es"}
          aria-label={t("language.switchToCode", { code: "ES", lang: t("language.spanish") })}
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
        aria-label={t("language.switchToCode", { code: "EN", lang: t("language.english") })}
        className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 " + (lang === "en" ? "bg-violet text-white shadow-[0_2px_6px_rgb(var(--color-violet-rgb)/0.18)]" : "text-charcoal/70 hover:bg-violet-pale hover:text-violet")}>
        <FlagEN className="h-3 w-[18px]" />EN
      </button>
      <button type="button" onClick={() => switchTo("es")} aria-pressed={lang === "es"}
        aria-label={t("language.switchToCode", { code: "ES", lang: t("language.spanish") })}
        className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/40 " + (lang === "es" ? "bg-violet text-white shadow-sm" : "text-charcoal/70 hover:text-violet")}>
        <FlagMX className="h-3 w-[18px]" />ES
      </button>
    </div>
  );
}
