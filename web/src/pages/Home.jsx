import Seo from "../components/seo/Seo"
import { pageSeo } from "../seo/pageSeo"
import { siteNavigationSchema } from "../seo/schemas"
import HomeHero from "../components/heroes/HomeHero"
import HomeStatsStrip from "../components/HomeStatsStrip"
import TestimonialsMarquee from "../components/TestimonialsMarquee"
import TwoPaths from "../components/home/TwoPaths"
import PlatformShowcase from "../components/home/PlatformShowcase"
import FeaturedServices from "../components/home/FeaturedServices"
import FeaturedProducts from "../components/home/FeaturedProducts"
import FeaturedPortfolio from "../components/home/FeaturedPortfolio"
import Process from "../components/home/Process"
import LatestPosts from "../components/home/LatestPosts"
import FinalCta from "../components/home/FinalCta"
import { RevealSection } from "../components/home/primitives"
import useApiQuery from "../hooks/useApiQuery"
import { fetchFeaturedReviews } from "../services/reviewService"

/* ──────────────────────────────────────────────────────────────────────────
 *  Home · roadmap steps 24 (one thesis, two paths) + 28 (trust layer)
 *
 *  Section order — each one has a single job:
 *    1. Hero              what I build, for whom, two CTAs (/book, /store)
 *    2. Proof strip       four numbers + stack logo row
 *    3. Two paths         Services vs Products, one CTA each
 *    4. Platform showcase this site, on a screen that straightens as you scroll
 *    5. Featured services the 4 catalogue categories
 *    6. Featured products newest per category (API)
 *    7. Selected work     3 portfolio items (API, hidden when empty)
 *    8. Testimonials      featured reviews from the API (hidden when none)
 *    9. How I work        3 steps
 *   10. Latest posts      3 articles
 *   11. Final CTA         book a call
 *
 *  Motion budget: one orchestrated hero sequence (5 staggered children),
 *  one RevealSection fade per section below the fold, the Counter in the
 *  proof strip, and the showcase tilt (which brings its own reveal, so it
 *  is NOT wrapped in RevealSection). Everything honours
 *  prefers-reduced-motion.
 *  ──────────────────────────────────────────────────────────────────── */
export default function Home() {
  const featured = useApiQuery(
    "reviews:featured",
    ({ signal }) => fetchFeaturedReviews({ limit: 6, signal }),
    { staleTime: 5 * 60_000 },
  )
  const testimonials = Array.isArray(featured.data) ? featured.data : []

  return (
    <>
      <Seo
        {...pageSeo.home}
        includeLocalBusiness
        noBreadcrumbs
        jsonLd={[siteNavigationSchema()]}
      />
      <HomeHero />
      <RevealSection><HomeStatsStrip /></RevealSection>
      <RevealSection><TwoPaths /></RevealSection>
      <PlatformShowcase />
      <RevealSection><FeaturedServices /></RevealSection>
      <RevealSection><FeaturedProducts /></RevealSection>
      <RevealSection><FeaturedPortfolio /></RevealSection>
      <RevealSection><TestimonialsMarquee testimonials={testimonials} /></RevealSection>
      <RevealSection><Process /></RevealSection>
      <RevealSection><LatestPosts /></RevealSection>
      <RevealSection><FinalCta /></RevealSection>
    </>
  )
}
