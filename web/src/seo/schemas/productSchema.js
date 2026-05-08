import { DEFAULT_OG_IMAGE, absoluteUrl, siteConfig, trimText } from "../siteSeo"

/**
 * Product — schema.org/Product
 *
 * Builds a Product JSON-LD object suitable for Google rich results.
 * Includes Offer, optional aggregateRating, brand, category, and image[].
 * Pass `pathname` so the Offer.url resolves to the canonical product page.
 */
export function productSchema(product = {}, pathname = "") {
  if (!product || !product.title) return null

  const description = trimText(
    product.metaDescription || product.shortDescription || product.description || siteConfig.defaultDescription,
    300,
  )

  const images = Array.isArray(product.images) ? product.images : []
  const imageUrls = images
    .map((i) => (i?.url ? (/^https?:\/\//i.test(i.url) ? i.url : absoluteUrl(i.url)) : null))
    .filter(Boolean)
  const primaryImage = imageUrls[0] || DEFAULT_OG_IMAGE

  const offer = {
    "@type": "Offer",
    priceCurrency: product.currency || "MXN",
    price: Number(product.price || 0).toFixed(2),
    availability:
      product.isActive === false
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
    url: absoluteUrl(pathname || `/store/${product.slug || ""}`),
  }
  if (product.priceValidUntil) offer.priceValidUntil = product.priceValidUntil

  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description,
    image: imageUrls.length ? imageUrls : [primaryImage],
    sku: product.sku || product.id || undefined,
    brand: { "@type": "Brand", name: siteConfig.siteName },
    category: product.category?.name || product.category || undefined,
    offers: offer,
  }

  // aggregateRating — only emit if at least one review exists.
  const ratingValue = Number(product.averageRating || product.rating || 0)
  const reviewCount = Number(product.reviewCount || product._count?.reviews || 0)
  if (ratingValue > 0 && reviewCount > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: ratingValue.toFixed(1),
      reviewCount,
      bestRating: "5",
      worstRating: "1",
    }
  }

  return schema
}
