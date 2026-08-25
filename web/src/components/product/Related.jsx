import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { ArrowRight, Package } from "lucide-react"
import SpotlightCard from "../motion/SpotlightCard"
import { formatPrice } from "../../lib/format"
import { resolveUrl } from "./utils"

/* ──────────────────────────────────────────────────────────────────────────
 *  Related — "You may also like" grid (2-up mobile, 4-up desktop).
 *  Data comes from GET /api/products/:slug/related (fetched by the page).
 *  ────────────────────────────────────────────────────────────────────────── */
export default function Related({ items = [], currentSlug }) {
  const { t } = useTranslation("product")
  if (!Array.isArray(items) || items.length === 0) return null

  const filtered = items.filter((p) => p && p.slug && p.slug !== currentSlug)
  if (filtered.length === 0) return null

  return (
    <section aria-labelledby="related-heading" className="mt-12 border-t border-charcoal-80/10 pt-12">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 id="related-heading" className="text-section font-bold text-violet">{t("detail.youMayLike")}</h2>
        <Link to="/store" className="inline-flex items-center gap-1 text-meta font-semibold text-violet hover:underline">
          {t("detail.seeAll")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {filtered.slice(0, 4).map((p) => (
          <RelatedCard key={p.id || p.slug} product={p} />
        ))}
      </div>
    </section>
  )
}

function RelatedCard({ product }) {
  const primaryImage = Array.isArray(product.images) && product.images.length > 0
    ? product.images.find((img) => img.isPrimary) || product.images[0]
    : null
  const imageUrl = primaryImage?.url ? resolveUrl(primaryImage.url) : null
  const price = Number(product.price ?? 0)

  return (
    <SpotlightCard
      as={Link}
      to={`/store/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-charcoal-80/10 bg-white shadow-[var(--shadow-e3)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgb(var(--color-violet-rgb)/0.10)]"
    >
      <div className="aspect-[4/3] overflow-hidden bg-mist">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={primaryImage?.altText || product.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-violet/25">
            <Package className="h-10 w-10" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="line-clamp-2 text-meta font-semibold text-charcoal transition group-hover:text-violet">{product.title}</h3>
        {product.shortDescription && (
          <p className="line-clamp-2 text-micro leading-5 text-charcoal-80/65">{product.shortDescription}</p>
        )}
        <div className="mt-auto flex items-baseline gap-1.5 pt-2">
          <span className="text-meta font-bold text-violet">{formatPrice(price, product.currency || "MXN")}</span>
        </div>
      </div>
    </SpotlightCard>
  )
}
