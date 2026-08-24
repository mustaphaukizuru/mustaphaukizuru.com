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

const LAST_UPDATED = "May 2026"

/* Stable slugs for /cookies#analytics-cookies deep-linking. Matches the
 * pattern shared with PrivacyPage and TermsPage across the legal trio. */
const sections = [
  {
    slug: "what-cookies-are",
    title: "1. What cookies are",
    content: "Cookies are small text files placed on your device by websites you visit. We also use related technologies, including local storage, session storage, and pixel tags, under the same name in this policy. They allow the platform to remember information about your visit such as authentication, language, and cart contents.",
  },
  {
    slug: "how-we-use-cookies",
    title: "2. How we use cookies",
    content: "mustaphaukizuru.com uses cookies for four purposes: keeping you signed in, remembering your preferences, measuring how the platform performs, and understanding which content and campaigns are reaching the right audiences. We do not sell personal information.",
  },
  {
    slug: "strictly-necessary-cookies",
    title: "3. Strictly necessary cookies",
    content: "These cookies enable core functions: authentication, account session continuity, cart and checkout integrity, CSRF protection, and load-balancing. The platform cannot function without them, so they are always on. Examples: auth-token, session, mu_cookie_consent_v1.",
  },
  {
    slug: "functional-cookies",
    title: "4. Functional cookies",
    content: "These remember non-essential preferences across visits, including language, time zone, theme, saved filters, and consent decisions. You can disable these and the site will still work; you will simply need to set those preferences again on each visit.",
  },
  {
    slug: "analytics-cookies",
    title: "5. Analytics cookies",
    content: "Anonymous, aggregate usage measurement so we know which pages load slowly, which CTAs convert, and where visitors drop off. IP addresses are pseudonymised, retention is capped at 26 months, and we never resell this data. You can opt out and the platform will continue to function normally.",
  },
  {
    slug: "marketing-cookies",
    title: "6. Marketing cookies",
    content: "Used to measure the performance of campaigns on LinkedIn, Meta, Google, X, and similar platforms, and to tailor recommendations. You can disable these completely; you may then see less relevant advertising elsewhere on the web, but nothing on this site changes.",
  },
  {
    slug: "third-party-services",
    title: "7. Third-party services",
    content: "Some pages embed services that may set their own cookies, including payment processors (Mercado Pago, PayPal), Google Sign-In, and embedded media. These services are governed by their own privacy and cookie policies; we link to them where relevant.",
  },
  {
    slug: "your-choices",
    title: "8. Your choices",
    content: "When you first visit the site we ask you to accept all, reject optional cookies, or fine-tune by category. You can change your decision any time using the 'Cookie preferences' link in the footer. Resetting will re-show the consent banner so you can choose again.",
  },
  {
    slug: "browser-controls",
    title: "9. Browser controls",
    content: "Most browsers let you block or delete cookies via Settings → Privacy. Doing so site-wide may break parts of this and other sites. We honour the Global Privacy Control (GPC) signal where it is sent; it is treated as an explicit reject-all for optional categories.",
  },
  {
    slug: "updates-to-this-policy",
    title: "10. Updates to this policy",
    content: "When we materially change how we use cookies, for example by adding a new analytics partner, we increment the policy version (CONSENT_VERSION) which triggers the consent banner again so you can review and re-consent. The 'Last updated' date above always reflects the most recent revision.",
  },
  {
    slug: "contact",
    title: "11. Contact",
    content: "For cookie or privacy questions, write to hello@mustaphaukizuru.com. We respond to verifiable requests under the GDPR, ePrivacy Directive, and Mexico's Federal Law on the Protection of Personal Data Held by Private Parties (LFPDPPP) within 30 days.",
  },
]

const ICONS = {
  necessary: ShieldCheck,
  functional: Settings2,
  analytics: BarChart3,
  marketing: Megaphone,
}

export default function CookiePolicyPage() {
  const { t } = useTranslation("legal")
  const { reset, decided, timestamp } = useCookieConsent()

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
            <Calendar className="h-3.5 w-3.5" /> Last updated: {LAST_UPDATED}
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
                className="flex items-start gap-3 rounded-xl border border-charcoal/10 bg-white p-4 shadow-[0_2px_10px_rgb(var(--color-violet-rgb)/0.04)]"
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
        <div className="mb-8 flex flex-col items-start gap-4 rounded-xl border border-violet/15 bg-white p-5 shadow-[0_4px_16px_rgb(var(--color-violet-rgb)/0.04)] sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-violet">{t("cookies.changePrefs")}</h2>
            <p className="mt-1 text-[12.5px] leading-5 text-charcoal/70">
              {decided
                ? `Your current consent was recorded${timestamp ? ` on ${new Date(timestamp).toLocaleDateString()}` : ""}.`
                : "You have not made a choice yet; the consent banner will be shown shortly."}
              {" "}{t("cookies.resetClick")}
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl bg-violet px-5 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_8px_22px_rgb(var(--color-violet-rgb)/0.25)] transition hover:bg-violet-deep"
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
          aria-label={t("cookies.tocAria", { defaultValue: "Table of contents" })}
          className="mb-8 rounded-xl border border-charcoal/10 bg-white p-5 shadow-[0_2px_10px_rgb(var(--color-violet-rgb)/0.04)]"
        >
          <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-charcoal-80/65">
            {t("cookies.tocLabel", { defaultValue: "On this page" })}
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
              className="scroll-mt-24 rounded-xl border border-charcoal/10 bg-white p-6 shadow-[0_2px_10px_rgb(var(--color-violet-rgb)/0.04)]"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
            >
              <h2 className="group mb-3 flex items-center gap-2 text-[15px] font-bold text-violet">
                <a
                  href={`#${slug}`}
                  aria-label={t("cookies.anchorAria", { defaultValue: "Direct link to" }) + " " + title}
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
  // TODO: file was truncated by an OneDrive sync issue; verify the JSX above
  // matches the pre-corruption design (top-level <div className="bg-mist">).
}
