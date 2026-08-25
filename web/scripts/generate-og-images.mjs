/**
 * generate-og-images.mjs · OG cards + social banners (sharp + SVG, no browser)
 *
 * Usage (from web/):
 *   npm run og:build                                   # static route cards + social set
 *   node scripts/generate-og-images.mjs --from-json entities.json
 *                                                      # dynamic cards → og/<type>/<slug>.png
 *
 * entities.json shape:
 *   [{ "type": "store"|"blog"|"services"|"projects", "slug": "my-slug",
 *      "title": "…", "subtitle": "…" (optional), "eyebrow": "…" (optional) }]
 *
 * Fonts: Sora is resolved through fontconfig (librsvg ignores @font-face and
 * FreeType cannot read the site's WOFF2). scripts/og/fonts/ bundles the
 * static Sora TTFs so output is identical on any machine — see og/fonts.mjs.
 * Output PNGs are kept ≤ 200 kB (og/render.mjs).
 */
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { setupFonts, probeSora } from "./og/fonts.mjs"
import { renderPng, renderJpg } from "./og/render.mjs"
import { ogCard, wideBanner, postBanner, squareBanner, SITE } from "./og/templates.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_OG = path.resolve(__dirname, "..", "public", "og")

/* ─── static routes (mirror of web/src/seo/pageSeo.js) ───────────────── */
const STATIC = [
  { file: "og-default.png", eyebrow: "Home", title: "Technology consulting, digital products & STEM solutions.", subtitle: "Full-stack delivery for businesses and schools. Mexico · LATAM · Worldwide.", accent: true },
  { file: "og-profile.png", eyebrow: "About", title: "Mustapha Ukizuru — Full-Stack Developer & IT Manager.", subtitle: "6+ years across Rwanda, Turkey, Ethiopia and Mexico. Available for new projects." },
  { file: "og-services.png", eyebrow: "Services", title: "IT strategy · AI & automation · Cloud · Product engineering.", subtitle: "Premium delivery, honest pricing. Consulting for businesses and schools." },
  { file: "og-store.png", eyebrow: "Store", title: "Digital products for schools & SMBs.", subtitle: "Templates · Toolkits · STEM resources · Instant download · PayPal & MercadoPago", accent: true },
  { file: "og-portfolio.png", eyebrow: "Portfolio", title: "Selected projects, shipped with intent.", subtitle: "School IT transformations · Custom websites · Educational platforms · Product launches", jpgAlias: "og-portfolio.jpg" },
  { file: "og-contact.png", eyebrow: "Contact", title: "Let's talk about your next project.", subtitle: "Based in Mexico · Responds within 24 hours", jpgAlias: "og-contact.jpg" },
  { file: "og-blog.png", eyebrow: "Blog", title: "Field notes on IT, full-stack, EdTech & STEM.", subtitle: "Written from Mexico by way of Rwanda." },
  { file: "og-book.png", eyebrow: "Book a call", title: "Free 30-minute discovery call.", subtitle: "IT consulting · Full-stack development · School technology · STEM programs", accent: true },
  { file: "og-terms.png", eyebrow: "Legal", title: "Terms of Service.", subtitle: SITE.domain },
  { file: "og-privacy.png", eyebrow: "Legal", title: "Privacy Policy.", subtitle: SITE.domain },
  { file: "og-refund.png", eyebrow: "Legal", title: "Refund Policy — 30-day guarantee.", subtitle: SITE.domain },
  { file: "og-cookies.png", eyebrow: "Legal", title: "Cookie Policy.", subtitle: SITE.domain },
]

/* ─── social banner set ──────────────────────────────────────────────── */
const SOCIAL = [
  { file: "social/linkedin-banner-1584x396.png", svg: () => wideBanner(1584, 396, { avatarInset: 0.3 }) },
  { file: "social/x-header-1500x500.png", svg: () => wideBanner(1500, 500, { avatarInset: 0.26 }) },
  { file: "social/linkedin-post-1200x627.png", svg: () => postBanner() },
  { file: "social/instagram-1080x1080.png", svg: () => squareBanner() },
]

const ENTITY_EYEBROW = { store: "Store", blog: "Blog", services: "Services", projects: "Case study" }
const ENTITY_TYPES = new Set(Object.keys(ENTITY_EYEBROW))
const SLUG_RE = /^[a-z0-9][a-z0-9._-]*$/i

/** Exported for build steps: renders one entity card to <outDir>/<type>/<slug>.png. */
export async function renderEntityCard(sharp, { type, slug, title, subtitle, eyebrow }, outDir = PUBLIC_OG) {
  if (!ENTITY_TYPES.has(type)) throw new Error(`unknown entity type "${type}"`)
  if (!SLUG_RE.test(String(slug)) || String(slug).includes("..")) throw new Error(`unsafe slug "${slug}"`)
  const svg = ogCard({ title: title || SITE.name, eyebrow: eyebrow || ENTITY_EYEBROW[type], subtitle: subtitle || SITE.tagline })
  const out = path.join(outDir, type, `${slug}.png`)
  const res = await renderPng(sharp, svg, out)
  return { file: path.relative(outDir, out).replace(/\\/g, "/"), ...res }
}

function log(file, bytes, overBudget) {
  const kb = (bytes / 1024).toFixed(1).padStart(6)
  console.log(`  ${overBudget ? "!" : "✓"} ${file.padEnd(40)} ${kb} KB${overBudget ? "  (over 200 kB budget)" : ""}`)
}

async function main() {
  const args = process.argv.slice(2)
  const jsonIdx = args.indexOf("--from-json")

  const { confPath, preset } = await setupFonts()
  const { default: sharp } = await import("sharp")
  const probe = await probeSora(sharp)
  console.log(`fonts: ${preset ? "using preset FONTCONFIG_FILE" : "fontconfig → " + confPath}`)
  if (probe.ok) console.log("fonts: Sora resolved via fontconfig (bundled/system TTF)")
  else console.warn("fonts: WARNING — Sora not found; text falls back to generic sans-serif")

  await fs.mkdir(PUBLIC_OG, { recursive: true })

  if (jsonIdx !== -1) {
    const file = args[jsonIdx + 1]
    if (!file) throw new Error("--from-json requires a file path")
    const entities = JSON.parse(await fs.readFile(path.resolve(file), "utf8"))
    if (!Array.isArray(entities)) throw new Error("JSON must be an array of entities")
    for (const e of entities) {
      const r = await renderEntityCard(sharp, e)
      log(r.file, r.bytes, r.overBudget)
    }
    console.log(`\nDone — ${entities.length} entity card(s) written under ${PUBLIC_OG}`)
    return
  }

  // Obsolete asset from the removed Solutions page.
  await fs.rm(path.join(PUBLIC_OG, "og-solutions.png"), { force: true })

  for (const t of STATIC) {
    const svg = ogCard(t)
    const r = await renderPng(sharp, svg, path.join(PUBLIC_OG, t.file))
    log(t.file, r.bytes, r.overBudget)
    if (t.jpgAlias) { // pageSeo.js still references these .jpg names
      const j = await renderJpg(sharp, svg, path.join(PUBLIC_OG, t.jpgAlias))
      log(t.jpgAlias, j.bytes, false)
    }
  }
  for (const s of SOCIAL) {
    const r = await renderPng(sharp, s.svg(), path.join(PUBLIC_OG, s.file))
    log(s.file, r.bytes, r.overBudget)
  }
  console.log(`\nDone — ${STATIC.length} OG cards + ${SOCIAL.length} social banners written to ${PUBLIC_OG}`)
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isCli) main().catch((err) => { console.error("[og-images] failed", err); process.exit(1) })
