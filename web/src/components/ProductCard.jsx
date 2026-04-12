import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  ShoppingCart,
  Eye,
  Check,
  Star,
  Download,
  BadgeCheck,
} from "lucide-react"
import { useCart } from "../store/CartContext"
import { API_BASE_URL } from "../lib/api"

function formatPrice(value, currency = "USD") {
  const amount = Number(value || 0)
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `$${amount.toFixed(2)}`
  }
}

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

function getBadge(product, isNewFallback) {
  if (product?.isFeatured) {
    return {
      label: "Featured",
      className: "bg-[#ede4ef] text-[#420060] border-[#d4b8e0]",
      icon: Star,
    }
  }
  if (product?.isBestSeller) {
    return {
      label: "Popular",
      className: "bg-[#fff7ed] text-[#9a3412] border-[#fed7aa]",
      icon: BadgeCheck,
    }
  }
  if (product?.isNew || isNewFallback) {
    return {
      label: "New",
      className: "bg-[#ecfdf3] text-[#166534] border-[#bbf7d0]",
      icon: BadgeCheck,
    }
  }
  return null
}

export default function ProductCard({ product }) {
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

  const createdRecently = useMemo(() => {
    if (!product?.createdAt) return false
    const created = new Date(product.createdAt).getTime()
    const now = Date.now()
    const threshold = 14 * 24 * 60 * 60 * 1000
    return now - created <= threshold
  }, [product?.createdAt])

  const badge = useMemo(
    () => getBadge(product, createdRecently),
    [product, createdRecently]
  )

  useEffect(() => {
    if (!hovered || pausedByUser || images.length <= 1) return
    const interval = window.setInterval(() => {
      setPreviewIndex((current) => (current + 1) % images.length)
    }, 2800)
    return () => window.clearInterval(interval)
  }, [hovered, pausedByUser, images.length])

  useEffect(() => {
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
    <article
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-[#E9E3DD] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(66,0,96,0.08)]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={resetInteraction}
    >
      <Link to={`/store/${product?.slug || ""}`} className="block">
        {/* Image area — fills container, object-cover, no internal padding */}
        <div className="relative w-full overflow-hidden bg-[#F7F9F4]">
          <div className="aspect-square w-full overflow-hidden">
            {activeImage ? (
              <img
                src={activeImage.url}
                alt={activeImage.alt}
                className="h-full w-full object-contain transition duration-500 group-hover:scale-[1.02]"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[#7A7A7A]">
                Preview unavailable
              </div>
            )}
          </div>

          {/* Badge only (New / Featured / Popular) — no category badge */}
          {badge ? (
            <div className="absolute left-2.5 top-2.5 pointer-events-none">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold shadow-sm ${badge.className}`}
              >
                <badge.icon className="h-2.5 w-2.5" />
                {badge.label}
              </span>
            </div>
          ) : null}

          {/* Thumbnail strip */}
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
                          ? "border-[#420060] ring-2 ring-[#420060]/15"
                          : "border-black/5 hover:border-[#420060]/30"
                      }`}
                    >
                      <img
                        src={image.url}
                        alt={image.alt}
                        className="h-full w-full object-contain"
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
          <h3 className="line-clamp-2 text-[14px] font-semibold leading-snug text-[#2E2F3A] transition-colors hover:text-[#420060]">
            {product?.title || "Untitled Product"}
          </h3>
        </Link>

        <p className="mt-1.5 line-clamp-2 text-[12px] leading-5 text-[#634F40]">
          {product?.shortDescription ||
            product?.description ||
            "No description available."}
        </p>

        {/* Instant access */}
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#7A7A7A]">
          <Download className="h-3.5 w-3.5 shrink-0" />
          <span>Instant access</span>
        </div>

        {/* Price + action buttons */}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#F0EBF4] pt-3">
          <p className="text-[16px] font-bold tracking-tight text-[#420060]">
            {formatPrice(safePrice, product?.currency || "USD")}
          </p>

          <div className="flex items-center gap-1.5">
            <Link
              to={`/store/${product?.slug || ""}`}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#420060]/15 bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#420060] transition hover:border-[#420060]/30 hover:bg-[#F4EFF7]"
            >
              <Eye className="h-3.5 w-3.5" />
              View
            </Link>

            <button
              type="button"
              onClick={handleAddToCart}
              className={`inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-white transition ${
                added ? "bg-[#2FA36B]" : "bg-[#420060] hover:bg-[#52007A]"
              }`}
            >
              {added ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <ShoppingCart className="h-3.5 w-3.5" />
              )}
              {added ? "Added" : "Add"}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
