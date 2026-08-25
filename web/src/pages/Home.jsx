import Seo from "../components/seo/Seo"
import { pageSeo } from "../seo/pageSeo"
import { siteNavigationSchema } from "../seo/schemas"
import HomeHero from "../components/heroes/HomeHero"
import HomeStatsStrip from "../components/HomeStatsStrip"
import TestimonialsMarquee from "../components/TestimonialsMarquee"
import TwoPaths from "../components/home/TwoPaths"
import FeaturedServices from "../components/home/FeaturedServices"
import FeaturedProducts from "../components/home/FeaturedProducts"
import FeaturedPortfolio from "../components/home/FeaturedPortfolio"
import Process from "../components/home/Process"
import LatestPosts from "../components/home/LatestPosts"
import FinalCta from "../components/home/FinalCta"
import { RevealSection } from "../components/home/primitives"
import { testimonials } from "../data/homeData"

/* ──────────────────────────────────────────────────────────────────────────
 *  Home · roadmap steps 24 (one thesis, two paths) + 28 (trust layer)
 *
 *  Section order — each one has a single job:
 *    1. Hero              what I build, for whom, two CTAs (/book, /store)
 *    2. Proof strip       four numbers + stack logo row
 *    3. Two paths         Services vs Products, one CTA each
 *    4. Featured services the 4 catalogue categories
 *    5. Featured products newest per category (API)
 *    6. Selected work     3 portfolio items (API, hidden when empty)
 *    7. Testimonials      named, role + company (placeholders flagged)
 *    8. How I work        3 steps
 *    9. Latest posts      3 articles
 *   10. Final CTA         book a call
 *
 *  Motion budget: one orchestrated hero sequence (5 staggered children),
 *  one RevealSection fade per section below the fold, and the Counter in
 *  the proof strip. Everything honours prefers-reduced-motion.
 *  ──────────────────────────────────────────────────────────────────── */
export default function Home() {
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
