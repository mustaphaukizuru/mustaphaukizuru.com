import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { m, AnimatePresence } from "framer-motion"
import {
  ShoppingCart,
  Eye,
  Check,
  Star,
  Download,
  Sparkles,
} from "lucide-react"
import { useCart } from "../store/CartContext"
import { API_BASE_URL } from "../lib/api"
import { getFileTypeStyles } from "../lib/fileTypeIcons"

/* ──────────────────────────────────────────────────────────────────────────
 *  ProductCard · F05.A · Batch 4
 *
 *  Refinements applied per F05.A spec:
 *    - "New" badge top-left (Soft Terracotta bg, Charcoal text) when isNew
 *    - "Featured" badge top-right (Violet Ghost bg, Violet text) when isFeatured
 *    - Both badges can co-exist (the prior implementation collapsed all flags
 *      into one slot via getBadge() — replaced)
 *    - File-type mini-chips bottom-left of image: first 3 distinct file types
 *      using the F04 fileTypeIcons.js color palette
 *    - Image hover scale: 1.03 over 300ms
 *    - Card lift hover: motion.div translateY: -4 with soft shadow
 *    - Price renders in JetBrains Mono · tabular-nums
 *    - Rating row below title: "⭐ 4.8 (127)" only when reviewCount > 0
 *
 *  Preserved verbatim:
 *    - Image preview thumbnail strip + hover auto-rotation
 *    - Add-to-cart success flash
 *    - All callable props and behavior
 *  ──────────────────────────────────────────────────────────────────────── */

// Single source of truth — see web/src/lib/format.js. Re-exported locally
// only because some legacy call sites pass a string price; the imported
// formatPrice handles non-number input correctly.
import { formatPrice } from "../lib/format"
import SpotlightCard from "./motion/SpotlightCard"

function resolveImageUrl(url = "") {
  if (!url) return null
  return url.startsWith("http") ? url : `${API_BASE_URL}${url}`
}

function normalizeImages(product) {
  const raw = Array.isArray(product?.images) ? product.images : []
  return raw
    .filter((img) => img?.url)
    .slice(0, 6)
    .map((img, index) => ({
      id: img.id || `img-${index}`,
      url: resolveImageUrl(img.url),
      alt: img.altText || product?.title || `Product preview ${index + 1}`,
      role: img.imageRole || "preview",
    }))
}

/* ── F05.A · derive 3 distinct file-type chips from product.files ──────── */
function getFileTypeChips(product) {
  const files = Array.isArray(product?.files) ? product.files : []
  const seen = new Set()
  const chips = []
  for (const f of files) {
    const styles = getFileTypeStyles(f.fileType || f.fileName || "")
    const key = styles.label || styles.fileType || ""
    if (!key || seen.has(key)) continue
    seen.add(key)
    chips.push(styles)
    if (chips.length >= 3) break
  }
  // Fallback: if there are no `files` but product has a `fileType` scalar
  if (chips.length === 0 && product?.fileType) {
    chips.push(getFileTypeStyles(product.fileType))
  }
  return chips
}

/* ── New + Featured (independent flags per F05.A) ──────────────────────── */
function isCreatedRecently(createdAt) {
  if (!createdAt) return false
  const created = new Date(createdAt).getTime()
  const now = Date.now()
  const threshold = 14 * 24 * 60 * 60 * 1000 // 14 days
  return now - created <= threshold
}

export default function ProductCard({ product }) {
  const { t } = useTranslation("store")
  const { addToCart } = useCart()

  const [hovered, setHovered] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [added, setAdded] = useState(false)
  const [pausedByUser, setPausedByUser] = useState(false)

  const images = useMemo(() => normalizeImages(product), [product])
  const activeImage = images[previewIndex] || images[0] || null

  const safePrice =
    product?.price !== undefined && product?.price !== null
      ? Number(product.price)
      : 0

  // F05.A · Independent flags
  const showNewBadge = Boolean(product?.isNew || isCreatedRecently(product?.createdAt))
  const showFeaturedBadge = Boolean(product?.isFeatured)

  // F05.A · file-type chips (max 3 distinct)
  const fileChips = useMemo(() => getFileTypeChips(product), [product])

  // F05.A · rating display gated on reviewCount
  const rating = Number(product?.rating || 0)
  const reviewCount = Number(product?.reviewCount || 0)
  const showRating = reviewCount > 0 && rating > 0

  useEffect(() => {
    if (!hovered || pausedByUser || images.length <= 1) return
    const interval = window.setInterval(() => {
      setPreviewIndex((current) => (current + 1) % images.length)
    }, 2800)
    return () => window.clearInterval(interval)
  }, [hovered, pausedByUser, images.length])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clamp after the image list shrinks (external data)
    if (previewIndex > images.length - 1) setPreviewIndex(0)
  }, [previewIndex, images.length])

  const handleThumbnailPreview = (e, index) => {
    e.preventDefault()
    e.stopPropagation()
    setPausedByUser(true)
    setPreviewIndex(index)
  }

  const handleAddToCart = (e) => {
    e.preventDefault()
    e.stopPropagation()
    addToCart(product, 1)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1200)
  }

  const resetInteraction = () => {
    setHovered(false)
    setPausedByUser(false)
    setPreviewIndex(0)
  }

  return (
    <m.article
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={resetInteraction}
    >
    <SpotlightCard
      as="div"
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-charcoal-80/10 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition-shadow duration-300 hover:shadow-[0_18px_44px_rgb(var(--color-violet-rgb)/0.10)]"
    >
      <Link to={`/store/${product?.slug || ""}`} className="block">
        <div className="relative w-full overflow-hidden bg-mist">
          <div className="aspect-[4/3] w-full overflow-hidden">
            {activeImage ? (
              <m.img
                layoutId={`product-cover-${product?.slug || ""}`}
                src={activeImage.url}
                alt={activeImage.alt}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-steel">
                {t("common:system.preview")}
              </div>
            )}
          </div>

          {/* F05.A · "New" badge top-left (Soft Terracotta bg + Charcoal text) */}
          {showNewBadge && (
            <div className="absolute left-2.5 top-2.5 pointer-events-none">
              <span className="inline-flex items-center gap-1 rounded-full bg-terracotta px-2.5 py-0.5 text-micro font-bold text-charcoal shadow-[0_4px_10px_rgba(255,168,134,0.40)]">
                <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                New
              </span>
            </div>
          )}

          {/* F05.A · "Featured" badge top-right (Violet Ghost bg + Violet text) */}
          {showFeaturedBadge && (
            <div
              className={`absolute top-2.5 ${
                showFeaturedBadge ? "right-[3.25rem]" : "right-2.5"
              } pointer-events-none`}
              style={{ right: "3.25rem" }}
            >
              <span className="inline-flex items-center gap-1 rounded-full border border-violet/15 bg-violet-pale px-2.5 py-0.5 text-micro font-bold text-violet shadow-sm">
                <Star className="h-2.5 w-2.5 fill-current" aria-hidden="true" />
                Featured
              </span>
            </div>
          )}


          {/* F05.A · file-type chips bottom-left (first 3 distinct) */}
          {fileChips.length > 0 && (
            <div className="pointer-events-none absolute bottom-2.5 left-2.5 flex flex-wrap items-center gap-1">
              {fileChips.map((chip, i) => (
                <span
                  key={`${chip.label}-${i}`}
                  className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-sm backdrop-blur-md"
                  style={{
                    background: chip.background,
                    color: chip.color,
                    borderColor: chip.borderColor,
                  }}
                >
                  {chip.label}
                </span>
              ))}
            </div>
          )}

          {/* Thumbnail strip, kept verbatim from prior version */}
          {images.length > 1 ? (
            <div className="absolute inset-x-0 bottom-0 p-2">
              <div className="mx-auto flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-white/88 px-1.5 py-1.5 shadow-sm backdrop-blur-md">
                {images.map((image, index) => {
                  const isActive = previewIndex === index
                  return (
                    <button
                      key={image.id}
                      type="button"
                      aria-label={`Show preview ${index + 1}`}
                      onMouseEnter={(e) => handleThumbnailPreview(e, index)}
                      onFocus={(e) => handleThumbnailPreview(e, index)}
                      onClick={(e) => handleThumbnailPreview(e, index)}
                      className={`relative h-8 w-8 shrink-0 overflow-hidden rounded-lg border transition-all duration-200 ${
                        isActive
                          ? "border-violet ring-2 ring-violet/15"
                          : "border-black/5 hover:border-violet/30"
                      }`}
                    >
                      <img
                        src={image.url}
                        alt={image.alt}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      </Link>

      {/* Card body */}
      <div className="flex flex-1 flex-col p-4">
        <Link to={`/store/${product?.slug || ""}`}>
          <h3 className="line-clamp-2 text-meta font-semibold leading-snug text-charcoal transition-colors hover:text-violet">
            {product?.title || "Untitled Product"}
          </h3>
        </Link>

        {/* F05.A · rating row, only when reviewCount > 0 */}
        {showRating && (
          <div className="mt-1.5 flex items-center gap-1.5 text-micro">
            <Star className="h-3.5 w-3.5 fill-current text-terracotta" aria-hidden="true" />
            <span className="font-mono font-semibold tabular-nums text-violet">
              {rating.toFixed(1)}
            </span>
            <span className="font-mono tabular-nums text-charcoal-80/65">
              ({reviewCount})
            </span>
          </div>
        )}

        <p className={`${showRating ? "mt-1.5" : "mt-1.5"} line-clamp-2 text-micro leading-5 text-charcoal-80`}>
          {product?.shortDescription ||
            product?.description ||
            "No description available."}
        </p>

        {/* Instant access */}
        <div className="mt-2 flex items-center gap-1.5 text-micro text-steel">
          <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{t("card.instantAccess")}</span>
        </div>

        {/* Price + actions */}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-charcoal-80/8 pt-3">
          {/* F05.A · price in JetBrains Mono · tabular-nums */}
          <p className="font-mono text-body font-bold tabular-nums tracking-tight text-violet">
            {formatPrice(safePrice, product?.currency || "MXN")}
          </p>

          <div className="flex items-center gap-1.5">
            <Link
              to={`/store/${product?.slug || ""}`}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-violet/15 bg-white px-2.5 py-1.5 text-micro font-medium text-violet transition hover:border-violet/30 hover:bg-violet-pale/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2"
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              {t("card.view")}
            </Link>

            <button
              type="button"
              onClick={handleAddToCart}
              className={`inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-micro font-medium transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-azure/30 focus-visible:ring-offset-2 ${
                added ? "bg-mint text-charcoal" : "bg-violet text-white hover:bg-violet-deep"
              }`}
            >
              {added ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />}
              {added ? t("card.added") : t("card.addShort")}
            </button>
          </div>
        </div>
      </div>
    </SpotlightCard>
    </m.article>
  )
}
