/**
 * BlogPosting — schema.org/BlogPosting for a blog article (T2-6).
 *
 *   articleSchema(post, { lang: "es" })
 *
 * Replaces an ad-hoc block that BlogPostPage built by hand in a useEffect and
 * appended to document.head. That worked, but it sat outside the Seo
 * component that owns every other piece of structured data on the site, so it
 * could not be reviewed alongside them and drifted: it named the publisher
 * "MUSTAPHA UKIZURU" in capitals rather than the brand as siteConfig spells
 * it, and it declared no `dateModified` and no `inLanguage` — the second of
 * which matters here more than usual, because the same slug serves English
 * and Spanish and a crawler has to be told which it is looking at.
 */
import { DEFAULT_OG_IMAGE, SITE_URL, siteConfig } from "../siteSeo.js"

const absolute = (value) => {
  const v = String(value || "").trim()
  if (!v) return DEFAULT_OG_IMAGE
  if (/^https?:\/\//i.test(v)) return v
  return `${SITE_URL}${v.startsWith("/") ? "" : "/"}${v}`
}

/**
 * @param {object} post  a serialized post (blogService.serializePost)
 * @param {{ lang?: "en"|"es" }} [options]
 */
export function articleSchema(post, { lang = "en" } = {}) {
  if (!post || !post.slug || !post.title) return null

  const path = `${lang === "es" ? "/es" : ""}/blog/${post.slug}`
  const url = `${SITE_URL}${path}`

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt || undefined,
    inLanguage: lang === "es" ? "es-MX" : "en-US",
    datePublished: post.publishedAt || undefined,
    // Present even when it equals datePublished: omitting it asserts the
    // article has never been revised, which is a different claim.
    dateModified: post.updatedAt || post.publishedAt || undefined,
    image: absolute(post.cover),
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: {
      "@type": "Person",
      name: post.author?.name || siteConfig.person.name,
      jobTitle: post.author?.role || undefined,
      url: siteConfig.person.url,
    },
    publisher: {
      "@type": "Organization",
      name: siteConfig.organization.name,
      url: siteConfig.organization.url,
      logo: {
        "@type": "ImageObject",
        url: siteConfig.organization.logo,
      },
    },
    // Only when the post actually has them: an empty keywords string is worse
    // than none, and `articleSection` naming a category that does not exist
    // is a claim about taxonomy nobody can check.
    ...(post.category ? { articleSection: post.category } : {}),
    ...(Array.isArray(post.tags) && post.tags.length ? { keywords: post.tags.join(", ") } : {}),
    ...(post.readMinutes ? { timeRequired: `PT${post.readMinutes}M` } : {}),
  }
}

export default articleSchema
