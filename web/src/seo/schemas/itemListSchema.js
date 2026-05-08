import { absoluteUrl } from "../siteSeo"

/**
 * ItemList — schema.org/ItemList wrapped in a CollectionPage.
 *
 *   itemListSchema(
 *     items = [{ name, url, image? }, ...],
 *     { name: "All Products", description: "...", pathname: "/store", type: "Product" }
 *   )
 */
export function itemListSchema(items = [], opts = {}) {
  if (!Array.isArray(items) || items.length === 0) return null

  const itemListElement = items.slice(0, 50).map((it, i) => ({
    "@type": "ListItem",
    position: i + 1,
    url: it.url?.startsWith("http") ? it.url : absoluteUrl(it.url || "/"),
    name: it.name,
    ...(it.image ? { image: it.image } : {}),
  }))

  if (opts.wrapAsCollectionPage === false) {
    return {
      "@context": "https://schema.org",
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement,
    }
  }

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    url: opts.pathname ? absoluteUrl(opts.pathname) : undefined,
    name: opts.name,
    description: opts.description,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListType: opts.type || undefined,
      itemListElement,
    },
  }
}
