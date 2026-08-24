import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { ArrowRight, Calendar, Check, Handshake, PackageOpen } from "lucide-react"
import { Container, SectionHeading } from "./primitives"

/**
 * TwoPaths · "Two ways to work with me" (roadmap step 24)
 * Services vs Products — the site's two revenue paths, side by side, each
 * with its own CTA. No motion beyond the page-level RevealSection.
 */
export default function TwoPaths() {
  const { t } = useTranslation("home")
  const servicesBullets = t("paths.services.bullets", { returnObjects: true })
  const productsBullets = t("paths.products.bullets", { returnObjects: true })

  return (
    <section className="py-20 lg:py-24" aria-labelledby="home-paths-heading">
      <Container>
        <SectionHeading
          id="home-paths-heading"
          eyebrow={t("paths.eyebrow")}
          title={t("paths.title")}
          subtitle={t("paths.subtitle")}
          align="center"
        />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Services — primary path */}
          <PathCard
            icon={Handshake}
            title={t("paths.services.title")}
            body={t("paths.services.body")}
            bullets={servicesBullets}
            tint="bg-violet-ghost"
            primary={
              <Link
                to="/book"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-violet px-6 py-3 text-[14px] font-semibold text-white shadow-lg shadow-violet/20 transition hover:bg-violet-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2"
              >
                <Calendar className="h-4 w-4" aria-hidden="true" />
                {t("paths.services.secondary")}
              </Link>
            }
            secondary={
              <Link
                to="/services"
                className="inline-flex min-h-12 items-center gap-1.5 rounded-full px-4 py-3 text-[14px] font-semibold text-violet transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2"
              >
                {t("paths.services.cta")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            }
          />

          {/* Products — self-serve path */}
          <PathCard
            icon={PackageOpen}
            title={t("paths.products.title")}
            body={t("paths.products.body")}
            bullets={productsBullets}
            tint="bg-azure-pale/50"
            primary={
              <Link
                to="/store"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-charcoal/15 bg-white px-6 py-3 text-[14px] font-semibold text-charcoal transition hover:border-violet/40 hover:text-violet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet focus-visible:ring-offset-2"
              >
                {t("paths.products.cta")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            }
          />
        </div>
      </Container>
    </section>
  )
}

function PathCard({ icon: Icon, title, body, bullets, tint, primary, secondary }) {
  return (
    <article className={`flex h-full flex-col rounded-2xl ${tint} p-6 ring-1 ring-charcoal-80/8 sm:p-8`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-violet shadow-sm">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="mt-5 text-card font-bold text-charcoal">{title}</h3>
      <p className="mt-2 text-body leading-relaxed text-charcoal-80/70">{body}</p>
      <ul className="mt-5 flex flex-col gap-2">
        {(Array.isArray(bullets) ? bullets : []).map((b) => (
          <li key={b} className="flex items-start gap-2 text-[14px] text-charcoal-80/80">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet" aria-hidden="true" />
            {b}
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-col gap-2 pt-7 sm:flex-row sm:items-center sm:gap-3">
        {primary}
        {secondary}
      </div>
    </article>
  )
}
