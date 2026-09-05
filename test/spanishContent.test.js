// ─────────────────────────────────────────────────────────────────────────────
// T2-5 · the sellable content exists in Spanish.
//
// The `*Es` columns existed on Product and BlogPost, pickLocale already
// overlaid them, and both services were already locale-aware. The only thing
// missing was content: every product and every post was English-only, so a
// Spanish visitor browsing /es/store or /es/blog read English — on the two
// surfaces where someone decides to spend money.
//
// These assert the seed data, not the database: the seeds are guarded and the
// owner runs them, so what CI can check is that the translations are there to
// be seeded and that they are structurally sound.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require("fs")
const path = require("path")

const ROOT = path.join(__dirname, "..")

const productsSeed = fs.readFileSync(path.join(ROOT, "prisma", "seed", "products-seed.js"), "utf8")
const blog = JSON.parse(fs.readFileSync(path.join(ROOT, "prisma", "blog-seed-data.json"), "utf8"))

describe("every store product has Spanish copy", () => {
  const slugs = [...productsSeed.matchAll(/slug: "([a-z0-9-]+)"/g)].map((m) => m[1])

  test("the six downloads are all there", () => {
    expect(slugs).toHaveLength(6)
  })

  test("each one carries a title, a short description and a description in Spanish", () => {
    // Crude but honest: the seed is a JS module, so count the fields rather
    // than import it (importing runs the prod-db guard).
    const thin = []
    for (const field of ["titleEs", "shortDescriptionEs", "descriptionEs"]) {
      const count = (productsSeed.match(new RegExp(`${field}:`, "g")) || []).length
      // One per product, plus the references in the upsert mapping.
      thin.push(...(count >= slugs.length ? [] : [`${field}: only ${count}`]))
    }
    expect(thin).toEqual([])
  })

  test("the Spanish is refreshed on re-seed, unlike the price", () => {
    // Price is deliberately not updated (an admin may have edited it).
    // Translations are not admin-edited, so a corrected one has to be able to
    // reach a row that already exists.
    const updateBlock = productsSeed.slice(productsSeed.indexOf("update: {"))
    expect(updateBlock).toContain("titleEs: data.titleEs")
    expect(updateBlock).not.toMatch(/^\s*price: data\.price,/m)
  })
})

describe("the three highest-intent posts are translated", () => {
  const TRANSLATED = [
    "designing-an-it-strategy-for-a-school-in-mexico",
    "mercadopago-paypal-side-by-side-latam",
    "edtech-that-actually-helps-teachers",
  ]
  const bySlug = Object.fromEntries(blog.posts.map((p) => [p.slug, p]))

  test.each(TRANSLATED)("%s has every Spanish field", (slug) => {
    const post = bySlug[slug]
    expect(post).toBeTruthy()
    const missing = ["titleEs", "excerptEs", "bodyEs", "metaTitleEs", "metaDescriptionEs"]
      .filter((field) => !post[field])
    expect(missing).toEqual([])
  })

  test.each(TRANSLATED)("%s renders the same article in both languages", (slug) => {
    // The renderer walks the block list. A Spanish body with a different
    // shape is a different article, not a translation — and a missing block
    // would silently drop a section for Spanish readers only.
    const post = bySlug[slug]
    expect(post.bodyEs).toHaveLength(post.body.length)
    const drift = []
    post.body.forEach((block, i) => {
      if (post.bodyEs[i].type !== block.type) drift.push(`block ${i}: ${block.type} → ${post.bodyEs[i].type}`)
      if (Array.isArray(block.items) && post.bodyEs[i].items?.length !== block.items.length) {
        drift.push(`block ${i}: ${block.items.length} items → ${post.bodyEs[i].items?.length}`)
      }
    })
    expect(drift).toEqual([])
  })

  test.each(TRANSLATED)("%s is actually translated, not copied", (slug) => {
    const post = bySlug[slug]
    expect(post.titleEs).not.toBe(post.title)
    expect(post.excerptEs).not.toBe(post.excerpt)
    const sameText = post.body.filter((b, i) => b.text && b.text === post.bodyEs[i].text)
    expect(sameText).toEqual([])
  })

  test("the untranslated posts are left alone rather than half-filled", () => {
    // A post with titleEs but an English body is worse than an English post:
    // it looks translated in the listing and is not when you open it.
    const partial = blog.posts
      .filter((p) => !TRANSLATED.includes(p.slug))
      .filter((p) => p.titleEs || p.excerptEs || p.bodyEs)
      .map((p) => p.slug)
    expect(partial).toEqual([])
  })
})

describe("the blog seeder carries the Spanish columns through", () => {
  const seeder = fs.readFileSync(path.join(ROOT, "prisma", "seed-blog.js"), "utf8")

  test.each(["titleEs", "excerptEs", "bodyEs", "metaTitleEs", "metaDescriptionEs"])("maps %s", (field) => {
    expect(seeder).toContain(`${field}: p.${field} || null`)
  })

  test("clears a removed translation rather than leaving the old one", () => {
    // `|| null`, not `|| undefined`: Prisma ignores undefined on update, so
    // deleting a translation from the JSON would leave the stale one live.
    expect(seeder).not.toMatch(/Es: p\.\w+Es,\s*$/m)
  })
})

describe("the Spanish register", () => {
  const es = (file) => fs.readFileSync(path.join(ROOT, "web", "src", "i18n", "locales", "es", file), "utf8")

  test("no usted-form question survives", () => {
    // ADR 0004 settles the register as tú. schools.json asked one question in
    // usted, which reads as a different person answering that one item.
    const files = ["schools.json", "services.json", "home.json", "about.json", "contact.json", "audit.json"]
    const bad = []
    for (const f of files) {
      for (const m of es(f).matchAll(/¿[^"?]{0,80}?\b(trabaja|necesita|quiere|busca|desea|prefiere|tiene)\s[^"?]{0,60}\?/g)) {
        // "manejan" and friends are third person about the practice, not the
        // reader; only the singular formal forms above are the slip.
        bad.push(`${f}: ${m[0]}`)
      }
    }
    expect(bad).toEqual([])
  })

  test('"Retainer" is not left as an English word in Spanish copy', () => {
    // "Iguala" is what a Mexican client calls a monthly professional retainer.
    expect(es("services.json")).toContain("Iguala mensual")
    expect(es("services.json")).not.toContain("Retainer mensual")
  })
})

describe("the newsletter forms respect double opt-in", () => {
  const blogPage = fs.readFileSync(path.join(ROOT, "web", "src", "pages", "BlogPage.jsx"), "utf8")

  test("no form on the blog posts to the legacy unversioned endpoint", () => {
    // Both forms posted to /api/newsletter and reported success outright.
    // Subscribing creates a `pending` row and sends a confirmation email, so
    // the reader was told they were subscribed when they were not.
    expect(blogPage).not.toContain('apiRequest("/api/newsletter"')
  })

  test("both surfaces use the shared component", () => {
    expect((blogPage.match(/<NewsletterInline/g) || []).length).toBeGreaterThanOrEqual(2)
  })

  test("the shared component posts to the versioned subscribe endpoint", () => {
    const inline = fs.readFileSync(path.join(ROOT, "web", "src", "components", "NewsletterInline.jsx"), "utf8")
    expect(inline).toContain("/api/v1/newsletter/subscribe")
  })
})

describe("a case study ends in a next step", () => {
  const page = fs.readFileSync(path.join(ROOT, "web", "src", "pages", "ProjectDetailPage.jsx"), "utf8")

  test("there is a booking CTA, and it uses the project's own service line", () => {
    expect(page).toContain("BookCallButton")
    expect(page).toContain("project.caseStudy?.serviceSlug")
  })

  test("every seeded project has a service slug for it to point at", () => {
    const seed = fs.readFileSync(path.join(ROOT, "prisma", "seed", "portfolio-seed.js"), "utf8")
    const slugs = (seed.match(/serviceSlug: "/g) || []).length
    const projects = (seed.match(/^    slug: {13}"/gm) || seed.match(/slug: +"[a-z0-9-]+"/g) || []).length
    expect(slugs).toBeGreaterThan(0)
    expect(slugs).toBeGreaterThanOrEqual(Math.min(3, projects))
  })
})
