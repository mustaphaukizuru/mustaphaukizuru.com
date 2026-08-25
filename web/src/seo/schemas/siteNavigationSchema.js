import { absoluteUrl, siteConfig } from "../siteSeo"

/**
 * SiteNavigationElement — helps Google generate sitelinks.
 *
 * Pass an array of top-level navigation items. Names should match the
 * canonical anchor text in the header/footer (for signal consistency).
 */
const DEFAULT_NAV = [
  { name: "Home",      path: "/" },
  { name: "About",     path: "/about" },
  { name: "Services",  path: "/services" },
  { name: "Store",     path: "/store" },
  { name: "Portfolio", path: "/portfolio" },
  { name: "Blog",      path: "/blog" },
  { name: "Contact",   path: "/contact" },
]

export function siteNavigationSchema(items = DEFAULT_NAV) {
  return {
    "@context": "https://schema.org",
    "@type": "SiteNavigationElement",
    name: items.map((i) => i.name),
    url:  items.map((i) => absoluteUrl(i.path)),
    isPartOf: {
      "@type": "WebSite",
      name: siteConfig.siteName,
      url: siteConfig.siteUrl,
    },
  }
}
