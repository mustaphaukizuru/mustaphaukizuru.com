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
  if (!url) return ""
  return url.startsWith("http") ? url : `${API_BASE_URL}${url}`
}

function normalizeImages(product) {
  const raw = Array.isArray(product?.images) ? product.images : []

  return raw
    .filter((img) => img?.url)
    .slice(0, 6)
    .map((img, index) => ({
      id: img.id || `${img.url}-${index}`,
      url: resolveImageUrl(img.url),
      alt: img.altText || product?.title || `Product preview ${index + 1}`,
      role: img.imageRole || "preview",
    }))
}

function getBadge(product, isNewFallback) {
  if (product?.isFeatured) {
    return {
      label: "Featured",
      className: "bg-[#420060] text-white border-[#420060]",
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

  const highlights = useMemo(() => {
    if (Array.isArray(product?.highlights) && product.highlights.length > 0) {
      return product.highlights.slice(0, 2)
    }

    if (Array.isArray(product?.features) && product.features.length > 0) {
      return product.features
        .slice(0, 2)
        .map((item) =>
          typeof item === "string" ? item : item?.label || item?.title || item?.featureText
        )
        .filter(Boolean)
    }

    return []
  }, [product?.highlights, product?.features])

  useEffect(() => {
    if (!hovered || pausedByUser || images.length <= 1) return

    const interval = window.setInterval(() => {
      setPreviewIndex((current) => (current + 1) % images.length)
    }, 2800)

    return () => window.clearInterval(interval)
  }, [hovered, pausedByUser, images.length])

  useEffect(() => {
    if (previewIndex > images.length - 1) {
      setPreviewIndex(0)
    }
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

    window.setTimeout(() => {
      setAdded(false)
    }, 1200)
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
        <div className="relative overflow-hidden bg-[#F7F9F4]">
          <div className="relative aspect-[4/3] w-full overflow-hidden">
            {activeImage ? (
              <img
                src={activeImage.url}
                alt={activeImage.alt}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[#7A7A7A]">
                Product preview unavailable
              </div>
            )}
          </div>

          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
            <div className="flex flex-wrap gap-2">
              {product?.category ? (
                <span className="rounded-full border border-white/70 bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#420060] shadow-sm backdrop-blur-sm">
                  {product.category}
                </span>
              ) : null}

              {badge ? (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide shadow-sm ${badge.className}`}
                >
                  <badge.icon className="h-3 w-3" />
                  {badge.label}
                </span>
              ) : null}
            </div>
          </div>

          {images.length > 1 ? (
            <div className="absolute inset-x-0 bottom-0 p-3">
              <div className="mx-auto flex w-fit max-w-full items-center gap-1.5 overflow-x-auto rounded-xl bg-white/88 px-2 py-2 shadow-sm backdrop-blur-md">
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
                      className={`relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border transition-all duration-200 ${
                        isActive
                          ? "border-[#420060] ring-2 ring-[#420060]/15"
                          : "border-black/5 hover:border-[#420060]/30"
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

      <div className="flex flex-1 flex-col p-4">
        <div className="min-w-0">
          <Link to={`/store/${product?.slug || ""}`}>
            <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-[#2E2F3A] transition-colors hover:text-[#420060]">
              {product?.title || "Untitled Product"}
            </h3>
          </Link>

          {product?.shortLabel ? (
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-[#7A7A7A]">
              {product.shortLabel}
            </p>
          ) : null}
        </div>

        <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-[#634F40]">
          {product?.shortDescription ||
            product?.description ||
            "No description available."}
        </p>

        {highlights.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {highlights.map((item, index) => (
              <span
                key={`${item}-${index}`}
                className="rounded-full bg-[#F4EFF7] px-2.5 py-1 text-[10px] font-medium text-[#420060]"
              >
                {item}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-2 flex items-center gap-2 text-[11px] text-[#7A7A7A]">
          <span className="inline-flex items-center gap-1">
            <Download className="h-3.5 w-3.5" />
            Instant access
          </span>

          {product?.fileType ? (
            <>
              <span className="h-1 w-1 rounded-full bg-[#CFC7D7]" />
              <span>{product.fileType}</span>
            </>
          ) : null}
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-lg font-semibold tracking-tight text-[#420060]">
            {formatPrice(safePrice, product?.currency || "USD")}
          </p>

          {product?.deliveryType ? (
            <span className="rounded-full bg-[#F4EFF7] px-2.5 py-1 text-[11px] font-medium text-[#420060]/80">
              {product.deliveryType}
            </span>
          ) : null}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <Link
            to={`/store/${product?.slug || ""}`}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#420060]/15 bg-white px-3 py-2 text-xs font-medium text-[#420060] transition hover:border-[#420060]/30 hover:bg-[#F4EFF7]"
          >
            <Eye className="h-3.5 w-3.5" />
            View
          </Link>

          <button
            type="button"
            onClick={handleAddToCart}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium text-white transition ${
              added
                ? "bg-[#2FA36B]"
                : "bg-[#420060] hover:bg-[#52007A]"
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
    </article>
  )
}