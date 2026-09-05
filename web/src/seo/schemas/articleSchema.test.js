/**
 * BlogPosting structured data (T2-6).
 *
 * The previous version was assembled by hand inside a useEffect and appended
 * to document.head — outside the Seo component that owns every other schema
 * on the site, so it was never reviewed alongside them and drifted: the
 * publisher was "MUSTAPHA UKIZURU" in capitals rather than the brand as
 * siteConfig spells it, and there was no dateModified and no inLanguage.
 *
 * inLanguage is the one that actually costs something here. The same slug
 * serves /blog/x and /es/blog/x with different bodies, so a crawler with no
 * language declaration has two documents claiming to be the same article.
 */
import { describe, expect, it } from "vitest"

import { articleSchema } from "./articleSchema"
import { SITE_URL, siteConfig } from "../siteSeo.js"

const post = {
  slug: "designing-an-it-strategy-for-a-school-in-mexico",
  title: "Designing an IT strategy for a Mexican school in 90 days",
  excerpt: "What changed when a school went from ad-hoc IT to a documented strategy.",
  cover: "/blog/covers/school-it.avif",
  publishedAt: "2026-04-08T09:00:00.000Z",
  updatedAt: "2026-09-04T12:00:00.000Z",
  readMinutes: 7,
  category: "strategy",
  tags: ["schools", "it-strategy"],
  author: { name: "Mustapha Ukizuru", role: "IT Manager" },
}

describe("the shape Google reads", () => {
  const schema = articleSchema(post)

  it("is a BlogPosting with the fields a rich result needs", () => {
    expect(schema["@type"]).toBe("BlogPosting")
    expect(schema.headline).toBe(post.title)
    expect(schema.description).toBe(post.excerpt)
    expect(schema.datePublished).toBe(post.publishedAt)
    expect(schema.image).toBe(`${SITE_URL}${post.cover}`)
  })

  it("declares dateModified even when nothing has changed", () => {
    // Omitting it asserts the article has never been revised, which is a
    // different claim from "revised when published".
    expect(schema.dateModified).toBe(post.updatedAt)
    const never = articleSchema({ ...post, updatedAt: null })
    expect(never.dateModified).toBe(post.publishedAt)
  })

  it("names the publisher as the brand does, not in capitals", () => {
    expect(schema.publisher.name).toBe(siteConfig.organization.name)
    expect(schema.publisher.name).not.toBe("MUSTAPHA UKIZURU")
    expect(schema.publisher.logo.url).toBe(siteConfig.organization.logo)
  })

  it("points url and mainEntityOfPage at the same page", () => {
    expect(schema.url).toBe(`${SITE_URL}/blog/${post.slug}`)
    expect(schema.mainEntityOfPage["@id"]).toBe(schema.url)
  })
})

describe("language", () => {
  it("declares en-US and the English URL by default", () => {
    const schema = articleSchema(post)
    expect(schema.inLanguage).toBe("en-US")
    expect(schema.url).not.toContain("/es/")
  })

  it("declares es-MX and the Spanish URL for the Spanish rendering", () => {
    const schema = articleSchema(post, { lang: "es" })
    expect(schema.inLanguage).toBe("es-MX")
    expect(schema.url).toBe(`${SITE_URL}/es/blog/${post.slug}`)
    expect(schema.mainEntityOfPage["@id"]).toBe(schema.url)
  })
})

describe("optional fields are omitted rather than emitted empty", () => {
  it("drops keywords, articleSection and timeRequired when absent", () => {
    const bare = articleSchema({ ...post, tags: [], category: null, readMinutes: null })
    expect(bare).not.toHaveProperty("keywords")
    expect(bare).not.toHaveProperty("articleSection")
    expect(bare).not.toHaveProperty("timeRequired")
  })

  it("emits them when present, in the shapes schema.org expects", () => {
    const schema = articleSchema(post)
    expect(schema.keywords).toBe("schools, it-strategy")
    expect(schema.articleSection).toBe("strategy")
    // ISO 8601 duration, not "7 min".
    expect(schema.timeRequired).toBe("PT7M")
  })

  it("falls back to the default image rather than emitting a relative one", () => {
    // A relative image URL in structured data is ignored by every consumer.
    const schema = articleSchema({ ...post, cover: null })
    expect(schema.image).toMatch(/^https?:\/\//)
  })

  it("keeps an already-absolute cover as it is", () => {
    const schema = articleSchema({ ...post, cover: "https://cdn.test/a.png" })
    expect(schema.image).toBe("https://cdn.test/a.png")
  })
})

describe("it refuses to invent a post", () => {
  it.each([null, undefined, {}, { slug: "x" }, { title: "y" }])("%j returns null", (bad) => {
    expect(articleSchema(bad)).toBeNull()
  })
})
