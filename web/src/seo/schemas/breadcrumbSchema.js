import { absoluteUrl } from "../siteSeo"

/**
 * BreadcrumbList — schema.org/BreadcrumbList
 *
 * Pass an ordered array of crumbs from the site root to the current page.
 * The Seo component already auto-generates a BreadcrumbList from the
 * pathname; use this builder when you need precise control over names
 * (e.g. when the URL slug doesn't match the human label).
 *
 *   breadcrumbSchema([
 *     { name: "Home",    url: "/" },
 *     { name: "Store",   url: "/store" },
 *     { name: "Toolkits", url: "/store?category=toolkits" },
 *     { name: "School AI Automation Kit", url: "/store/school-ai-automation-kit" },
 *   ])
 */
export function breadcrumbSchema(items = []) {
  if (!Array.isArray(items) || items.length === 0) return null
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.url?.startsWith("http") ? c.url : absoluteUrl(c.url || "/"),
    })),
  }
}
