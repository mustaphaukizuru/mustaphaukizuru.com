import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { fetchFeaturedPortfolio } from "../../services/portfolioService"
import ProjectShowcase from "../portfolio/ProjectShowcase"
import { Container, SectionHeading, SectionLink } from "./primitives"

/** FeaturedPortfolio · three selected projects, each on a scroll-tilt stage
 *  (components/portfolio/ProjectShowcase). Renders nothing when empty. */
export default function FeaturedPortfolio() {
  const { t } = useTranslation("home")
  const [items, setItems] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchFeaturedPortfolio(3)
        if (!cancelled) setItems(Array.isArray(data) ? data.slice(0, 3) : [])
      } catch {
        /* silent — section simply does not render */
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (!loaded || items.length === 0) return null

  return (
    <section className="bg-mist py-20 lg:py-24" aria-labelledby="home-portfolio-heading">
      <Container>
        <SectionHeading
          id="home-portfolio-heading"
          eyebrow={t("portfolio.eyebrow")}
          title={t("portfolio.title")}
          subtitle={t("portfolio.subtitle")}
          action={<SectionLink to="/portfolio" onWhite>{t("portfolio.cta")}</SectionLink>}
        />
        <div className="flex flex-col">
          {items.map((p, idx) => (
            <ProjectShowcase key={p.id || p.slug} project={p} priority={idx === 0} density="compact" />
          ))}
        </div>
      </Container>
    </section>
  )
}
