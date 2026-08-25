/* ────────────────────────────────────────────────────────────────────────────
 * ServiceDetailPage — route /services/:slug  (one of the 4 categories)
 *
 * Outcome-first intro → offerings → how it works → FAQ → single CTA.
 * Content comes from the static catalogue (docs/SERVICE_CATALOGUE_2026-08.md);
 * the API `Service` row (same slug) is fetched only for SEO overrides.
 * Legacy slugs / SKU ids are redirected to their canonical category.
 * ──────────────────────────────────────────────────────────────────────────── */
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useParams, Link, useNavigate } from "react-router-dom"
import { AlertCircle, ArrowLeft, ChevronRight, Clock, ShieldCheck, Sparkles } from "lucide-react"
import Seo from "../components/seo/Seo"
import { serviceSchema, breadcrumbSchema, faqSchema } from "../seo/schemas"
import { getCategoryBySlug, CATEGORY_FAQS, CATEGORIES } from "../data/servicesCatalogue"
import { fetchServiceBySlug } from "../services/serviceService"
import { Container, EyebrowChip, SectionHeader } from "../components/services/Primitives"
import OfferingList from "../components/services/OfferingList"
import HowItWorks from "../components/services/HowItWorks"
import ServiceDemo from "../components/services/demos/ServiceDemo"
import CategoryFaq from "../components/services/CategoryFaq"
import { BookCallButton, StickyBookBar } from "../components/services/BookCallCta"
import { pick, useCatalogueLang } from "../components/services/localize"

export default function ServiceDetailPage() {
  const { t } = useTranslation("services")
  const { slug } = useParams()
  const navigate = useNavigate()
  const lang = useCatalogueLang()

  const category = useMemo(() => getCategoryBySlug(slug), [slug])
  const [apiService, setApiService] = useState(null)

  // Legacy slug → canonical category URL.
  useEffect(() => {
    if (category && category.slug !== slug) navigate(`/services/${category.slug}`, { replace: true })
  }, [category, slug, navigate])

  // Optional: DB row for SEO overrides. Never blocks rendering.
  useEffect(() => {
    if (!category) return undefined
    let cancelled = false
    fetchServiceBySlug(category.slug)
      .then((data) => { if (!cancelled && data && data.slug === category.slug) setApiService(data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [category])

  if (!category) {
    return (
      <div className="min-h-[60vh] bg-mist">
        <Seo title={t("detail.errors.notFound")} robots="noindex,nofollow" />
        <Container className="py-20">
          <div className="mx-auto max-w-md rounded-2xl border border-charcoal-80/10 bg-white p-10 text-center">
            <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-violet-pale text-violet">
              <AlertCircle className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="text-section font-bold text-violet">{t("detail.errors.notFound")}</h1>
            <p className="mt-2 text-meta text-charcoal-80/70">{t("detail.errors.unavailable")}</p>
            <Link to="/services" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-deep">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("detail.errors.backToServices")}
            </Link>
          </div>
        </Container>
      </div>
    )
  }

  const name = pick(category, "name", lang)
  const outcome = pick(category, "outcome", lang)
  const tagline = pick(category, "tagline", lang)
  const faqItems = (CATEGORY_FAQS[category.slug] || []).map((f) => ({
    id: f.id,
    question: pick(f, "q", lang),
    answer: pick(f, "a", lang),
  }))
  const others = CATEGORIES.filter((c) => c.slug !== category.slug)
  const Icon = category.Icon

  return (
    <div className="bg-mist">
      <Seo
        title={apiService?.metaTitle || `${name} · Mustapha Ukizuru`}
        description={apiService?.metaDescription || outcome}
        jsonLd={[
          serviceSchema({ title: name, shortDescription: outcome, slug: category.slug }, `/services/${category.slug}`),
          breadcrumbSchema([
            { name: t("detail.breadcrumb.services"), url: "/services" },
            { name, url: `/services/${category.slug}` },
          ]),
          faqSchema(faqItems),
        ].filter(Boolean)}
      />

      {/* Outcome-first hero */}
      <section className="border-b border-charcoal-80/10 bg-white">
        <Container className="py-10 sm:py-14 lg:py-16">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-micro text-charcoal-80/65" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-violet">{t("detail.breadcrumb.home")}</Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <Link to="/services" className="hover:text-violet">{t("detail.breadcrumb.services")}</Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="font-medium text-violet">{name}</span>
          </nav>

          <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div>
              <EyebrowChip>{t("funnel.detail.eyebrow")}</EyebrowChip>
              <h1 className="mt-4 text-display font-bold tracking-tight text-violet">{outcome}</h1>
              <p className="mt-4 max-w-2xl text-body leading-7 text-charcoal-80/75">{tagline}</p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <BookCallButton slug={category.slug} size="lg" />
                <span className="inline-flex items-center gap-1.5 text-micro text-charcoal-80/65">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {t("funnel.detail.freeCall")}
                </span>
              </div>
            </div>
            <div className="rounded-2xl border border-violet/15 bg-gradient-to-br from-violet-ghost to-white p-6">
              <div className="flex items-center gap-3">
                <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl text-white ${category.tile}`}>
                  {Icon && <Icon className="h-5 w-5" aria-hidden="true" />}
                </span>
                <div>
                  <div className="text-micro font-semibold uppercase tracking-[0.16em] text-violet">{t("funnel.detail.categoryLabel")}</div>
                  <div className="text-body font-bold text-violet">{name}</div>
                </div>
              </div>
              <ul className="mt-5 space-y-2.5 text-meta text-charcoal-80/80">
                <li className="flex gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet" aria-hidden="true" />{t("funnel.detail.point1", { count: category.offerings.length })}</li>
                <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-violet" aria-hidden="true" />{t("funnel.detail.point2")}</li>
                <li className="flex gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-violet" aria-hidden="true" />{t("funnel.detail.point3")}</li>
              </ul>
            </div>
          </div>
        </Container>
      </section>

      {/* Offerings */}
      <section className="py-16 sm:py-20">
        <Container>
          <SectionHeader
            align="left"
            eyebrow={t("funnel.detail.offeringsEyebrow")}
            title={t("funnel.detail.offeringsTitle", { name })}
            subtitle={t("funnel.detail.offeringsSubtitle")}
          />
          <OfferingList offerings={category.offerings} />
        </Container>
      </section>

      {/* Interactive demo (ai-automation only; lazy chunk, loads near viewport) */}
      <ServiceDemo slug={category.slug} />

      {/* How it works */}
      <section className="bg-white py-16 sm:py-20">
        <Container><HowItWorks /></Container>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-20">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
            <SectionHeader align="left" eyebrow={t("funnel.faq.eyebrow")} title={t("funnel.faq.title")} subtitle={t("funnel.faq.subtitle")} />
            <CategoryFaq items={faqItems} />
          </div>
        </Container>
      </section>

      {/* Single CTA */}
      <section className="bg-violet py-16 text-white sm:py-20">
        <Container className="text-center">
          <p className="text-micro font-semibold uppercase tracking-[0.2em] text-white/85">{t("funnel.final.eyebrow")}</p>
          <h2 className="mx-auto mt-3 max-w-2xl text-section font-bold">{t("funnel.detail.finalTitle", { name })}</h2>
          <p className="mx-auto mt-3 max-w-xl text-body text-white/80">{t("funnel.final.body")}</p>
          <div className="mt-8"><BookCallButton slug={category.slug} tone="white" size="lg" /></div>
          <div className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13px] text-white/70">
            <span>{t("funnel.detail.otherCategories")}</span>
            {others.map((c) => (
              <Link key={c.slug} to={`/services/${c.slug}`} className="underline-offset-4 hover:text-white hover:underline">
                {pick(c, "name", lang)}
              </Link>
            ))}
          </div>
        </Container>
      </section>

      <StickyBookBar slug={category.slug} title={name} />
    </div>
  )
}
