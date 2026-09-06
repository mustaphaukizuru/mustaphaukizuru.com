/* ════════════════════════════════════════════════════════════════════════
   AuthShell.jsx · v2 · marketing-rail right hero
   ────────────────────────────────────────────────────────────────────────
   Cusana-inspired split-screen layout used by all four auth pages.
   v2 swaps the financial dashboard mock for a brand marketing panel
   (avatar, value props, testimonial, CTA).

   Layout:
     ┌─────────────────────────────┬───────────────────────────────────────┐
     │  <children>                 │  <MarketingPanel />                   │
     │  page-specific form         │  brand value-props + testimonial      │
     └─────────────────────────────┴───────────────────────────────────────┘

   Hero copy is no longer a prop — the marketing panel is brand-fixed,
   matching the polished feel Mustapha asked for.
   ════════════════════════════════════════════════════════════════════════ */

import { LocalizedLink as Link } from "../LocalizedLink"
import { m, useReducedMotion } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import MarketingPanel from "./MarketingPanel"
import LanguageSwitcher from "../LanguageSwitcher"

import { useTranslation } from "react-i18next"
export default function AuthShell({ children }) {
  const { t } = useTranslation("common")
  const reduce = useReducedMotion()

  return (
    <div className="relative min-h-screen w-full bg-white">
      {/* Skip link for keyboard users · WCAG 2.1 AA */}
      <a
        href="#auth-form"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-charcoal focus:px-4 focus:py-2 focus:text-meta focus:font-semibold focus:text-white"
      >
        {t("auth.shell.skipToForm")}
      </a>

      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.02fr_1fr]">
        {/* ── LEFT · Form panel ─────────────────────────────────────── */}
        <main
          id="auth-form"
          className="relative flex flex-col px-5 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-12"
        >
          <Link
            to="/"
            className="group inline-flex w-fit items-center gap-2 rounded-md text-[12.5px] font-semibold text-charcoal-80/65 transition hover:text-violet focus:outline-none focus-visible:ring-2 focus-visible:ring-azure/40"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            {t("auth.shell.backHome")}
          </Link>

          <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center py-8 sm:py-10">
            {children}
          </div>

          {/* Footer · privacy + © + language switcher */}
          <footer className="mt-6 flex flex-col items-center justify-between gap-2 text-[11.5px] text-charcoal-80/65 sm:flex-row">
            <span>© {new Date().getFullYear()} {t("auth.shell.rights")}</span>
            <nav className="flex items-center gap-5">
              <Link to="/privacy" className="transition hover:text-violet">{t("auth.shell.privacy")}</Link>
              <span aria-hidden="true" className="h-1 w-1 rounded-full bg-charcoal-80/30" />
              <Link to="/terms" className="transition hover:text-violet">{t("auth.shell.terms")}</Link>
              <span aria-hidden="true" className="h-1 w-1 rounded-full bg-charcoal-80/30" />
              <LanguageSwitcher variant="text" />
            </nav>
          </footer>
        </main>

        {/* ── RIGHT · Dark hero with marketing content ──────────────── */}
        <aside
          aria-label={t("auth.shell.aboutAria")}
          className="relative hidden overflow-hidden bg-[var(--color-charcoal-deep)] lg:flex lg:flex-col"
        >
          {/* Ambient brand-tinted glows */}
          <m.div
            aria-hidden="true"
            animate={
              reduce
                ? undefined
                : { x: [0, 30, -10, 0], y: [0, -20, 12, 0], scale: [1, 1.08, 0.95, 1] }
            }
            transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
            className="pointer-events-none absolute -right-32 -top-24 h-[26rem] w-[26rem] rounded-full bg-violet/25 blur-3xl"
          />
          <m.div
            aria-hidden="true"
            animate={
              reduce
                ? undefined
                : { x: [0, -22, 14, 0], y: [0, 18, -10, 0], scale: [1, 0.95, 1.1, 1] }
            }
            transition={{ duration: 26, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="pointer-events-none absolute -bottom-24 -left-12 h-72 w-72 rounded-full bg-terracotta/15 blur-3xl"
          />

          {/* Faint dot grid texture */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)",
              backgroundSize: "26px 26px",
            }}
          />

          {/* Marketing content */}
          <div className="relative h-full p-10 xl:p-14">
            <MarketingPanel reduce={reduce} />
          </div>
        </aside>
      </div>
    </div>
  )
}
