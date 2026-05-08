import { absoluteUrl, siteConfig } from "../siteSeo"

/**
 * Service — schema.org/Service
 *
 * For both the catalogue (Service[]) and detail page (single Service).
 * If multiple ServicePackage offers exist, emit AggregateOffer; else Offer.
 */
export function serviceSchema(service = {}, pathname = "") {
  if (!service || !service.title) return null

  const url = absoluteUrl(pathname || `/services/${service.slug || ""}`)
  const packages = Array.isArray(service.packages) ? service.packages : []
  const prices = packages
    .map((p) => Number(p.priceFromUsd || p.priceFromMxn || p.price || 0))
    .filter((n) => n > 0)

  let offers
  if (packages.length > 1 && prices.length > 0) {
    offers = {
      "@type": "AggregateOffer",
      priceCurrency: packages[0]?.currency || "USD",
      lowPrice: Math.min(...prices).toFixed(2),
      highPrice: Math.max(...prices).toFixed(2),
      offerCount: packages.length,
      url,
    }
  } else if (packages.length === 1 || prices.length === 1) {
    const p = packages[0] || {}
    offers = {
      "@type": "Offer",
      priceCurrency: p.currency || "USD",
      price: (prices[0] || 0).toFixed(2),
      availability: "https://schema.org/InStock",
      url,
    }
  }

  return {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: service.serviceType || service.title,
    name: service.title,
    description: service.description || service.shortDescription || siteConfig.defaultDescription,
    url,
    provider: {
      "@type": "Person",
      name: siteConfig.person.name,
      url: siteConfig.person.url,
    },
    areaServed: ["MX", "US", "RW", "TR", "Worldwide"],
    ...(offers ? { offers } : {}),
  }
}
