import { siteConfig } from "../siteSeo"

/**
 * Review — schema.org/Review (per-review, used for top product reviews).
 */
export function reviewSchema(review = {}) {
  if (!review || !review.rating) return null
  return {
    "@context": "https://schema.org",
    "@type": "Review",
    reviewRating: {
      "@type": "Rating",
      ratingValue: Number(review.rating).toFixed(1),
      bestRating: "5",
      worstRating: "1",
    },
    author: {
      "@type": "Person",
      name: review.user?.fullName || review.authorName || "Verified buyer",
    },
    reviewBody: review.reviewText || review.body || "",
    datePublished: review.createdAt || review.publishedAt || undefined,
    publisher: {
      "@type": "Organization",
      name: siteConfig.organization.name,
      url: siteConfig.organization.url,
    },
  }
}
