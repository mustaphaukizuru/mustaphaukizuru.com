#!/usr/bin/env node
/**
 * generate-og-static.mjs · build-time Open Graph metadata for STATIC pages.
 *
 * src/middleware/ogInjector.js already rewrites the meta tags for the four
 * detail kinds — /store/:slug, /blog/:slug, /services/:slug, /projects/:slug,
 * and their /es mirrors — by looking the entity up in the database. Every
 * other page falls straight through to next(), so a crawler asking for the
 * home page, /about, /services, /schools, /contact, /self-audit, /book or any
 * legal page gets the single generic card baked into index.html. The SPA has
 * per-page titles and descriptions for all of them (src/seo/pageSeo.js, and
 * Spanish in pageSeoEs.js) — crawlers just never run the SPA, so none of it
 * was ever seen. Sharing the home page in a Spanish-speaking Slack showed an
 * English generic card.
 *
 * There is no database row to look up for a static page, so this emits the
 * same metadata as a flat JSON map at build time and the injector serves it
 * from memory. That also means it costs no query and cannot time out.
 *
 * Output: public/og-static.json, mirrored into ../public.
 *
 *   { "/about": { title, description, image, type }, "/es/about": { … } }
 *
 * The mirror matters for the same reason it does in generate-sitemap.mjs:
 * `build:seo` runs this AFTER vite has already copied web/public into
 * ../public, so writing only to web/public reaches the served build one
 * deploy late.
 */
import fs from "node:fs/promises"
import path from "node:path"

import { staticSeoByRoute } from "../src/seo/pageSeo.js"
import { staticSeoEsByRoute } from "../src/seo/pageSeoEs.js"
import { DEFAULT_OG_IMAGE, SITE_URL } from "../src/seo/siteSeo.js"
import { isI18nEnabled } from "../src/i18n/i18nEnabled.js"

const I18N_ENABLED = isI18nEnabled(process.env.VITE_I18N_ENABLED)

/* Routes that must NOT get a share card. These are operator surfaces, auth
   screens and one-shot states — they are noindex, several are behind a
   guard, and a rich card for /admin or /reset-password is at best noise and
   at worst a leak of what the tree contains. Anything not listed here is a
   public page and gets a card. */
const PRIVATE = new Set([
  "/login", "/signup", "/forgot-password", "/reset-password",
  "/checkout", "/cart", "/dashboard", "/admin", "/portal",
  "/unsubscribed", "/_system",
  // T5-5 · noindex, and the /:code form carries a live code.
  "/track",
])

/* The detail routes the database-backed injector already owns. Listing a
   static card for these would shadow the real per-entity metadata. The four
   /services/<category> pages are NOT in this set: they are fixed catalogue
   pages with hand-written SEO, not database entities. */
const DYNAMIC_PREFIXES = ["/store/", "/blog/", "/projects/"]

const isPublic = (route) =>
  !PRIVATE.has(route) && !DYNAMIC_PREFIXES.some((p) => route.startsWith(p))

/** Absolute URL for an image that may already be absolute. */
function absolute(image) {
  const v = String(image || "").trim()
  if (!v) return DEFAULT_OG_IMAGE
  if (/^https?:\/\//i.test(v)) return v
  return `${SITE_URL}${v.startsWith("/") ? "" : "/"}${v}`
}

function card(entry) {
  return {
    title: String(entry.title || "").trim(),
    description: String(entry.description || "").trim(),
    image: absolute(entry.image),
    type: entry.type || "website",
  }
}

async function main() {
  const out = {}

  for (const [route, entry] of Object.entries(staticSeoByRoute)) {
    if (!isPublic(route)) continue
    out[route] = card(entry)
  }

  if (I18N_ENABLED) {
    for (const [route, entry] of Object.entries(staticSeoByRoute)) {
      if (!isPublic(route)) continue
      // Spanish merges ON TOP of English, exactly as SeoRouteManager does at
      // runtime, so a Spanish page with no Spanish description still gets the
      // English one rather than nothing. /self-audit is the live example —
      // it is English-only in pageSeoEs.js.
      const es = staticSeoEsByRoute[route] || {}
      const esRoute = route === "/" ? "/es" : `/es${route}`
      out[esRoute] = card({ ...entry, ...es })
    }
  }

  const json = `${JSON.stringify(out, null, 2)}\n`
  const targets = [
    path.resolve(process.cwd(), "public", "og-static.json"),
    path.resolve(process.cwd(), "..", "public", "og-static.json"),
  ]

  let written = 0
  for (const target of targets) {
    try {
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.writeFile(target, json, "utf8")
      written += 1
      console.log(`[og-static] wrote ${target}`)
    } catch (err) {
      // The ../public mirror only exists inside the repo. Never fail a build
      // over it; the sitemap script takes the same line.
      console.warn(`[og-static] could not write ${target}: ${err.message}`)
    }
  }

  if (!written) {
    console.error("[og-static] wrote nothing — the injector will fall back to the generic card")
    process.exitCode = 1
    return
  }

  const routes = Object.keys(out)
  const es = routes.filter((r) => r.startsWith("/es")).length
  console.log(`[og-static] ${routes.length} cards (${routes.length - es} en, ${es} es)`)
}

main().catch((err) => {
  console.error(`[og-static] failed: ${err.stack || err.message}`)
  process.exitCode = 1
})
