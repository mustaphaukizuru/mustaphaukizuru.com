/**
 * generate-og-images.mjs · brand-styled OG image generator
 *
 * Renders five 1200x630 PNG OG images from SVG templates and writes them
 * into web/public/og/. The repository previously referenced these files
 * but the directory didn't exist, so every Twitter/Facebook/LinkedIn
 * share preview was 404'ing.
 *
 * Each image is a typographic design (no photo embedding) in brand v3.1
 * tokens: violet field, mist-on-violet headline, soft terracotta accent,
 * tight font stack of Sora-equivalent system fallbacks. Final aesthetic
 * mirrors the OG style used by modern dev brands (Linear, Vercel, Stripe).
 *
 * Usage (from web/):
 *   node scripts/generate-og-images.mjs
 *
 * Requires `sharp` (devDep). Idempotent — overwrites existing PNGs each
 * run, so the file is also the regeneration tool for when the OG art
 * is iterated.
 */

import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_OG = path.resolve(__dirname, "..", "public", "og")

const W = 1200
const H = 630

/* ─── Brand palette (Brand v3.1 · single source of truth, mirrored here
 *      so the script stays standalone and doesn't need to import CSS). ─── */
const VIOLET       = "#5D3FD3"
const VIOLET_DEEP  = "#4A2EAB"
const VIOLET_PALE  = "#EDE9FB"
const TERRACOTTA   = "#E9C46A"
const CHARCOAL     = "#1A1B23"
const MIST         = "#F8FAFC"

/* ─── Reusable visual building blocks ───────────────────────────────────
 *  All templates share a violet ground with two soft radial highlights
 *  and a subtle dot-pattern overlay. Distinguishing elements: page tag,
 *  headline copy, accent dot color.
 */
function backgroundLayers() {
  return `
    <!-- Base field -->
    <rect width="${W}" height="${H}" fill="${VIOLET_DEEP}" />

    <!-- Top-left soft highlight -->
    <defs>
      <radialGradient id="hl1" cx="0.15" cy="0.1" r="0.65">
        <stop offset="0%" stop-color="${VIOLET}" stop-opacity="0.85" />
        <stop offset="100%" stop-color="${VIOLET_DEEP}" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="hl2" cx="1" cy="1" r="0.7">
        <stop offset="0%" stop-color="${TERRACOTTA}" stop-opacity="0.22" />
        <stop offset="100%" stop-color="${VIOLET_DEEP}" stop-opacity="0" />
      </radialGradient>
      <pattern id="dotgrid" width="22" height="22" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="1" fill="#ffffff" fill-opacity="0.06" />
      </pattern>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#hl1)" />
    <rect width="${W}" height="${H}" fill="url(#hl2)" />
    <rect width="${W}" height="${H}" fill="url(#dotgrid)" />
  `
}

/* ─── Top-right wordmark · "mustaphaukizuru.com" + accent dot. Keeps every
 *      OG identifiable as belonging to the same brand surface. ─── */
function wordmark() {
  return `
    <g transform="translate(${W - 64}, 56)" text-anchor="end">
      <circle cx="0" cy="-4" r="6" fill="${TERRACOTTA}" />
      <text
        x="-16" y="0"
        fill="${MIST}"
        font-family="'Sora', 'Inter', system-ui, sans-serif"
        font-weight="700"
        font-size="20"
        letter-spacing="0.16em"
        text-rendering="geometricPrecision"
      >MUSTAPHAUKIZURU.COM</text>
    </g>
  `
}

/* ─── Page tag · small uppercase label in the top-left identifying the
 *      page kind (Home · About · Solutions · Services · Store). ─── */
function pageTag(label) {
  return `
    <g transform="translate(72, 56)">
      <rect x="0" y="-18" rx="14" ry="14" width="${label.length * 9.5 + 28}" height="30"
            fill="${VIOLET_PALE}" fill-opacity="0.18"
            stroke="${VIOLET_PALE}" stroke-opacity="0.32" stroke-width="1" />
      <text x="14" y="2"
            fill="${MIST}"
            font-family="'Sora', 'Inter', system-ui, sans-serif"
            font-weight="700"
            font-size="13"
            letter-spacing="0.22em">${label.toUpperCase()}</text>
    </g>
  `
}

/* ─── Headline group · 2–3 lines, centered vertically in the middle of
 *      the canvas. Word-wrapping is done at the call-site so each line
 *      can be sized and emphasised independently. ─── */
function headline(lines) {
  // Vertically centre the block of lines around y=320 (slightly above
  // canvas middle to leave breathing room for the bottom subline).
  const totalH = lines.length * 86
  const startY = 320 - totalH / 2 + 86

  return lines.map((line, i) => {
    const fill = line.accent ? TERRACOTTA : MIST
    return `
      <text
        x="72" y="${startY + i * 86}"
        fill="${fill}"
        font-family="'Sora', 'Inter', system-ui, sans-serif"
        font-weight="800"
        font-size="74"
        letter-spacing="-0.02em"
      >${escapeXml(line.text)}</text>
    `
  }).join("\n")
}

/* ─── Subline · bottom-left tagline, smaller weight, slightly transparent. ─── */
function subline(text) {
  return `
    <text
      x="72" y="${H - 64}"
      fill="${MIST}" fill-opacity="0.78"
      font-family="'Sora', 'Inter', system-ui, sans-serif"
      font-weight="500"
      font-size="22"
      letter-spacing="-0.005em"
    >${escapeXml(text)}</text>
  `
}

function escapeXml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

/* ─── SVG template assembler. Composes the layered visual stack into one
 *      1200x630 SVG document, which sharp then rasterises to PNG. ─── */
function buildSvg({ tag, lines, sub }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${backgroundLayers()}
  ${pageTag(tag)}
  ${wordmark()}
  ${headline(lines)}
  ${subline(sub)}
</svg>`
}

/* ─── Page-by-page content. Each entry maps to one PNG file. ─── */
const TEMPLATES = [
  {
    file: "og-default.png",
    tag:  "Home",
    lines: [
      { text: "Technology consulting," },
      { text: "digital products,",       accent: true },
      { text: "STEM solutions." },
    ],
    sub: "Mexico · LATAM · Worldwide  ·  Built with care, shipped with intent.",
  },
  {
    file: "og-profile.png",
    tag:  "About",
    lines: [
      { text: "Mustapha Ukizuru" },
      { text: "Full-Stack Developer", accent: true },
      { text: "& IT Manager." },
    ],
    sub: "6+ years across Rwanda, Turkey, Ethiopia, Mexico.",
  },
  {
    file: "og-solutions.png",
    tag:  "Solutions",
    lines: [
      { text: "Outcomes,"                },
      { text: "not capabilities.",       accent: true },
    ],
    sub: "School IT · Custom software · STEM programs · Cloud · AI adoption.",
  },
  {
    file: "og-services.png",
    tag:  "Services",
    lines: [
      { text: "Premium delivery,"        },
      { text: "honest price.",           accent: true },
    ],
    sub: "IT consulting · EdTech · Web systems · STEM curriculum.",
  },
  {
    file: "og-store.png",
    tag:  "Store",
    lines: [
      { text: "Digital products"         },
      { text: "for schools & SMBs.",     accent: true },
    ],
    sub: "Templates · Toolkits · STEM resources  ·  Instant download.",
  },
]

/* ─── Main · render each template to PNG via sharp ─── */
async function main() {
  await fs.mkdir(PUBLIC_OG, { recursive: true })

  for (const tpl of TEMPLATES) {
    const svg     = buildSvg(tpl)
    const outPath = path.join(PUBLIC_OG, tpl.file)

    const buf = await sharp(Buffer.from(svg, "utf8"))
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer()

    await fs.writeFile(outPath, buf)
    const kb = (buf.byteLength / 1024).toFixed(1)
    console.log(`  ✓ ${tpl.file.padEnd(20)} ${kb} KB`)
  }

  console.log(`\nDone — ${TEMPLATES.length} OG images written to ${PUBLIC_OG}`)
}

main().catch((err) => {
  console.error("[og-images] failed", err)
  process.exit(1)
})
