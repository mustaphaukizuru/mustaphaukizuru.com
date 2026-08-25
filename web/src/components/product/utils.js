import { API_BASE_URL } from "../../lib/api"

/* ──────────────────────────────────────────────────────────────────────────
 *  Product detail helpers — pure functions shared by the product/* components
 *  and the ProductDetail page composition. No React here.
 *  ────────────────────────────────────────────────────────────────────────── */

export function resolveUrl(url = "") {
  if (!url) return ""
  if (url.startsWith("http://") || url.startsWith("https://")) return url
  return `${API_BASE_URL}${url}`
}

export function stripHtml(html = "") {
  return String(html).replace(/<[^>]*>/g, "").trim()
}

export function normalizeImages(product) {
  const raw = Array.isArray(product?.images) ? product.images : []

  const normalized = raw
    .filter((img) => img?.url)
    .slice(0, 6)
    .map((img, i) => ({
      id: img.id || `img-${i}`,
      url: resolveUrl(img.url),
      alt: img.altText || product?.title || `Preview ${i + 1}`,
      role: img.imageRole || "preview",
      isPrimary: Boolean(img.isPrimary),
    }))

  if (normalized.length > 0) return normalized

  if (product?.image) {
    return [{
      id: "fallback-image",
      url: resolveUrl(product.image),
      alt: product?.title || "Product image",
      role: "preview",
      isPrimary: true,
    }]
  }

  return []
}

/**
 * Real features only (ProductFeature relation, then specifications JSON).
 * Returns [] when nothing is defined so the UI renders an honest empty state.
 */
export function normalizeHighlights(product) {
  if (Array.isArray(product?.features) && product.features.length > 0) {
    const fromFeatures = product.features
      .map((f) => (typeof f === "string" ? f : f?.featureText || f?.label || f?.title || ""))
      .filter(Boolean)
      .slice(0, 8)
    if (fromFeatures.length > 0) return fromFeatures
  }

  const specs = product?.specifications
  if (specs && typeof specs === "object") {
    const entries = Array.isArray(specs)
      ? specs.map((row) => (row?.key && row?.value ? `${row.key}: ${row.value}` : "")).filter(Boolean)
      : Object.entries(specs).map(([k, v]) => (k && v != null ? `${k}: ${v}` : "")).filter(Boolean)
    if (entries.length > 0) return entries.slice(0, 8)
  }

  return []
}

export function buildSeoDescription(product) {
  const raw = product?.metaDescription || product?.shortDescription || product?.description || ""
  const cleaned = stripHtml(raw)
  if (!cleaned) {
    return "Professional digital product by Mustapha Ukizuru with practical implementation value, structured delivery, and immediate access after purchase."
  }
  return cleaned.length > 160 ? `${cleaned.slice(0, 157)}...` : cleaned
}

/* 1234 -> "1.2k+", 12345 -> "12k+", 1234567 -> "1.2m+" */
export function formatCountAbbrev(value) {
  const n = Number(value || 0)
  if (n < 1000) return n.toString()
  if (n < 10000) return `${(n / 1000).toFixed(1)}k+`
  if (n < 1000000) return `${Math.floor(n / 1000)}k+`
  if (n < 10000000) return `${(n / 1000000).toFixed(1)}m+`
  return `${Math.floor(n / 1000000)}m+`
}

/* Relative for < 30 days, otherwise locale "Mon YYYY". "" when invalid. */
export function formatUpdatedDate(value, t, locale = "en-US") {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  const diffDays = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000))
  if (diffDays < 0) return ""
  if (diffDays === 0) return t ? t("dates.today") : "today"
  if (diffDays === 1) return t ? t("dates.yesterday") : "yesterday"
  if (diffDays < 7) return t ? t("dates.daysAgo", { count: diffDays }) : `${diffDays} days ago`
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return t ? t("dates.weeksAgo", { count: weeks }) : `${weeks} weeks ago`
  }
  return date.toLocaleDateString(locale, { month: "short", year: "numeric" })
}

export function validFaqs(faqs) {
  if (!Array.isArray(faqs)) return []
  return faqs.filter(
    (f) => f && typeof f.question === "string" && typeof f.answer === "string" &&
           f.question.trim() && f.answer.trim(),
  )
}

/**
 * Product + Breadcrumb + (optional) FAQPage JSON-LD for <Seo>.
 */
export function buildJsonLd({ product, images, slug, price, canonicalUrl, categoryFallback }) {
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    image: images.map((img) => img.url),
    description: stripHtml(product.description || product.shortDescription || ""),
    category: product.category || categoryFallback,
    sku: product.sku || product.slug || slug,
    brand: { "@type": "Brand", name: "Mustapha Ukizuru" },
    url: canonicalUrl,
    offers: {
      "@type": "Offer",
      url: canonicalUrl,
      price: price.toFixed(2),
      priceCurrency: product.currency || "MXN",
      availability: product.isActive === false
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
    },
    // Only emit aggregateRating when reviews exist (Google rejects 0-count).
    ...(Number(product.reviewCount) > 0 && Number(product.rating) > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(product.rating).toFixed(1),
            reviewCount: Number(product.reviewCount),
            bestRating: "5",
            worstRating: "1",
          },
        }
      : {}),
  }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Store", item: "https://mustaphaukizuru.com/store" },
      { "@type": "ListItem", position: 2, name: product.category || "Product" },
      { "@type": "ListItem", position: 3, name: product.title, item: canonicalUrl },
    ],
  }

  const faqRows = validFaqs(product.productFaqs)
  const faqJsonLd = faqRows.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqRows.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      }
    : null

  return [productJsonLd, breadcrumbJsonLd, faqJsonLd].filter(Boolean)
}
