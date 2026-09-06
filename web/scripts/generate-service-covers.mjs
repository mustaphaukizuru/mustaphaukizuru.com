/**
 * generate-service-covers.mjs · 16:9 cover art for the 4 service categories
 *
 * Usage (from web/):
 *   npm run service-covers:build
 *
 * Output: public/images/services/<slug>.jpg   (1600×900)
 *
 * WHY FOUR FILES AND NOT TWENTY-FOUR
 * ----------------------------------
 * The catalogue sells 24 offerings across 4 categories with no imagery at
 * all. The offerings inherit their category's cover — `CategoryCard` and the
 * `/services/<slug>` hero both read the same path — so four covers dress the
 * whole catalogue. That was the recommendation and this is it built.
 *
 * WHY GENERATED RATHER THAN SOURCED
 * ---------------------------------
 * The same argument `generate-product-covers.mjs` makes: these are
 * engagements, not objects, so there is no photograph of them. A stock photo
 * of a handshake or a server rack says nothing true about a software stack
 * audit, and carries a licence into a commercial page. Generated art uses
 * the real Brand v3 tokens, regenerates identically on any machine, and is a
 * FILE — which the runtime `MediaSlot` art is not, so it can be replaced,
 * edited, or fed to the OG pipeline.
 *
 * `MediaSlot` still draws its runtime art if a file is missing. This makes
 * the file exist, so the slot shows real art with real srcset variants
 * instead of a same-size CSS gradient on every card.
 *
 * REPLACING THEM
 * --------------
 * Drop a photograph at the same path and it wins — the generator is not
 * wired into the build, so nothing overwrites a real asset. See
 * docs/ASSET_SLOTS.md.
 *
 * JPG, NOT PNG
 * ------------
 * A 1600×900 photographic-weight gradient is the case JPG is for; the
 * product covers are PNG because they are flat art on a solid ground at
 * 1200². These land around 60–90 kB each, where a palette PNG of the same
 * gradient is several times that.
 *
 * SAFE-CROP RULE
 * --------------
 * I had this backwards at first. 16:10 (1.60) is TALLER per unit width than
 * 16:9 (1.78), so `object-cover` fitting this file into the detail hero's
 * 16:10 frame crops the SIDES, not the top and bottom: it keeps 900×1.6 =
 * 1440 of 1600px, losing 80px off each edge. The left-aligned text was the
 * thing at risk, not the vertical band I had been protecting.
 *
 * So PAD is 150, which leaves the text 70px of margin after that crop, and
 * the motif sits inside x 1030–1450 where the right-hand 80px cut cannot
 * reach it. A later 1200×630 OG crop (1.90, wider than 1.78) would trim
 * height instead — everything load-bearing stays inside y 250–700 for that.
 */
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { setupFonts, probeSora } from "./og/fonts.mjs"
import { renderJpg } from "./og/render.mjs"
import { T, SITE, defs, ground, brandMark, eyebrow, fitTitle, escapeXml } from "./og/templates.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/* Both copies, for the reason generate-product-covers.mjs records: `web/public`
 * is the source Vite serves in dev and copies on build (with emptyOutDir, which
 * wipes the root first), and the repo-root `public/` is what Express serves in
 * production. Writing one and not the other means the dev server 404s or the
 * next build deletes the file. */
const OUT_SOURCE = path.resolve(__dirname, "..", "public", "images", "services")
const OUT_SERVED = path.resolve(__dirname, "..", "..", "public", "images", "services")

const W = 1600
const H = 900
const PAD = 150
const SAFE_W = W - PAD * 2 - 420   // leaves the right third for the motif
/* The footer keeps the ORIGINAL 96px inset rather than following PAD up to
 * 150. Raising PAD for the side-crop protection pushed the brand row to
 * within 26px of the title rule, which read as cramped at three lines. The
 * footer is decoration and sits outside every safe band anyway. */
const FOOT = 96

/* ─── Motifs ──────────────────────────────────────────────────────────────
 * One glyph per category, so four cards in a row do not read as one tile
 * recoloured. Drawn inside a 420×420 box at the origin; the caller
 * translates. Stroke-only in gold, which survives JPG chroma subsampling
 * far better than fine filled detail.                                     */
const motifs = {
  /* compass rose — independent direction-setting */
  compass: () => `
    <g fill="none" stroke="${T.gold}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="210" cy="210" r="168"/>
      <circle cx="210" cy="210" r="120" stroke-opacity="0.45"/>
      <path d="M210 42 V78 M210 342 V378 M42 210 H78 M342 210 H378"/>
      <path d="M150 270 L246 150 L270 174 L174 294 Z"/>
      <circle cx="210" cy="210" r="14" fill="${T.gold}" stroke="none"/>
    </g>`,
  /* nodes converging into one output — automation */
  circuit: () => `
    <g fill="none" stroke="${T.gold}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
      <rect x="30" y="48" width="132" height="92" rx="16"/>
      <rect x="30" y="188" width="132" height="92" rx="16"/>
      <rect x="30" y="328" width="132" height="92" rx="16"/>
      <rect x="258" y="188" width="132" height="92" rx="16"/>
      <path d="M162 94 H210 Q234 94 234 140 V188"/>
      <path d="M162 234 H258"/>
      <path d="M162 374 H210 Q234 374 234 328 V280"/>
      <circle cx="234" cy="234" r="12" fill="${T.gold}" stroke="none"/>
    </g>`,
  /* cloud over stacked layers — migration */
  cloud: () => `
    <g fill="none" stroke="${T.gold}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M112 168 a72 72 0 0 1 138 -30 a58 58 0 0 1 54 92 H126 a56 56 0 0 1 -14 -62 Z"/>
      <path d="M210 236 V300"/>
      <path d="M168 268 L210 300 L252 268" stroke-opacity="0.6"/>
      <rect x="72" y="312" width="276" height="40" rx="12"/>
      <rect x="102" y="368" width="216" height="40" rx="12" stroke-opacity="0.6"/>
    </g>`,
  /* nested frames resolving into a tick — shipped product */
  build: () => `
    <g fill="none" stroke="${T.gold}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
      <rect x="34" y="34" width="352" height="272" rx="22"/>
      <path d="M34 108 H386"/>
      <circle cx="74" cy="71" r="9" fill="${T.gold}" stroke="none"/>
      <circle cx="106" cy="71" r="9" fill="${T.gold}" stroke="none"/>
      <path d="M80 164 H236 M80 210 H320 M80 256 H196" stroke-opacity="0.75"/>
      <path d="M250 330 l52 52 l84 -104" stroke-width="10"/>
    </g>`,
}

/* Slug, motif and the line each cover leads with.
 *
 * The title is the CATEGORY NAME, not its outcome sentence. A cover is read
 * at thumbnail size next to the card that already carries the outcome in
 * body copy, so repeating a 90-character promise in 60px type would be
 * unreadable and redundant at once. */
const CATEGORIES = [
  { slug: "it-strategy-consulting", title: "IT Strategy Consulting", eyebrow: "Independent senior advice", motif: "compass" },
  { slug: "ai-automation", title: "AI & Workflow Automation", eyebrow: "Fewer hands, same output", motif: "circuit" },
  { slug: "cloud-architecture-migration", title: "Cloud Architecture & Migration", eyebrow: "Move it without breaking it", motif: "cloud" },
  { slug: "digital-product-engineering", title: "Digital Product Engineering", eyebrow: "Built, shipped, handed over", motif: "build" },
]

function serviceCover({ title, eyebrow: eye, motif }) {
  const { size, lines } = fitTitle(title, { maxWidth: SAFE_W, maxLines: 3, sizes: [88, 78, 68, 58] })
  const lineH = Math.round(size * 1.16)
  // Bottom-anchored so a 1-line and a 3-line title share a baseline and the
  // rule below them never moves. 620 rather than 596 because at three lines
  // the cap height of the first line reached up into the eyebrow — measured
  // on "Cloud Architecture & Migration", where "MOVE IT WITHOUT BREAKING
  // IT" and "Cloud" were touching.
  const TITLE_BOTTOM = 620
  const firstY = TITLE_BOTTOM - (lines.length - 1) * lineH
  const ruleY = TITLE_BOTTOM + 52

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${defs()}

  <!-- ground() is the pipeline own charcoal + glow + grid.
      The first version here painted a bespoke background and referenced a
      mesh gradient that defs() does not define, so it would have rendered
      as a flat violet rectangle. Reusing ground() keeps these covers
      visually identical to the OG cards and the product covers, which is
      the point
      of having a shared template module. slab:false because the right
       third carries the motif instead. -->
  ${ground(W, H, { slab: false })}
  <circle cx="${W - 320}" cy="${H * 0.30}" r="340" fill="${T.violet}" fill-opacity="0.30"/>

  <g transform="translate(${W - PAD - 420} ${H / 2 - 210})" opacity="0.92">
    ${motifs[motif]()}
  </g>

  ${eyebrow(PAD, 250, eye, { size: 26 })}

  <text font-family="${T.font}" font-weight="800" font-size="${size}"
        fill="${T.mist}" letter-spacing="-0.02em">
    ${lines.map((l, i) => `<tspan x="${PAD}" y="${firstY + i * lineH}">${escapeXml(l)}</tspan>`).join("")}
  </text>

  <rect x="${PAD}" y="${ruleY}" width="148" height="6" rx="3" fill="${T.gold}"/>

  ${brandMark(PAD, H - FOOT - 52, { size: 52, withName: true })}
  <text x="${W - PAD}" y="${H - FOOT - 14}" text-anchor="end"
        font-family="${T.font}" font-weight="600" font-size="26"
        fill="${T.mist}" fill-opacity="0.55">${escapeXml(SITE.domain)}</text>
</svg>`
}

/* ─── Run ────────────────────────────────────────────────────────────────── */

async function main() {
  const { preset } = await setupFonts()
  const { default: sharp } = await import("sharp")
  const probe = await probeSora(sharp)
  console.log(`fonts: ${preset}${probe?.ok === false ? "  (Sora not resolving — output will fall back)" : ""}`)
  console.log(`out:   public/images/services/<slug>.jpg\n`)

  let total = 0
  for (const c of CATEGORIES) {
    const out = path.join(OUT_SOURCE, `${c.slug}.jpg`)
    const { bytes } = await renderJpg(sharp, serviceCover(c), out, { quality: 84 })
    const mirror = path.join(OUT_SERVED, `${c.slug}.jpg`)
    await fs.mkdir(path.dirname(mirror), { recursive: true })
    await fs.copyFile(out, mirror)
    total += bytes
    console.log(`  ✓ ${c.slug.padEnd(34)} ${(bytes / 1024).toFixed(1).padStart(6)} KB`)
  }
  console.log(`\n${CATEGORIES.length} covers, ${(total / 1024).toFixed(0)} KB total`)
  console.log(`Next: npm run images:webp   — emits the -400/-800/-1200 AVIF + WebP`)
  console.log(`      siblings the MediaSlot srcset already asks for.`)
}

main().catch((err) => {
  console.error("[service-covers] failed:", err)
  process.exit(1)
})

export { CATEGORIES, serviceCover }
