import { m } from "framer-motion"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Shield, Calendar, Mail, Link as LinkIcon } from "lucide-react"

const LAST_UPDATED = "March 2026"

/* Each section carries a stable slug so URLs like /privacy#data-retention
 * deep-link to the exact paragraph (Brand v3 §17 modern web pattern —
 * shareable section IDs). The number prefix remains in `title` for
 * scannability; the slug is the canonical anchor target. */
const sections = [
  { slug: "information-we-collect", title: "1. Information We Collect", content: "We collect information you provide directly, including name, email address, and payment information during account registration and checkout. We also collect usage data such as pages visited and interactions with the platform." },
  { slug: "how-we-use-your-information", title: "2. How We Use Your Information", content: "Your information is used to process orders, deliver digital products, send order confirmations, provide member dashboard access, and improve our platform. We do not sell your personal information to third parties." },
  { slug: "payment-security", title: "3. Payment Security", content: "Payment information is processed exclusively by our payment partners (Mercado Pago and PayPal). We do not store your full card details on our servers. All transactions are SSL encrypted." },
  // The cookies section is the only one that needs an inline route link
  // (back to the dedicated Cookie Policy + preferences UI), so its content
  // is a JSX fragment instead of a flat string. The article renderer below
  // handles both shapes via React's standard `{content}` interpolation.
  {
    slug: "cookies",
    title: "4. Cookies",
    content: (
      <>
        We use strictly necessary cookies for authentication, session integrity, and security.
        Analytics and marketing cookies are <strong>off by default</strong> and only fire after
        you explicitly accept them via the cookie banner. To review every category we use,
        update your choices, or revoke consent, visit our{" "}
        <Link
          to="/cookies"
          className="font-semibold text-violet underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2 rounded"
        >
          Cookie Policy
        </Link>
        {" "}page. Browser settings remain a backstop, but the in-app preferences are the
        primary, granular control.
      </>
    ),
  },
  { slug: "data-sharing", title: "5. Data Sharing", content: "We may share limited information with payment processors, email service providers, and analytics services strictly necessary to operate the platform. These partners are contractually bound to protect your data." },
  { slug: "data-retention", title: "6. Data Retention", content: "Account data is retained as long as your account is active. Order records are kept for legal and accounting purposes. You may request data deletion by contacting us, subject to applicable legal requirements." },
  { slug: "your-rights", title: "7. Your Rights", content: "You have the right to access, correct, or request deletion of your personal data. You may also opt out of marketing communications at any time using the unsubscribe link in emails." },
  { slug: "security", title: "8. Security", content: "We implement industry-standard security measures to protect your data, including encrypted storage, HTTPS enforcement, and access controls. However, no online transmission is 100% secure." },
  { slug: "childrens-privacy", title: "9. Children's Privacy", content: "Our platform is not directed to children under 13. We do not knowingly collect personal information from children. If you believe a child has provided us data, please contact us immediately." },
  { slug: "contact-us", title: "10. Contact Us", content: "For privacy-related inquiries or data requests, contact us at hello@mustaphaukizuru.com." }
]

export default function PrivacyPage() {
  const { t } = useTranslation("legal")
  return (
    <div className="bg-mist">
      <section className="py-16 text-center" style={{ backgroundColor: "#1A1B23" }}>
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 text-terracotta">
            <Shield className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-page font-bold text-white">{t("privacy.title", "Privacy Policy")}</h1>
          <p className="mt-3 text-body text-white/55">
            {t("privacy.subtitle")}
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-micro text-white/50">
            <Calendar className="h-3.5 w-3.5" /> Last updated: {LAST_UPDATED}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        {/* Table of contents — sticky-style block at top of the article.
            Visible on every viewport. Gives users a scannable index +
            shareable jump-links. The same pattern applies to TermsPage
            and CookiePolicyPage for consistency across the legal trio. */}
        <nav
          aria-label={t("privacy.tocAria", { defaultValue: "Table of contents" })}
          className="mb-8 rounded-xl border border-charcoal-80/10 bg-white p-5 shadow-[0_2px_10px_rgba(93,63,211,0.04)]"
        >
          <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-charcoal-80/55">
            {t("privacy.tocLabel", { defaultValue: "On this page" })}
          </p>
          <ol className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {sections.map(({ slug, title }) => (
              <li key={slug}>
                <a
                  href={`#${slug}`}
                  className="block rounded-md px-2 py-1 text-meta text-charcoal-80/75 transition hover:bg-violet-pale hover:text-violet focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30"
                >
                  {title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="flex flex-col gap-4">
          {sections.map(({ slug, title, content }, i) => (
            <m.section
              key={slug}
              id={slug}
              // scroll-mt offset accounts for the sticky Header so the
              // section title isn't hidden behind it on anchor jumps.
              className="scroll-mt-24 rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[0_2px_10px_rgba(93,63,211,0.04)]"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
            >
              {/* Section heading with anchor affordance — the # icon is
                  always present at low opacity, brightens on hover to
                  signal "copyable link". Clicking the heading itself
                  scrolls + updates the URL fragment via native browser
                  behaviour on the anchor tag. */}
              <h2 className="group mb-3 flex items-center gap-2 text-body font-bold text-violet">
                <a
                  href={`#${slug}`}
                  aria-label={t("privacy.anchorAria", { defaultValue: "Direct link to" }) + " " + title}
                  className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
                >
                  <span>{title}</span>
                  <LinkIcon
                    aria-hidden="true"
                    className="h-3.5 w-3.5 text-violet/0 transition group-hover:text-violet/60"
                  />
                </a>
              </h2>
              <p className="text-meta leading-7 text-charcoal-80/70">{content}</p>
            </m.section>
          ))}
        </article>
        <div className="mt-8 flex items-center gap-4 rounded-xl p-6 text-white" style={{ backgroundColor: "#1A1B23" }}>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <div className="font-semibold">Privacy questions?</div>
            <a href="mailto:hello@mustaphaukizuru.com" className="mt-1 text-meta text-white/60 hover:text-white hover:underline">hello@mustaphaukizuru.com</a>
          </div>
        </div>
      </div>
    </div>
  )
}
