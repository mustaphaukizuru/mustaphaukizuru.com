/**
 * generate-product-covers.mjs · square cover art for the 9 store products
 *
 * Usage (from web/):
 *   npm run covers:build
 *
 * Output: public/images/products/<slug>/cover.png  (1200×1200, ≤200 kB)
 *
 * WHY GENERATED RATHER THAN SOURCED
 * ---------------------------------
 * These are downloadable toolkits, checklists and planning packs — products
 * with no photograph of themselves. The storefront rendered every one with a
 * placeholder icon because `ProductImage` was empty and no product art existed
 * anywhere in the repo.
 *
 * Canva was tried first and produced a genuinely good *Instagram post*: 4:5
 * portrait, title pinned to the top edge, imagery at the bottom, marketing CTA
 * copy, and Canva's placeholder handle "@reallygreatsite" baked in. The product
 * Gallery renders `aspect-square`, so the square crop cut the title off. The
 * mismatch is structural, not a prompting problem — social-post generators
 * compose for a 4:5 feed, and a cover has to survive being cropped three ways.
 *
 * Generating them here instead means: one square master that crops cleanly into
 * all three frames the SPA uses (`aspect-square` on the detail Gallery,
 * `aspect-[4/3]` on Related, `aspect-[5/3]` on StoreHero), the real Brand v3
 * tokens rather than an approximation, no third-party licence attached to a
 * commercial storefront, and art that regenerates identically on any machine.
 *
 * Built on the existing OG pipeline (scripts/og/*): same bundled Sora fonts,
 * same sharp rasteriser, same 200 kB budget. Nothing new was invented here.
 *
 * SAFE-CROP RULE
 * --------------
 * A 5:3 crop of a square keeps only the middle 60% of its height. Everything
 * that must survive — eyebrow, title, rule — sits inside y 380–860. The brand
 * mark and domain line live outside that band on purpose: they are decoration,
 * and losing them in the widest crop costs nothing.
 */
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { setupFonts, probeSora } from "./og/fonts.mjs"
import { renderPng } from "./og/render.mjs"
import { T, SITE, defs, ground, brandMark, eyebrow, fitTitle, escapeXml } from "./og/templates.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/* Two destinations, on purpose.
 *
 * `web/public` is the SOURCE static directory: Vite serves it in dev, and
 * `vite build` copies it into `../public` with `emptyOutDir: true` — which
 * wipes the repo-root `public/` first. Writing only to the root copy (the
 * first attempt here) means the dev server returns the SPA fallback instead of
 * the image, and the next build deletes the files outright.
 *
 * The root copy is nonetheless committed in this repo — `public/images/projects`
 * and `web/public/images/projects` both carry the same 162 files — because
 * production serves the root directory through Express. So both are written,
 * matching how every other image in the project is stored. */
const OUT_SOURCE = path.resolve(__dirname, "..", "public", "images", "products")
const OUT_SERVED = path.resolve(__dirname, "..", "..", "public", "images", "products")

const W = 1200
const H = 1200
const PAD = 96
const SAFE_W = W - PAD * 2

/* ─── Motifs ──────────────────────────────────────────────────────────────
 * Each product gets its own glyph so a nine-card grid does not read as one
 * tile repeated. Drawn inside a 360×360 box at the origin; the caller
 * translates. Stroke-only, gold on violet, so they stay legible after the
 * palette quantisation renderPng applies to hit the byte budget.            */

const S = { stroke: T.gold, mist: T.mist }

const motifs = {
  /* stacked cards flowing into a node graph — transformation */
  workflow: () => `
    <g fill="none" stroke="${S.stroke}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
      <rect x="20" y="60" width="130" height="96" rx="14"/>
      <rect x="20" y="200" width="130" height="96" rx="14"/>
      <rect x="210" y="130" width="130" height="96" rx="14"/>
      <path d="M150 108 H182 Q196 108 196 130 V166"/>
      <path d="M150 248 H182 Q196 248 196 226 V196"/>
      <circle cx="196" cy="178" r="10" fill="${S.stroke}" stroke="none"/>
    </g>`,
  /* month grid with marked days */
  calendar: () => `
    <g fill="none" stroke="${S.stroke}" stroke-width="6" stroke-linecap="round">
      <rect x="30" y="60" width="300" height="250" rx="18"/>
      <path d="M30 130 H330"/>
      <path d="M105 40 V84 M255 40 V84"/>
      ${[0, 1, 2, 3].map((c) => [0, 1, 2].map((r) =>
        `<rect x="${64 + c * 62}" y="${160 + r * 46}" width="34" height="24" rx="6" ${(c + r) % 3 === 0 ? `fill="${S.stroke}" stroke="none"` : ""}/>`).join("")).join("")}
    </g>`,
  /* flask + orbit — STEM */
  stem: () => `
    <g fill="none" stroke="${S.stroke}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M148 50 V150 L82 268 Q70 292 96 292 H264 Q290 292 278 268 L212 150 V50"/>
      <path d="M130 50 H230"/>
      <path d="M104 232 H256"/>
      <circle cx="160" cy="252" r="12" fill="${S.stroke}" stroke="none"/>
      <circle cx="206" cy="266" r="8" fill="${S.stroke}" stroke="none"/>
      <ellipse cx="180" cy="170" rx="150" ry="58" transform="rotate(-24 180 170)" stroke-opacity="0.4"/>
    </g>`,
  /* ticked checklist */
  checklist: () => `
    <g fill="none" stroke="${S.stroke}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
      <rect x="40" y="40" width="280" height="290" rx="20"/>
      ${[0, 1, 2].map((i) => `
        <rect x="78" y="${96 + i * 78}" width="40" height="40" rx="10"/>
        ${i < 2 ? `<path d="M87 ${116 + i * 78} l10 11 l16 -20"/>` : ""}
        <path d="M142 ${116 + i * 78} H278" stroke-opacity="${i < 2 ? 0.95 : 0.45}"/>`).join("")}
    </g>`,
  /* browser chrome — website launch */
  browser: () => `
    <g fill="none" stroke="${S.stroke}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
      <rect x="30" y="60" width="300" height="240" rx="18"/>
      <path d="M30 126 H330"/>
      <circle cx="66" cy="93" r="8" fill="${S.stroke}" stroke="none"/>
      <circle cx="94" cy="93" r="8" fill="${S.stroke}" stroke="none"/>
      <circle cx="122" cy="93" r="8" fill="${S.stroke}" stroke="none"/>
      <path d="M70 168 H210 M70 206 H290 M70 244 H180"/>
      <path d="M232 232 l30 30 l52 -60" stroke-width="8"/>
    </g>`,
  /* interlocking flow arrows — optimisation */
  optimise: () => `
    <g fill="none" stroke="${S.stroke}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="180" cy="180" r="120"/>
      <path d="M180 60 a120 120 0 0 1 104 60"/>
      <path d="M262 104 l24 18 l-30 16" fill="${S.stroke}" stroke="none"/>
      <path d="M180 300 a120 120 0 0 1 -104 -60"/>
      <path d="M98 256 l-24 -18 l30 -16" fill="${S.stroke}" stroke="none"/>
      <path d="M132 180 h96 M180 132 v96" stroke-opacity="0.55"/>
    </g>`,
  /* two conversation bubbles — consulting session */
  session: () => `
    <g fill="none" stroke="${S.stroke}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M40 76 H236 Q262 76 262 102 V206 Q262 232 236 232 H130 L78 280 V232 H40 Q14 232 14 206 V102 Q14 76 40 76 Z" transform="translate(20,0)"/>
      <path d="M96 132 H210 M96 176 H176" stroke-opacity="0.8"/>
      <path d="M300 150 H196" stroke-opacity="0" />
      <circle cx="268" cy="262" r="52" stroke-opacity="0.45"/>
      <path d="M248 262 l14 14 l28 -32" stroke-opacity="0.75"/>
    </g>`,
  /* stacked layers — system setup */
  layers: () => `
    <g fill="none" stroke="${S.stroke}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M180 44 L330 116 L180 188 L30 116 Z"/>
      <path d="M30 180 L180 252 L330 180" stroke-opacity="0.7"/>
      <path d="M30 244 L180 316 L330 244" stroke-opacity="0.45"/>
    </g>`,
  /* server rack + gauge — infrastructure audit */
  infra: () => `
    <g fill="none" stroke="${S.stroke}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
      ${[0, 1, 2].map((i) => `
        <rect x="40" y="${52 + i * 92}" width="220" height="70" rx="14"/>
        <circle cx="80" cy="${87 + i * 92}" r="9" fill="${S.stroke}" stroke="none"/>
        <path d="M116 ${87 + i * 92} H228" stroke-opacity="0.6"/>`).join("")}
      <path d="M286 296 a72 72 0 1 0 -0.1 0" stroke-opacity="0.45"/>
      <path d="M286 296 L330 246" stroke-width="8"/>
    </g>`,
}

/* ─── Products ────────────────────────────────────────────────────────────
 * Slugs mirror prisma/seed/products-seed.js. The eyebrow is the product's
 * shelf category, not its title repeated — the title is already the loudest
 * thing on the card.                                                        */

const PRODUCTS = [
  { slug: "digital-transformation-starter-toolkit", title: "Digital Transformation Starter Toolkit", eyebrow: "Toolkit",      motif: "workflow" },
  { slug: "weekly-content-calendar",                title: "Weekly Content Calendar",                eyebrow: "Template",     motif: "calendar" },
  { slug: "stem-program-planning-pack",             title: "STEM Program Planning Pack",             eyebrow: "STEM pack",    motif: "stem" },
  { slug: "school-it-audit-checklist",              title: "School IT Audit Checklist",              eyebrow: "Checklist",    motif: "checklist" },
  { slug: "website-launch-planning-kit",            title: "Website Launch Planning Kit",            eyebrow: "Planning kit", motif: "browser" },
  { slug: "digital-workflow-optimization-pack",     title: "Digital Workflow Optimization Pack",     eyebrow: "Workbook",     motif: "optimise" },
  { slug: "consulting-session-package",             title: "Consulting Session Package",             eyebrow: "Session",      motif: "session" },
  { slug: "website-system-setup",                   title: "Website & Digital System Setup",         eyebrow: "Service",      motif: "layers" },
  { slug: "infrastructure-audit",                   title: "IT Infrastructure Audit",                eyebrow: "Audit",        motif: "infra" },
]

/* ─── Template ───────────────────────────────────────────────────────────── */

/* Fixed vertical rhythm. EYEBROW_Y and TITLE_TOP are constants rather than
 * derived from the title's line count: nine cards whose eyebrow sits at a
 * different height each read as nine unrelated products in a grid. Titles grow
 * downward from a common first baseline instead.
 *
 * Sizes cap at 78 so that a worst-case three-line title (lineH ≈ 91) ends at
 * y ≈ 942, inside the 5:3 safe band (y 240–960). */
const PANEL_Y = 250
const PANEL_H = 350
const EYEBROW_Y = 660
const TITLE_TOP = 760
const GLYPH_BOX = 360
const GLYPH_SIZE = 300

function productCover({ title, eyebrow: eye, motif }) {
  const { size, lines } = fitTitle(title, {
    maxWidth: SAFE_W - 40,
    maxLines: 3,
    sizes: [78, 70, 62, 56],
  })
  const lineH = Math.round(size * 1.16)
  const glyph = (motifs[motif] || motifs.workflow)()
  const scale = GLYPH_SIZE / GLYPH_BOX
  const gx = Math.round((W - GLYPH_SIZE) / 2)
  const gy = Math.round(PANEL_Y + (PANEL_H - GLYPH_SIZE) / 2)
  const ruleY = TITLE_TOP + (lines.length - 1) * lineH + 44

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${defs()}
  ${ground(W, H, { slab: false })}

  <!-- violet field behind the motif; keeps the glyph off the raw charcoal -->
  <rect x="${PAD}" y="${PANEL_Y}" width="${SAFE_W}" height="${PANEL_H}" rx="28"
        fill="url(#g-violet)" opacity="0.55"/>
  <rect x="${PAD}" y="${PANEL_Y}" width="${SAFE_W}" height="${PANEL_H}" rx="28"
        fill="none" stroke="${T.mist}" stroke-opacity="0.10" stroke-width="1.5"/>
  <g transform="translate(${gx},${gy}) scale(${scale.toFixed(4)})">${glyph}</g>

  ${eyebrow(PAD, EYEBROW_Y, eye, { size: 24 })}

  <text font-family="${T.font}" font-weight="800" font-size="${size}"
        fill="${T.mist}" letter-spacing="-0.02em">
    ${lines.map((l, i) => `<tspan x="${PAD}" y="${TITLE_TOP + i * lineH}">${escapeXml(l)}</tspan>`).join("")}
  </text>

  <rect x="${PAD}" y="${ruleY}" width="132" height="5" rx="2.5" fill="${T.gold}"/>

  ${brandMark(PAD, H - PAD - 52, { size: 52, withName: true })}
  <text x="${W - PAD}" y="${H - PAD - 14}" text-anchor="end"
        font-family="${T.font}" font-weight="600" font-size="24"
        fill="${T.mist}" fill-opacity="0.55">${escapeXml(SITE.domain)}</text>
</svg>`
}

/* ─── Run ────────────────────────────────────────────────────────────────── */

async function main() {
  const { preset } = await setupFonts()
  const { default: sharp } = await import("sharp")
  const probe = await probeSora(sharp)
  console.log(`fonts: ${preset}${probe?.ok === false ? "  (Sora not resolving — output will fall back)" : ""}`)
  console.log(`out:   public/images/products/<slug>/cover.png\n`)

  let total = 0
  let over = 0
  for (const p of PRODUCTS) {
    const out = path.join(OUT_SOURCE, p.slug, "cover.png")
    const { bytes, overBudget } = await renderPng(sharp, productCover(p), out)
    const mirror = path.join(OUT_SERVED, p.slug, "cover.png")
    await fs.mkdir(path.dirname(mirror), { recursive: true })
    await fs.copyFile(out, mirror)
    total += bytes
    if (overBudget) over += 1
    console.log(`  ${overBudget ? "!" : "✓"} ${p.slug.padEnd(42)} ${(bytes / 1024).toFixed(1).padStart(6)} KB`)
  }
  console.log(`\n${PRODUCTS.length} covers, ${(total / 1024).toFixed(0)} KB total${over ? `, ${over} over the 200 KB budget` : ""}`)
  console.log(`Next: npm run seed:product-images  (from the repo root) to attach them.`)
}

main().catch((err) => {
  console.error("[product-covers] failed:", err)
  process.exit(1)
})

export { PRODUCTS, productCover }
