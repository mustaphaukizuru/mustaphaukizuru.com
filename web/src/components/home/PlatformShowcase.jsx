import { useTranslation } from "react-i18next"
import { LocalizedLink as Link } from "../LocalizedLink"
import { ArrowRight } from "lucide-react"
import Image from "../ui/Image"
import ScrollDeviceShowcase from "../motion/ScrollDeviceShowcase"
import { Container } from "./primitives"

/**
 * PlatformShowcase · Home section 4 (between "Two paths" and "Services")
 *
 * The page claims full-stack platforms; this is the screenshot that proves
 * it — and the platform on screen is this site: store, member portal,
 * bookings, invoices, admin. Static asset, not the portfolio API, so the
 * section always renders (FeaturedPortfolio below it hides when empty).
 *
 * Perf: below the fold, lazy-loaded, srcset picks the 800w webp/avif on
 * phones. No new dependency — the tilt is framer-motion core.
 */
/**
 * A 1440x900 capture of the live services page — a flat UI screenshot, not a
 * device mockup, because the frame around it already IS the device. Source
 * lives in web/public/images (Vite empties the repo-root public/ on build);
 * webp + avif siblings come from scripts/convert-images.mjs + generate-avif.
 */
const SHOT = "/images/pages/home-platform-showcase.png"
const CASE_STUDY = "/projects/mustaphaukizuru-digital-platform"

export default function PlatformShowcase() {
  const { t } = useTranslation("home")

  return (
    <section className="bg-mist py-20 lg:py-24" aria-labelledby="home-showcase-heading">
      <Container>
        <ScrollDeviceShowcase
          chrome="mustaphaukizuru.com/services"
          header={
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="inline-flex items-center rounded-full bg-violet-pale px-3 py-1 text-micro font-semibold uppercase tracking-[0.2em] text-violet">
                {t("showcase.eyebrow")}
              </span>
              <h2
                id="home-showcase-heading"
                className="text-section font-bold tracking-tight text-violet sm:text-page"
              >
                {t("showcase.title")}
              </h2>
              <p className="max-w-2xl text-body leading-7 text-charcoal-80/70">
                {t("showcase.subtitle")}
              </p>
              <Link
                to={CASE_STUDY}
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-violet/20 bg-white px-5 py-2.5 text-meta font-semibold text-violet transition hover:bg-violet-pale focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
              >
                {t("showcase.cta")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          }
        >
          <Image
            src={SHOT}
            alt={t("showcase.imageAlt")}
            width={1440}
            height={900}
            widths={[400, 800, 1200, 1440]}
            sizes="(max-width: 1024px) 100vw, 1024px"
            imgClassName="block h-full w-full object-cover object-top"
          />
        </ScrollDeviceShowcase>
      </Container>
    </section>
  )
}
