/**
 * scripts/og/templates.mjs · SVG templates for OG cards and social banners.
 * Colours/fonts mirror web/src/styles/tokens.css (brand v3.1) so this file
 * stays standalone. Every builder returns an SVG string sized to its canvas.
 */

export const T = {
  violet: "#5D3FD3",
  violetLight: "#8B6FE8",
  violetDeep: "#4A2EAB",
  charcoal: "#1A1B23",
  mist: "#F8FAFC",
  azure: "#0284C7",
  gold: "#E9C46A",
  font: "'Sora', 'Segoe UI', Roboto, sans-serif",
  mono: "'JetBrains Mono', 'Sora', ui-monospace, monospace",
}

export const SITE = {
  name: "Mustapha Ukizuru",
  domain: "mustaphaukizuru.com",
  tagline: "Technology consulting · Digital products · STEM solutions",
  categories: ["IT strategy", "AI & automation", "Cloud", "Product engineering"],
}

export function escapeXml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;")
}

/** Approximate Sora advance width (em units) — used for wrapping and pills. */
const CHAR_EM = { 800: 0.66, 700: 0.64, 600: 0.62, 500: 0.6, 400: 0.58 }
export function textWidth(text, size, weight = 600) {
  return text.length * size * (CHAR_EM[weight] || 0.62)
}

/** Greedy word wrap into ≤ maxLines; last line is ellipsised if needed. */
export function wrap(text, { size, weight = 800, maxWidth, maxLines = 3 }) {
  const words = String(text).trim().split(/\s+/)
  const lines = []
  let cur = ""
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (textWidth(next, size, weight) <= maxWidth || !cur) cur = next
    else { lines.push(cur); cur = w }
  }
  if (cur) lines.push(cur)
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    let last = kept[maxLines - 1]
    while (textWidth(`${last}…`, size, weight) > maxWidth && last.includes(" ")) last = last.replace(/\s+\S*$/, "")
    kept[maxLines - 1] = `${last}…`
    return kept
  }
  return lines
}

/** Picks the largest font size (from `sizes`) that fits in ≤ maxLines. */
export function fitTitle(text, { maxWidth, maxLines = 3, sizes = [76, 68, 60, 52, 46], weight = 800 }) {
  for (const size of sizes) {
    const lines = wrap(text, { size, weight, maxWidth, maxLines: 99 })
    if (lines.length <= maxLines) return { size, lines }
  }
  const size = sizes[sizes.length - 1]
  return { size, lines: wrap(text, { size, weight, maxWidth, maxLines }) }
}

/* ─── shared parts ────────────────────────────────────────────────────── */

export function defs() {
  return `<defs>
    <linearGradient id="g-violet" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${T.violet}"/><stop offset="1" stop-color="${T.violetDeep}"/>
    </linearGradient>
    <radialGradient id="g-glow" cx="0.85" cy="0.1" r="0.8">
      <stop offset="0" stop-color="${T.violetLight}" stop-opacity="0.55"/><stop offset="1" stop-color="${T.charcoal}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g-gold" cx="0.1" cy="1" r="0.6">
      <stop offset="0" stop-color="${T.gold}" stop-opacity="0.16"/><stop offset="1" stop-color="${T.charcoal}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="p-grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0H0V40" fill="none" stroke="#ffffff" stroke-opacity="0.045" stroke-width="1"/>
    </pattern>
  </defs>`
}

/** Charcoal ground + violet glow + grid + (optionally) a violet slab on the right. */
export function ground(W, H, { slab = true } = {}) {
  const slabW = Math.round(W * 0.22)
  const skew = Math.round(H * 0.32)
  return `
    <rect width="${W}" height="${H}" fill="${T.charcoal}"/>
    <rect width="${W}" height="${H}" fill="url(#g-glow)"/>
    <rect width="${W}" height="${H}" fill="url(#g-gold)"/>
    <rect width="${W}" height="${H}" fill="url(#p-grid)"/>
    ${slab ? `<path d="M${W - slabW} 0 L${W} 0 L${W} ${H} L${W - slabW - skew} ${H} Z" fill="url(#g-violet)" opacity="0.95"/>
    <path d="M${W - slabW - skew - 6} ${H} L${W - slabW - 6} 0" stroke="${T.gold}" stroke-opacity="0.9" stroke-width="3"/>` : ""}`
}

/** Brand mark: violet rounded square with "MU" monogram + gold chip, plus name. */
export function brandMark(x, y, { size = 52, withName = true, nameColor = T.mist } = {}) {
  const r = Math.round(size * 0.26)
  const fs = Math.round(size * 0.42)
  return `<g transform="translate(${x},${y})">
    <rect width="${size}" height="${size}" rx="${r}" fill="${T.violet}"/>
    <rect x="${size - Math.round(size * 0.3)}" y="${Math.round(size * 0.12)}" width="${Math.round(size * 0.18)}" height="${Math.round(size * 0.18)}" rx="3" fill="${T.gold}"/>
    <text x="${size / 2}" y="${size / 2 + fs * 0.36}" text-anchor="middle" font-family="${T.font}" font-weight="800" font-size="${fs}" fill="${T.mist}" letter-spacing="-0.02em">MU</text>
    ${withName ? `<text x="${size + Math.round(size * 0.35)}" y="${size / 2 + fs * 0.36}" font-family="${T.font}" font-weight="700" font-size="${fs}" fill="${nameColor}" letter-spacing="-0.01em">${escapeXml(SITE.name)}</text>` : ""}
  </g>`
}

export function eyebrow(x, y, label, { size = 20 } = {}) {
  const w = textWidth(label.toUpperCase(), size, 700) * 1.12
  return `<g transform="translate(${x},${y})">
    <rect x="0" y="${-size * 0.35}" width="6" height="${size * 1.3}" rx="2" fill="${T.gold}"/>
    <text x="20" y="${size * 0.65}" font-family="${T.font}" font-weight="700" font-size="${size}" fill="${T.gold}" letter-spacing="0.18em">${escapeXml(label.toUpperCase())}</text>
    <rect x="${20 + w + 16}" y="${size * 0.3}" width="120" height="1.5" fill="${T.mist}" fill-opacity="0.18"/>
  </g>`
}

export function pill(x, y, label, { size = 22, fill = "rgba(248,250,252,0.08)", stroke = "rgba(248,250,252,0.28)", color = T.mist, dot = T.gold } = {}) {
  const padX = size * 1.1
  const w = Math.round(textWidth(label, size, 600) + padX * 2 + size * 0.9)
  const h = Math.round(size * 2.2)
  const svg = `<g transform="translate(${x},${y})">
    <rect width="${w}" height="${h}" rx="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
    <circle cx="${padX + size * 0.2}" cy="${h / 2}" r="${size * 0.22}" fill="${dot}"/>
    <text x="${padX + size * 0.9}" y="${h / 2 + size * 0.36}" font-family="${T.font}" font-weight="600" font-size="${size}" fill="${color}">${escapeXml(label)}</text>
  </g>`
  return { w, h, svg }
}

/** Lays pills out in rows within maxWidth; returns svg + total height. */
export function pillRow(x, y, labels, { gap = 14, maxWidth = Infinity, ...opts } = {}) {
  let cx = x, cy = y, rowH = 0, out = ""
  for (const l of labels) {
    const p = pill(0, 0, l, opts)
    if (cx + p.w > x + maxWidth && cx > x) { cx = x; cy += rowH + gap; rowH = 0 }
    out += pill(cx, cy, l, opts).svg
    cx += p.w + gap
    rowH = Math.max(rowH, p.h)
  }
  return { svg: out, height: cy + rowH - y }
}

export function domainLine(x, y, { size = 22, anchor = "start", color = T.mist } = {}) {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${T.mono}" font-weight="500" font-size="${size}" fill="${color}" fill-opacity="0.85" letter-spacing="0.02em">${SITE.domain}</text>`
}

/* ─── 1200×630 OG card ───────────────────────────────────────────────── */

/**
 * @param {{ title:string, eyebrow?:string, subtitle?:string, accent?:boolean }} p
 *   accent → last title line rendered in gold.
 */
export function ogCard({ title, eyebrow: eye = "Mustapha Ukizuru", subtitle = SITE.tagline, accent = false }) {
  const W = 1200, H = 630, PAD = 72
  const maxWidth = W - PAD - 330 // keep clear of the violet slab
  const { size, lines } = fitTitle(title, { maxWidth, maxLines: 3 })
  const lineH = Math.round(size * 1.12)
  const blockH = lines.length * lineH
  const titleTop = Math.round((H - blockH) / 2 + 20)
  const titleSvg = lines.map((l, i) =>
    `<text x="${PAD}" y="${titleTop + i * lineH + size * 0.8}" font-family="${T.font}" font-weight="800" font-size="${size}" fill="${accent && i === lines.length - 1 ? T.gold : T.mist}" letter-spacing="-0.025em">${escapeXml(l)}</text>`).join("\n")
  const subLines = subtitle ? wrap(subtitle, { size: 24, weight: 500, maxWidth, maxLines: 2 }) : []
  const subSvg = subLines.map((l, i) =>
    `<text x="${PAD}" y="${H - 96 + i * 32}" font-family="${T.font}" font-weight="500" font-size="24" fill="${T.mist}" fill-opacity="0.72">${escapeXml(l)}</text>`).join("\n")
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${defs()}
  ${ground(W, H)}
  ${brandMark(PAD, 56)}
  ${eyebrow(PAD, titleTop - 44, eye)}
  ${titleSvg}
  ${subSvg}
  ${domainLine(W - 64, H - 56, { anchor: "end", size: 20 })}
  <circle cx="${W - 44}" cy="${H - 63}" r="6" fill="${T.gold}"/>
</svg>`
}

/* ─── social banners ─────────────────────────────────────────────────── */

const HEADLINE = "Technology consulting for teams that ship."

/** LinkedIn cover 1584×396 · X header 1500×500 (wide; avatar sits bottom-left). */
export function wideBanner(W, H, { avatarInset = 0.28 } = {}) {
  const left = Math.round(W * avatarInset)
  const size = H >= 480 ? 54 : 46
  const top = Math.round(H * 0.16)
  const pills = pillRow(left, Math.round(H * 0.6), SITE.categories, { size: H >= 480 ? 22 : 19, gap: 14, maxWidth: W - left - 60 })
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${defs()}
  ${ground(W, H, { slab: false })}
  <path d="M0 0 L${Math.round(W * 0.16)} 0 L${Math.round(W * 0.08)} ${H} L0 ${H} Z" fill="url(#g-violet)" opacity="0.9"/>
  <path d="M${Math.round(W * 0.16) + 8} 0 L${Math.round(W * 0.08) + 8} ${H}" stroke="${T.gold}" stroke-width="3" stroke-opacity="0.9"/>
  ${brandMark(left, top, { size: 44 })}
  <text x="${left}" y="${top + 44 + size + 4}" font-family="${T.font}" font-weight="800" font-size="${size}" fill="${T.mist}" letter-spacing="-0.025em">${escapeXml(HEADLINE)}</text>
  ${pills.svg}
  ${domainLine(W - 56, H - 40, { anchor: "end", size: 20 })}
</svg>`
}

/** LinkedIn post 1200×627. */
export function postBanner() {
  const W = 1200, H = 627, PAD = 80
  const pills = pillRow(PAD, 330, SITE.categories, { size: 24, gap: 16, maxWidth: W - PAD * 2 - 220 })
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${defs()}
  ${ground(W, H)}
  ${brandMark(PAD, 64)}
  ${eyebrow(PAD, 170, "Technology consulting")}
  <text x="${PAD}" y="270" font-family="${T.font}" font-weight="800" font-size="62" fill="${T.mist}" letter-spacing="-0.025em">For teams that ship.</text>
  ${pills.svg}
  <text x="${PAD}" y="${H - 72}" font-family="${T.font}" font-weight="500" font-size="22" fill="${T.mist}" fill-opacity="0.72">Mexico · LATAM · Worldwide</text>
  ${domainLine(W - 64, H - 64, { anchor: "end", size: 20 })}
</svg>`
}

/** Instagram 1080×1080. */
export function squareBanner() {
  const W = 1080, H = 1080, PAD = 88
  const pills = pillRow(PAD, 580, SITE.categories, { size: 30, gap: 18, maxWidth: W - PAD * 2 })
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${defs()}
  ${ground(W, H, { slab: false })}
  <path d="M0 ${H - 300} L${W} ${H - 420} L${W} ${H} L0 ${H} Z" fill="url(#g-violet)" opacity="0.95"/>
  <path d="M0 ${H - 308} L${W} ${H - 428}" stroke="${T.gold}" stroke-width="4" stroke-opacity="0.9"/>
  ${brandMark(PAD, PAD, { size: 64 })}
  ${eyebrow(PAD, 250, "Technology consulting", { size: 24 })}
  <text x="${PAD}" y="400" font-family="${T.font}" font-weight="800" font-size="84" fill="${T.mist}" letter-spacing="-0.03em">For teams</text>
  <text x="${PAD}" y="494" font-family="${T.font}" font-weight="800" font-size="84" fill="${T.gold}" letter-spacing="-0.03em">that ship.</text>
  ${pills.svg}
  <text x="${PAD}" y="${H - 120}" font-family="${T.font}" font-weight="600" font-size="30" fill="${T.mist}">${escapeXml(SITE.name)}</text>
  ${domainLine(PAD, H - 76, { size: 28 })}
</svg>`
}
