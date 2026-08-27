/* ════════════════════════════════════════════════════════════════════════
   CookiePolicyPage.jsx · Plain-language cookie policy
   ────────────────────────────────────────────────────────────────────────
   Layout intentionally mirrors PrivacyPage.jsx (same hero, same card grid)
   for visual consistency across the legal cluster.
   ════════════════════════════════════════════════════════════════════════ */

import { m } from "framer-motion"
import { useTranslation } from "react-i18next"
import { Cookie, Calendar, Mail, Settings2, ShieldCheck, BarChart3, Megaphone, Link as LinkIcon } from "lucide-react"
import { useCookieConsent, COOKIE_CATEGORIES } from "../context/CookieConsentContext"

/* Section bodies live in i18n (legal.json → cookies.sections[]) so en/es
 * stay in lockstep. Stable slugs for /cookies#analytics-cookies deep-linking
 * match the pattern shared with PrivacyPage and TermsPage. */

const ICONS = {
  necessary: ShieldCheck,
  functional: Settings2,
  analytics: BarChart3,
  marketing: Megaphone,
}

export default function CookiePolicyPage() {
  const { t } = useTranslation("legal")
  const { reset, decided, timestamp } = useCookieConsent()
  const raw = t("cookies.sections", { returnObjects: true })
  const sections = Array.isArray(raw) ? raw : []

  return (
    <div className="bg-mist">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="bg-[var(--color-charcoal-light)] py-16 text-center">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 text-terracotta">
            <Cookie className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-[2.2rem] font-bold text-white">{t("cookies.title", "Cookie Policy")}</h1>
          <p className="mt-3 text-[15px] text-white/55">
            {t("cookies.subtitle")}
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-[12px] text-white/50">
            <Calendar className="h-3.5 w-3.5" /> {t("cookies.lastUpdated")}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        {/* ── Category snapshot ──────────────────────────────────────────── */}
        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {COOKIE_CATEGORIES.map((cat) => {
            const Icon = ICONS[cat.key] || Cookie
            return (
              <div
                key={cat.key}
                className="flex items-start gap-3 rounded-xl border border-charcoal/10 bg-white p-4 shadow-[var(--shadow-e2)]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-pale text-violet">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[13.5px] font-bold text-violet">{cat.title}</h3>
                    {cat.locked && (
                      <span className="rounded-full bg-mint-100 px-2 py-0.5 text-[9.5px] font-semibold text-mint-800">
                        {t("cookies.alwaysOn")}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[12px] leading-5 text-charcoal/70">{cat.description}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Manage preferences callout ──────────────────────────────────── */}
        <div className="mb-8 flex flex-col items-start gap-4 rounded-xl border border-violet/15 bg-white p-5 shadow-[var(--shadow-e3)] sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-violet">{t("cookies.changePrefs")}</h2>
            <p className="mt-1 text-[12.5px] leading-5 text-charcoal/70">
              {decided
                ? t("cookies.consentRecorded", { when: timestamp ? t("cookies.consentOn", { date: new Date(timestamp).toLocaleDateString() }) : "" })
                : t("cookies.noChoiceYet")}
              {" "}{t("cookies.resetClick")}
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl bg-violet px-5 py-2.5 text-[12.5px] font-semibold text-white shadow-[var(--shadow-lift-2)] transition hover:bg-violet-deep"
          >
            <Settings2 className="h-4 w-4" /> {t("cookies.managePrefs")}
          </button>
        </div>

        {/* ── Table of contents ──────────────────────────────────────────
            Matches PrivacyPage + TermsPage for visual consistency across
            the legal trio. Shareable jump-links via the slugs on each
            section. The cookie policy has 11 sections so a 2-col grid
            on sm+ keeps the TOC tight without scrolling. */}
        <nav
          aria-label={t("cookies.tocAria")}
          className="mb-8 rounded-xl border border-charcoal/10 bg-white p-5 shadow-[var(--shadow-e2)]"
        >
          <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-charcoal-80/65">
            {t("cookies.tocLabel")}
          </p>
          <ol className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {sections.map(({ slug, title }) => (
              <li key={slug}>
                <a
                  href={`#${slug}`}
                  className="block rounded-md px-2 py-1 text-[13px] text-charcoal-80/75 transition hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
                >
                  {title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* ── Sections ───────────────────────────────────────────────────── */}
        <article className="flex flex-col gap-4">
          {sections.map(({ slug, title, content }, i) => (
            <m.section
              key={slug}
              id={slug}
              className="scroll-mt-24 rounded-xl border border-charcoal/10 bg-white p-6 shadow-[var(--shadow-e2)]"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
            >
              <h2 className="group mb-3 flex items-center gap-2 text-[15px] font-bold text-violet">
                <a
                  href={`#${slug}`}
                  aria-label={`${t("cookies.anchorAria")} ${title}`}
                  className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
                >
                  <span>{title}</span>
                  <LinkIcon
                    aria-hidden="true"
                    className="h-3.5 w-3.5 text-violet/0 transition group-hover:text-violet/60"
                  />
                </a>
              </h2>
              <p className="text-[14px] leading-7 text-charcoal/75">{content}</p>
            </m.section>
          ))}
        </article>

        {/* ── Contact strip ──────────────────────────────────────────────── */}
        <div className="mt-8 flex items-center gap-4 rounded-xl bg-[var(--color-charcoal-light)] p-6 text-white">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <div className="font-semibold">{t("cookies.questions")}</div>
            <a
              href="mailto:hello@mustaphaukizuru.com"
              className="mt-1 text-[13px] text-white/60 hover:text-white hover:underline"
            >
              hello@mustaphaukizuru.com
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
