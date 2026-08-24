import { useTranslation } from "react-i18next"
import { m } from "framer-motion"
import { Package, Star } from "lucide-react"
import Lens from "../motion/Lens"

/* ──────────────────────────────────────────────────────────────────────────
 *  Gallery — thumbnail rail (left on ≥sm, row below on mobile) + main image
 *  with Lens zoom and Featured / New badges. Controlled: the page owns the
 *  active index so the SEO image can follow the selection.
 *  ────────────────────────────────────────────────────────────────────────── */
export default function Gallery({ images = [], activeImg = 0, onSelect, product }) {
  const { t } = useTranslation("product")
  const current = images[activeImg]

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {images.length > 1 && (
        <div
          className="order-2 flex gap-2 overflow-x-auto pb-1 sm:order-1 sm:max-h-[520px] sm:flex-col sm:overflow-x-hidden sm:overflow-y-auto sm:pb-0 sm:pr-1"
          role="tablist"
          aria-label={t("carousel.thumbnailsAria")}
        >
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              role="tab"
              aria-selected={activeImg === i}
              aria-label={t("carousel.showImage", { index: i + 1, alt: img.alt || "" })}
              onClick={() => onSelect?.(i)}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/40 ${
                activeImg === i
                  ? "border-violet shadow-[0_0_0_3px_rgb(var(--color-violet-rgb)/0.15)]"
                  : "border-charcoal-80/12 hover:border-violet/40"
              }`}
            >
              <img src={img.url} alt={img.alt} className="h-full w-full object-contain" />
            </button>
          ))}
        </div>
      )}

      <div className="order-1 flex-1 sm:order-2">
        <m.div
          key={activeImg}
          layoutId={activeImg === 0 && product?.slug ? `product-cover-${product.slug}` : undefined}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="relative aspect-square overflow-hidden rounded-xl bg-violet-pale shadow-[0_8px_32px_rgb(var(--color-violet-rgb)/0.08)]"
        >
          {current ? (
            <Lens src={current.url} alt={current.alt} className="h-full w-full" imgClassName="object-contain" />
          ) : (
            <div className="flex h-full items-center justify-center text-violet/25">
              <Package className="h-16 w-16" />
            </div>
          )}

          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            {product?.isFeatured && (
              <span className="flex items-center gap-1 rounded-lg bg-violet px-2.5 py-1 text-micro font-bold text-white">
                <Star className="h-3 w-3 fill-current" />
                {t("misc.featuredBadge")}
              </span>
            )}
            {product?.isNew && (
              <span className="rounded-lg bg-mint-600 px-2.5 py-1 text-micro font-bold text-white">
                {t("misc.newBadge")}
              </span>
            )}
          </div>
        </m.div>
      </div>
    </div>
  )
}
