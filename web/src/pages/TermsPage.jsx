import { m } from "framer-motion"
import { useTranslation } from "react-i18next"
import { FileText, Calendar, Scale, Mail, Link as LinkIcon } from "lucide-react"

const LAST_UPDATED = "March 2026"

/* Stable section slugs for deep-linking (e.g. /terms#refund-policy). The
 * numeric prefix stays in `title` for scannability; slug is the anchor. */
const sections = [
  {
    slug: "acceptance-of-terms",
    title: "1. Acceptance of Terms",
    content: "By accessing or using the Mustapha Ukizuru digital platform (mustaphaukizuru.com), you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, please do not use our services or purchase our digital products."
  },
  {
    slug: "digital-products",
    title: "2. Digital Products",
    content: "All digital products sold through this platform are for personal or professional use only. You may not redistribute, resell, or share downloaded products without explicit written permission. Digital products are delivered via your member dashboard after successful payment."
  },
  {
    slug: "payment-and-pricing",
    title: "3. Payment and Pricing",
    content: "Prices are displayed in USD unless stated otherwise. Payments are processed securely through Mercado Pago, PayPal, and Link. You are responsible for any applicable taxes in your jurisdiction. Prices may be updated without notice, but changes will not affect confirmed orders."
  },
  {
    slug: "refund-policy",
    title: "4. Refund Policy",
    content: "Due to the digital nature of our products, refunds are handled on a case-by-case basis. Please review our dedicated Refund Policy page for detailed information about eligibility and the process for requesting a refund."
  },
  {
    slug: "intellectual-property",
    title: "5. Intellectual Property",
    content: "All content, products, designs, and materials on this platform are the intellectual property of Mustapha Ukizuru or their respective owners. Unauthorized reproduction or distribution is prohibited."
  },
  {
    slug: "user-accounts",
    title: "6. User Accounts",
    content: "You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account. We reserve the right to terminate accounts that violate these terms."
  },
  {
    slug: "service-consulting",
    title: "7. Service Consulting",
    content: "Consulting service packages described on this platform are subject to availability and mutual agreement. Service delivery timelines and deliverables are defined within individual service agreements."
  },
  {
    slug: "limitation-of-liability",
    title: "8. Limitation of Liability",
    content: "To the maximum extent permitted by law, Mustapha Ukizuru shall not be liable for any indirect, incidental, or consequential damages arising from the use of our platform or digital products."
  },
  {
    slug: "governing-law",
    title: "9. Governing Law",
    content: "These Terms are governed by applicable international law and the regulations of the jurisdiction in which services are delivered. Any disputes shall be resolved through good-faith negotiation or appropriate legal channels."
  },
  {
    slug: "contact",
    title: "10. Contact",
    content: "For questions about these Terms, please contact us at hello@mustaphaukizuru.com."
  }
]

export default function TermsPage() {
  const { t } = useTranslation("legal")
  return (
    <div className="bg-mist">
      {/* Hero */}
      <section className="py-16 text-center" style={{ backgroundColor: "var(--color-violet)" }}>
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 text-terracotta">
            <Scale className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-page font-bold text-white">{t("terms.title", "Terms & Conditions")}</h1>
          <p className="mt-3 text-body text-white/85">
            {t("terms.intro")}
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-micro text-white">
            <Calendar className="h-3.5 w-3.5" /> {t("terms.lastUpdated", "Last updated")}: {LAST_UPDATED}
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        {/* Table of contents — matches the pattern used on PrivacyPage
            and CookiePolicyPage for visual consistency across the legal
            trio. Shareable jump-links via the slugs defined on each
            section above. */}
        <nav
          aria-label={t("terms.tocAria", { defaultValue: "Table of contents" })}
          className="mb-8 rounded-xl border border-charcoal-80/10 bg-white p-5 shadow-[var(--shadow-e2)]"
        >
          <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-charcoal-80/65">
            {t("terms.tocLabel", { defaultValue: "On this page" })}
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
              className="scroll-mt-24 rounded-xl border border-charcoal-80/10 bg-white p-6 shadow-[var(--shadow-e2)]"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
            >
              <h2 className="group mb-3 flex items-center gap-2 text-body font-bold text-violet">
                <a
                  href={`#${slug}`}
                  aria-label={t("terms.anchorAria", { defaultValue: "Direct link to" }) + " " + title}
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

        {/* Contact CTA */}
        <div className="mt-8 flex items-center gap-4 rounded-xl bg-violet p-6 text-white">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <div className="font-semibold">{t("terms.questions")}</div>
            <a href="mailto:hello@mustaphaukizuru.com" className="mt-1 text-meta text-white/60 hover:text-white hover:underline">
              hello@mustaphaukizuru.com
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
