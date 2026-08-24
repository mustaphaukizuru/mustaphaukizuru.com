import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { ArrowRight } from "lucide-react"
import { serviceCategories } from "../../data/homeData"
import { Container, SectionHeading, SectionLink } from "./primitives"

/**
 * FeaturedServices · the 4 catalogue categories (docs/SERVICE_CATALOGUE_2026-08.md)
 * Static data — no API round-trip, so the section always renders and never
 * shifts layout. Each card links to a slug that exists in servicesCatalogue.js
 * (or /services when the category has no slug yet).
 */
export default function FeaturedServices() {
  const { t } = useTranslation("home")

  return (
    <section className="bg-mist py-20 lg:py-24" aria-labelledby="home-services-heading">
      <Container>
        <SectionHeading
          id="home-services-heading"
          eyebrow={t("services.eyebrow")}
          title={t("services.title")}
          subtitle={t("services.subtitle")}
          action={<SectionLink to="/services" onWhite>{t("services.cta")}</SectionLink>}
        />

        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {serviceCategories.map(({ key, icon: Icon, to }) => (
            <li key={key} className="h-full">
              <Link
                to={to}
                className="group flex h-full flex-col gap-5 rounded-2xl border border-charcoal-80/10 bg-white p-6 shadow-[0_8px_24px_rgba(93,63,211,0.05)] transition hover:-translate-y-0.5 hover:border-violet/30 hover:shadow-[0_18px_44px_rgba(93,63,211,0.10)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet/10 text-violet transition group-hover:bg-violet group-hover:text-white">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="flex-1">
                  <h3 className="text-[17px] font-bold leading-snug text-charcoal">
                    {t(`services.items.${key}.title`)}
                  </h3>
                  <p className="mt-2 text-[13.5px] leading-6 text-charcoal-80/65">
                    {t(`services.items.${key}.body`)}
                  </p>
                </span>
                <span className="inline-flex items-center gap-1 text-meta font-semibold text-violet transition group-hover:gap-2">
                  {t("services.learnMore")}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
