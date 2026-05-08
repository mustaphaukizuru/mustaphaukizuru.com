import { absoluteUrl, siteConfig } from "../siteSeo"

/**
 * CreativeWork — for portfolio detail pages.
 *
 *   creativeWorkSchema(portfolio, "/projects/<slug>")
 */
export function creativeWorkSchema(portfolio = {}, pathname = "") {
  if (!portfolio || !portfolio.title) return null
  const url = absoluteUrl(pathname || `/projects/${portfolio.slug || ""}`)
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: portfolio.title,
    headline: portfolio.title,
    description: portfolio.shortDescription || portfolio.description || "",
    url,
    image: portfolio.coverImage
      ? (/^https?:\/\//i.test(portfolio.coverImage) ? portfolio.coverImage : absoluteUrl(portfolio.coverImage))
      : undefined,
    author: {
      "@type": "Person",
      name: siteConfig.person.name,
      url: siteConfig.person.url,
    },
    publisher: {
      "@type": "Organization",
      name: siteConfig.organization.name,
      url: siteConfig.organization.url,
      logo: { "@type": "ImageObject", url: siteConfig.organization.logo },
    },
    keywords: Array.isArray(portfolio.tags) ? portfolio.tags.join(", ") : portfolio.tags || undefined,
    datePublished: portfolio.publishedAt || portfolio.createdAt || undefined,
    dateModified: portfolio.updatedAt || undefined,
    inLanguage: "en",
  }
}
