import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Inbox } from "lucide-react"
import { fetchProducts } from "../../services/productService"
import ProductCard from "../ProductCard"
import { EmptyState, Skeleton } from "../system"
import { Container, SectionHeading, SectionLink } from "./primitives"

/**
 * FeaturedProducts · newest product per category, max 6.
 * Per-card stagger removed (roadmap step 24 motion budget) — the grid is
 * revealed once by the page-level RevealSection.
 */
export default function FeaturedProducts() {
  const { t } = useTranslation("home")
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await fetchProducts("")
        const arr = Array.isArray(data) ? data : []
        if (cancelled || arr.length === 0) return
        const sorted = [...arr].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        const byCategory = new Map()
        for (const p of sorted) {
          const cat = p.category || "General"
          if (!byCategory.has(cat)) byCategory.set(cat, p)
        }
        let featured = Array.from(byCategory.values()).slice(0, 6)
        if (featured.length < 6) {
          const extras = sorted.filter((p) => !featured.find((f) => f.id === p.id))
          featured = [...featured, ...extras].slice(0, 6)
        }
        setProducts(featured)
      } catch (err) {
        console.warn("Featured products fetch failed:", err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <section className="py-20 lg:py-24" aria-labelledby="home-products-heading">
      <Container>
        <SectionHeading
          id="home-products-heading"
          eyebrow={t("featuredProducts.eyebrow")}
          title={t("featuredProducts.title")}
          subtitle={t("featuredProducts.subtitle")}
          action={<SectionLink to="/store">{t("featuredProducts.cta")}</SectionLink>}
        />

        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => <Skeleton.Card key={i} />)}
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={t("featuredProducts.emptyTitle")}
            description={t("featuredProducts.emptyBody")}
            action={
              <Link
                to="/contact"
                className="inline-flex items-center gap-1.5 rounded-xl border border-violet/20 bg-white px-5 py-2.5 text-meta font-semibold text-violet transition hover:bg-violet-pale"
              >
                {t("featuredProducts.emptyCta")}
              </Link>
            }
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        )}
      </Container>
    </section>
  )
}
