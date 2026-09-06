/* ════════════════════════════════════════════════════════════════════════
   SchoolsPage.jsx · /schools · audience landing page (September 2026)
   ────────────────────────────────────────────────────────────────────────
   AUDIENCE page for school leaders — NOT a fifth service category. Every
   offering shown here is resolved from the closed catalogue of four
   (data/servicesCatalogue.js) and links back into /services/:slug.
   Composition (Blueprint v4.0 § 05 — one idea per viewport, every
   section anchored by a visual, no bullet lists in public copy):

     § 01 · Hero — positioning + credential chips + system diagram
     § 02 · The school year as a stepper (SVG connector draws on scroll)
     § 03 · Four outcomes, one per category, canonical order
     § 04 · Evidence — two school platforms already delivered
     § 05 · Products — two store resources for school leaders
     § 06 · FAQ (+ FAQPage JSON-LD)
     § 07 · Self-audit band → final booking CTA

   Copy: i18n namespace `schools` (Spanish is the source register).
   Data: data/schoolsData.js (pointers only, no duplicated prices/copy).
   ════════════════════════════════════════════════════════════════════════ */

import { LocalizedLink as Link } from "../components/LocalizedLink"
import { useTranslation } from "react-i18next"
import {
  ArrowRight, ArrowUpRight, Award, Building2, ClipboardCheck, GraduationCap, LayoutGrid, Sparkles,
} from "lucide-react"

import Seo from "../components/seo/Seo"
import { pageSeo } from "../seo/pageSeo"
import { breadcrumbSchema, faqSchema, itemListSchema } from "../seo/schemas"
import { getOfferingBySlug } from "../data/servicesCatalogue"
import {
  SCHOOL_HERO_PHOTO, SCHOOL_OUTCOME_OFFERINGS, SCHOOL_PRODUCTS, SCHOOL_PROJECTS,
} from "../data/schoolsData"
import { Container, EyebrowChip, SectionHeader } from "../components/services/Primitives"
import { BookCallButton } from "../components/services/BookCallCta"
import CategoryFaq from "../components/services/CategoryFaq"
import { pick, useCatalogueLang } from "../components/services/localize"
import Reveal from "../components/motion/Reveal"
import StaggerGrid from "../components/motion/StaggerGrid"
import Image from "../components/ui/Image"
import SchoolSystemDiagram from "../components/schools/SchoolSystemDiagram"
import SchoolYearTimeline from "../components/schools/SchoolYearTimeline"

/** Booking always enters through S1 — strategy is the diagnostic step of the
 *  client journey (Blueprint v4.0 § 03), and the school lens is applied
 *  in the call, not in a separate offering. */
const BOOKING_SLUG = "it-strategy-consulting"

const CREDENTIALS = [
  { key: "itManager", Icon: Building2 },
  { key: "google",    Icon: Award },
  { key: "teacher",   Icon: GraduationCap },
  { key: "platforms", Icon: LayoutGrid },
]

export default function SchoolsPage() {
  const { t } = useTranslation("schools")
  const lang = useCatalogueLang()

  const outcomes = SCHOOL_OUTCOME_OFFERINGS
    .map((slug) => getOfferingBySlug(slug))
    .filter(Boolean)

  const faqItems = (t("faq.items", { returnObjects: true }) || []).map((it, i) => ({
    id: it.id || `faq-${i}`, question: it.question, answer: it.answer,
  }))
  const steps = t("cycle.steps", { returnObjects: true }) || []
  const nodeLabels = t("hero.nodes", { returnObjects: true }) || {}

  const jsonLd = [
    breadcrumbSchema([
      { name: t("seo.breadcrumbHome"), url: "/" },
      { name: t("seo.breadcrumbSchools"), url: "/schools" },
    ]),
    faqSchema(faqItems),
    itemListSchema(
      SCHOOL_PROJECTS.map((p) => ({ name: pick(p, "title", lang), url: `/projects/${p.slug}` })),
      { name: t("evidence.title") },
    ),
  ].filter(Boolean)

  return (
    <div className="bg-mist">
      <Seo {...(pageSeo.schools || {})} includeLocalBusiness jsonLd={jsonLd} />

      {/* § 01 · Hero */}
      <section className="border-b border-charcoal-80/10 bg-white">
        <Container className="py-12 sm:py-16 lg:py-20">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              <EyebrowChip>{t("hero.eyebrow")}</EyebrowChip>
              <h1 className="mt-4 max-w-2xl text-display font-bold tracking-tight text-violet">{t("hero.title")}</h1>
              <p className="mt-5 max-w-xl text-body leading-7 text-charcoal-80/75">{t("hero.subtitle")}</p>

              {/* Credentials as a glyph row, never a list (R3) */}
              <div className="mt-7 flex flex-wrap gap-2.5" aria-label={t("hero.eyebrow")}>
                {CREDENTIALS.map(({ key, Icon }) => (
                  <span key={key} className="inline-flex items-center gap-2 rounded-full border border-violet/15 bg-violet-ghost px-3 py-1.5 text-[13px] font-semibold text-violet">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {t(`hero.credentials.${key}`)}
                  </span>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <BookCallButton slug={BOOKING_SLUG} size="lg" label={t("hero.primaryCta")} />
                <a href="#school-evidence" className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet underline-offset-4 hover:underline">
                  {t("hero.secondaryCta")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
            </div>

            {SCHOOL_HERO_PHOTO ? (
              <Image
                src={SCHOOL_HERO_PHOTO.src}
                alt={t("hero.diagramTitle")}
                width={SCHOOL_HERO_PHOTO.width}
                height={SCHOOL_HERO_PHOTO.height}
                loading="eager"
                fetchPriority="high"
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="overflow-hidden rounded-3xl"
                imgClassName="h-auto w-full object-cover"
              />
            ) : (
              <SchoolSystemDiagram labels={nodeLabels} title={t("hero.diagramTitle")} caption={t("hero.diagramCaption")} />
            )}
          </div>
        </Container>
      </section>

      {/* § 02 · The school year */}
      <section className="py-16 sm:py-20">
        <Container>
          <SectionHeader align="left" eyebrow={t("cycle.eyebrow")} title={t("cycle.title")} subtitle={t("cycle.subtitle")} />
          <SchoolYearTimeline steps={steps} />
        </Container>
      </section>

      {/* § 03 · Four outcomes, one per category */}
      <section className="bg-white py-16 sm:py-20">
        <Container>
          <SectionHeader eyebrow={t("outcomes.eyebrow")} title={t("outcomes.title")} subtitle={t("outcomes.subtitle")} />
          <StaggerGrid className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" as="ul" itemAs="li" role="list">
            {outcomes.map((offering) => {
              const { category } = offering
              const Icon = category.Icon
              return (
                <article key={offering.slug} className="group flex h-full flex-col rounded-2xl border border-charcoal-80/10 bg-mist p-6 transition-all hover:-translate-y-1 hover:border-violet/30 hover:shadow-[var(--shadow-e4)]">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl text-white ${category.tile}`}>
                      {Icon && <Icon className="h-5 w-5" aria-hidden="true" />}
                    </span>
                    <span className="font-mono text-micro uppercase tracking-[0.16em] text-charcoal-80/70">{category.code}</span>
                  </div>
                  <p className="mt-5 text-micro font-semibold uppercase tracking-[0.14em] text-charcoal-80/75">{pick(category, "name", lang)}</p>
                  <h3 className="mt-1.5 text-subhead font-bold text-violet">{pick(offering, "name", lang)}</h3>
                  <p className="mt-2 text-meta leading-6 text-charcoal-80/75">{t(`outcomes.items.${offering.slug}`)}</p>
                  <Link to={`/services/${category.slug}`} className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-violet hover:underline">
                    {t("outcomes.viewCategory")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </article>
              )
            })}
          </StaggerGrid>
        </Container>
      </section>

      {/* § 04 · Evidence */}
      <section id="school-evidence" className="py-16 sm:py-20">
        <Container>
          <SectionHeader align="left" eyebrow={t("evidence.eyebrow")} title={t("evidence.title")} subtitle={t("evidence.subtitle")} />
          <StaggerGrid className="grid gap-6 lg:grid-cols-2" as="ul" itemAs="li" role="list">
            {SCHOOL_PROJECTS.map((project) => (
              <article key={project.slug} className="group overflow-hidden rounded-2xl border border-charcoal-80/10 bg-white shadow-[var(--shadow-e4)]">
                {/* Device frame · real UI, never stock (§ 5.2e) */}
                <div className="border-b border-charcoal-80/10 bg-charcoal-80 px-4 pt-3">
                  <div className="flex gap-1.5 pb-3" aria-hidden="true">
                    <span className="h-2 w-2 rounded-full bg-white/30" /><span className="h-2 w-2 rounded-full bg-white/30" /><span className="h-2 w-2 rounded-full bg-white/30" />
                  </div>
                  <Image
                    src={project.cover}
                    alt={`${project.client} — ${pick(project, "title", lang)}`}
                    width={project.coverWidth}
                    height={project.coverHeight}
                    widths={[400, 800, 1200]}
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="block overflow-hidden rounded-t-lg"
                    imgClassName="h-auto w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </div>
                <div className="p-6">
                  <p className="font-mono text-micro uppercase tracking-[0.16em] text-charcoal-80/70">{project.client}</p>
                  <h3 className="mt-1.5 text-subhead font-bold text-violet">{pick(project, "title", lang)}</h3>
                  <p className="mt-2 text-meta leading-6 text-charcoal-80/75">{pick(project, "summary", lang)}</p>
                  <Link to={`/projects/${project.slug}`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-violet hover:underline">
                    {t("evidence.viewProject")} <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </StaggerGrid>
          <div className="mt-8">
            <Link to="/portfolio" className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet hover:underline">
              {t("evidence.allProjects")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </Container>
      </section>

      {/* § 05 · Products */}
      <section className="bg-white py-16 sm:py-20">
        <Container>
          <SectionHeader align="left" eyebrow={t("products.eyebrow")} title={t("products.title")} subtitle={t("products.subtitle")} />
          <StaggerGrid className="grid gap-6 sm:grid-cols-2" as="ul" itemAs="li" role="list">
            {SCHOOL_PRODUCTS.map((product) => (
              <article key={product.slug} className="group flex gap-5 rounded-2xl border border-charcoal-80/10 bg-mist p-5 transition-all hover:-translate-y-1 hover:border-violet/30 hover:shadow-[var(--shadow-e4)]">
                <Image
                  src={product.cover}
                  webp={false}
                  alt={t(`products.items.${product.slug}.title`)}
                  width={240}
                  height={320}
                  sizes="120px"
                  className="w-[120px] shrink-0 overflow-hidden rounded-xl"
                  imgClassName="h-auto w-full object-cover"
                />
                <div className="flex flex-col">
                  <h3 className="text-subhead font-bold text-violet">{t(`products.items.${product.slug}.title`)}</h3>
                  <p className="mt-2 text-meta leading-6 text-charcoal-80/75">{t(`products.items.${product.slug}.blurb`)}</p>
                  <Link to={`/store/${product.slug}`} className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-violet hover:underline">
                    {t("products.viewProduct")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </StaggerGrid>
        </Container>
      </section>

      {/* § 06 · FAQ */}
      <section className="py-16 sm:py-20">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
            <SectionHeader align="left" eyebrow={t("faq.eyebrow")} title={t("faq.title")} />
            <CategoryFaq items={faqItems} />
          </div>
        </Container>
      </section>

      {/* § 07 · Self-audit band → final CTA */}
      <section className="bg-white py-16 sm:py-20">
        <Container>
          <Reveal>
            <div className="grid items-center gap-8 rounded-3xl border border-violet/15 bg-gradient-to-br from-violet-ghost to-white p-8 sm:p-10 lg:grid-cols-[auto_1fr_auto]">
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-violet text-white">
                <ClipboardCheck className="h-8 w-8" aria-hidden="true" />
              </span>
              <div>
                <p className="text-micro font-semibold uppercase tracking-[0.2em] text-violet">{t("audit.eyebrow")}</p>
                <h2 className="mt-2 text-section font-bold text-violet">{t("audit.title")}</h2>
                <p className="mt-2 max-w-xl text-body text-charcoal-80/75">{t("audit.body")}</p>
              </div>
              <Link to="/self-audit" className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet/30 bg-white px-5 py-3 text-sm font-semibold text-violet transition-all hover:-translate-y-0.5 hover:border-violet focus:outline-none focus-visible:ring-2 focus-visible:ring-violet/40">
                {t("audit.cta")} <Sparkles className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </Reveal>
        </Container>
      </section>

      <section className="bg-violet py-16 text-white sm:py-20">
        <Container className="text-center">
          <p className="text-micro font-semibold uppercase tracking-[0.2em] text-white/85">{t("final.eyebrow")}</p>
          <h2 className="mx-auto mt-3 max-w-2xl text-section font-bold">{t("final.title")}</h2>
          <p className="mx-auto mt-3 max-w-xl text-body text-white/80">{t("final.body")}</p>
          <div className="mt-8"><BookCallButton slug={BOOKING_SLUG} tone="white" size="lg" label={t("hero.primaryCta")} /></div>
          <div className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13px] text-white/85">
            <span>{t("final.otherAudiences")}</span>
            <Link to="/services" className="underline-offset-4 hover:text-white hover:underline">{t("final.businesses")}</Link>
            <Link to="/store" className="underline-offset-4 hover:text-white hover:underline">{t("final.individuals")}</Link>
          </div>
        </Container>
      </section>
    </div>
  )
}
