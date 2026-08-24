/* ════════════════════════════════════════════════════════════════════════
   ServicesPage.jsx · Services funnel overview (roadmap step 25)
   ────────────────────────────────────────────────────────────────────────
   Structure = the 4 catalogue categories (docs/SERVICE_CATALOGUE_2026-08.md),
   each listing its offerings with ONE primary CTA: book a 30-min call.

     § 01 · Hero (ServicesHero, unchanged)
     § 02 · Four categories → offerings → "Book a 30-min call"
     § 03 · How it works · call → proposal → delivery
     § 04 · Fixed-price packages (existing checkout link preserved)
     § 05 · FAQ (+ FAQPage JSON-LD)
     § 06 · Final CTA
     Sticky page-level CTA bar
   ════════════════════════════════════════════════════════════════════════ */

import { useTranslation } from "react-i18next"
import Seo from "../components/seo/Seo"
import ServicesHero from "../components/heroes/ServicesHero"
import { pageSeo } from "../seo/pageSeo"
import { faqSchema, itemListSchema } from "../seo/schemas"
import { CATEGORIES } from "../data/servicesCatalogue"
import { Container, SectionHeader } from "../components/services/Primitives"
import CategoryCard from "../components/services/CategoryCard"
import HowItWorks from "../components/services/HowItWorks"
import PackagesStrip from "../components/services/PackagesStrip"
import CategoryFaq from "../components/services/CategoryFaq"
import { BookCallButton, StickyBookBar } from "../components/services/BookCallCta"
import { pick, useCatalogueLang } from "../components/services/localize"

export default function ServicesPage() {
  const { t } = useTranslation("services")
  const lang = useCatalogueLang()

  const faqItems = (t("funnel.faq.items", { returnObjects: true }) || []).map((it, i) => ({
    id: it.id || `faq-${i}`, question: it.question, answer: it.answer,
  }))

  const jsonLd = [
    faqSchema(faqItems),
    itemListSchema(
      CATEGORIES.map((c) => ({ name: pick(c, "name", lang), url: `/services/${c.slug}` })),
      { name: t("funnel.overview.title") },
    ),
  ].filter(Boolean)

  return (
    <>
      <Seo {...(pageSeo.ServicesPage || pageSeo.services || {})} includeLocalBusiness jsonLd={jsonLd} />

      {/* § 01 · Hero */}
      <ServicesHero />

      {/* § 02 · Four categories */}
      <section id="catalogue" className="bg-mist py-16 sm:py-20">
        <Container>
          <SectionHeader
            eyebrow={t("funnel.overview.eyebrow")}
            title={t("funnel.overview.title")}
            subtitle={t("funnel.overview.subtitle")}
          />
          <div className="grid gap-6 lg:grid-cols-2">
            {CATEGORIES.map((category, index) => (
              <CategoryCard key={category.slug} category={category} index={index} />
            ))}
          </div>
        </Container>
      </section>

      {/* § 03 · How it works */}
      <section className="bg-white py-16 sm:py-20">
        <Container>
          <HowItWorks />
        </Container>
      </section>

      {/* § 04 · Fixed-price packages (checkout link unchanged) */}
      <section className="bg-mist py-16 sm:py-20">
        <Container>
          <PackagesStrip />
        </Container>
      </section>

      {/* § 05 · FAQ */}
      <section className="bg-white py-16 sm:py-20">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
            <div>
              <SectionHeader
                align="left"
                eyebrow={t("funnel.faq.eyebrow")}
                title={t("funnel.faq.title")}
                subtitle={t("funnel.faq.subtitle")}
              />
              <BookCallButton />
            </div>
            <CategoryFaq items={faqItems} />
          </div>
        </Container>
      </section>

      {/* § 06 · Final CTA */}
      <section className="bg-violet py-16 text-white sm:py-20">
        <Container className="text-center">
          <p className="text-micro font-semibold uppercase tracking-[0.2em] text-white/70">{t("funnel.final.eyebrow")}</p>
          <h2 className="mx-auto mt-3 max-w-2xl text-section font-bold">{t("funnel.final.title")}</h2>
          <p className="mx-auto mt-3 max-w-xl text-body text-white/80">{t("funnel.final.body")}</p>
          <div className="mt-8">
            <BookCallButton tone="white" size="lg" />
          </div>
        </Container>
      </section>

      <StickyBookBar />
    </>
  )
}
