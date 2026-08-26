import { useEffect } from "react"
import { m } from "framer-motion"
import { Trans, useTranslation } from "react-i18next"
import { Link, useLocation } from "react-router-dom"
import { Shield, Calendar, Mail, Link as LinkIcon, FileText } from "lucide-react"

const CONTACT_EMAIL = "hello@mustaphaukizuru.com"

/* Anchor id of the Aviso de Privacidad block. The footer links straight to
 * it (/privacy#aviso-de-privacidad) so it is a stable, public id. */
const PRIVACY_NOTICE_ANCHOR = "aviso-de-privacidad"

/* Section bodies live in i18n (legal.json → privacy.sections[] and
 * privacy.notice.sections[]) so en/es stay in lockstep. Each entry carries a
 * stable slug so URLs like /privacy#data-retention deep-link to the exact
 * paragraph (Brand v3 §17 — shareable section IDs). Rich text uses the
 * <strong> / <cookies> component markers resolved by <Trans> below. */
const RICH_COMPONENTS = {
  strong: <strong />,
  // NB: the marker must NOT be named `link` — i18next's HTML parser treats
  // <link> as a void element and drops its children, leaving an <a> with no
  // accessible name (axe link-name failure on /privacy).
  cookies: (
    <Link
      to="/cookies"
      className="font-semibold text-violet underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2 rounded"
    />
  ),
}

function useHashScroll() {
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash) return undefined
    // ScrollToTopOnNavigate fires on pathname change; wait a tick so the
    // anchor wins when the user arrives from another route.
    const id = window.setTimeout(() => {
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" })
    }, 50)
    return () => window.clearTimeout(id)
  }, [hash])
}

function SectionCard({ slug, title, i18nKey, index, anchorAria }) {
  return (
    <m.section
      id={slug}
      // scroll-mt offset accounts for the sticky Header so the section
      // title isn't hidden behind it on anchor jumps.
      className="scroll-mt-24 rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[var(--shadow-e2)]"
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.04 }}
    >
      {/* Section heading with anchor affordance — the # icon is always
          present at low opacity, brightens on hover to signal "copyable
          link". */}
      <h2 className="group mb-3 flex items-center gap-2 text-body font-bold text-violet">
        <a
          href={`#${slug}`}
          aria-label={`${anchorAria} ${title}`}
          className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
        >
          <span>{title}</span>
          <LinkIcon aria-hidden="true" className="h-3.5 w-3.5 text-violet/0 transition group-hover:text-violet/60" />
        </a>
      </h2>
      <p className="text-meta leading-7 text-charcoal-80/70">
        <Trans i18nKey={i18nKey} ns="legal" components={RICH_COMPONENTS} />
      </p>
    </m.section>
  )
}

function TocLink({ slug, title }) {
  return (
    <li>
      <a
        href={`#${slug}`}
        className="block rounded-md px-2 py-1 text-meta text-charcoal-80/75 transition hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
      >
        {title}
      </a>
    </li>
  )
}

export default function PrivacyPage() {
  const { t } = useTranslation("legal")
  useHashScroll()

  const sections = t("privacy.sections", { returnObjects: true })
  const notice = t("privacy.notice.sections", { returnObjects: true })
  const list = Array.isArray(sections) ? sections : []
  const noticeList = Array.isArray(notice) ? notice : []
  const anchorAria = t("privacy.anchorAria")

  return (
    <div className="bg-mist">
      <section className="py-16 text-center" style={{ backgroundColor: "var(--color-charcoal)" }}>
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 text-terracotta">
            <Shield className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-page font-bold text-white">{t("privacy.title")}</h1>
          <p className="mt-3 text-body text-white/85">{t("privacy.subtitle")}</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-micro text-white">
            <Calendar className="h-3.5 w-3.5" /> {t("privacy.lastUpdated")}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        {/* Table of contents — same pattern as TermsPage and CookiePolicyPage
            for consistency across the legal trio. */}
        <nav
          aria-label={t("privacy.tocAria")}
          className="mb-8 rounded-xl border border-charcoal-80/10 bg-white p-5 shadow-[var(--shadow-e2)]"
        >
          <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-charcoal-80/65">
            {t("privacy.tocLabel")}
          </p>
          <ol className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {list.map(({ slug, title }) => <TocLink key={slug} slug={slug} title={title} />)}
          </ol>
          <p className="mb-2 mt-4 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-charcoal-80/65">
            {t("privacy.notice.title")}
          </p>
          <ol className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {noticeList.map(({ slug, title }) => <TocLink key={slug} slug={slug} title={title} />)}
          </ol>
        </nav>

        <article className="flex flex-col gap-4">
          {list.map(({ slug, title }, i) => (
            <SectionCard key={slug} slug={slug} title={title} index={i} anchorAria={anchorAria}
              i18nKey={`privacy.sections.${i}.content`} />
          ))}
        </article>

        {/* Aviso de Privacidad Integral · LFPDPPP arts. 15-17 */}
        <section id={PRIVACY_NOTICE_ANCHOR} className="mt-12 scroll-mt-24">
          <div className="mb-6 flex items-start gap-4 rounded-xl border border-violet/15 bg-white p-6 shadow-[var(--shadow-e3)]">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-pale text-violet">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-subsection font-bold text-violet">{t("privacy.notice.title")}</h2>
              <p className="mt-2 text-meta leading-7 text-charcoal-80/70">{t("privacy.notice.intro")}</p>
            </div>
          </div>
          <article className="flex flex-col gap-4">
            {noticeList.map(({ slug, title }, i) => (
              <SectionCard key={slug} slug={slug} title={title} index={i} anchorAria={anchorAria}
                i18nKey={`privacy.notice.sections.${i}.content`} />
            ))}
          </article>
        </section>

        <div className="mt-8 flex items-center gap-4 rounded-xl p-6 text-white" style={{ backgroundColor: "var(--color-charcoal)" }}>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <div className="font-semibold">{t("privacy.questions")}</div>
            <a href={`mailto:${CONTACT_EMAIL}`} className="mt-1 text-meta text-white/60 hover:text-white hover:underline">{CONTACT_EMAIL}</a>
          </div>
        </div>
      </div>
    </div>
  )
}
