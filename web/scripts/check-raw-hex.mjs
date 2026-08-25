#!/usr/bin/env node
/**
 * check-raw-hex.mjs · design-system regression gate  (`npm run lint:tokens`)
 * ─────────────────────────────────────────────────────────────────────────
 * Roadmap step 22 locked the design system: every colour and font value in
 * `web/src` resolves to a token in `src/styles/tokens.css` (registered for
 * Tailwind in `src/index.css` under `@theme`).
 *
 * This script keeps it that way. It fails when:
 *
 *   1. a raw hex literal appears in `web/src/**` outside the allowlist
 *   2. a raw `rgba()` restates a brand colour's channels instead of
 *      composing `rgb(var(--color-<name>-rgb)/<alpha>)`
 *   3. a `font-family` names a literal family instead of `var(--font-*)`
 *   4. `src/styles/tokens.js` (the JS mirror used by <canvas>, hex-parsing
 *      helpers and `<meta name="theme-color">`) drifts from `tokens.css`
 *
 * THE RULE: tokens win over any generated palette. If a design tool, an AI
 * suggestion, or a component library hands you a hex, map it to the nearest
 * token — do not paste it. See docs/DESIGN_SYSTEM.md for how to add a token
 * when there genuinely isn't one.
 *
 * Adding to the allowlist is a deliberate act: every entry needs a reason
 * string, and reasons must fall into one of the sanctioned categories
 * (third-party brand marks, hand-drawn illustration palettes, universal
 * black/white literals). Never allowlist a colour just to silence the gate.
 */
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const WEB = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const SRC = join(WEB, "src")

/* ── Universal literals ──────────────────────────────────────────────────
 * Pure black and pure white are not palette decisions — they're the
 * endpoints of every colour space, used for masks, scrims and overlays. */
const UNIVERSAL = new Set(["#fff", "#ffff", "#ffffff", "#ffffffff", "#000", "#0000", "#000000", "#00000000"])

/* ── Allowlist ───────────────────────────────────────────────────────────
 * `"*"` exempts the whole file; an array exempts only those exact values.
 * Every entry carries the reason it is not a design decision we own. */
const ALLOW = {
  // Third-party brand marks — the vendor owns these hues; changing them
  // misrepresents the brand and, for payment rails, breaks trust cues.
  "src/components/TechStackMarquee.jsx":   { values: "*", why: "vendor logo brand colours" },
  "src/components/TechStackShowcase.jsx":  { values: "*", why: "vendor logo brand colours" },
  "src/components/SocialLinks.jsx":        { values: "*", why: "social network brand colours" },
  "src/components/GoogleLoginButton.jsx":  { values: "*", why: "Google sign-in brand mark" },
  "src/components/MicrosoftLoginButton.jsx": { values: "*", why: "Microsoft sign-in brand mark" },
  "src/components/FacebookLoginButton.jsx": { values: "*", why: "Facebook sign-in brand mark" },
  "src/components/LanguageSwitcher.jsx":   { values: "*", why: "national flag colours" },
  "src/components/SpokenLanguages.jsx":    { values: "*", why: "national flag colours" },
  "src/data/sitePagesData.js":             { values: ["#229ED9", "#25D366"], why: "Telegram / WhatsApp brand marks" },
  "src/layout/Footer.jsx":                 { values: ["#ffe600"], why: "MercadoPago brand chip" },
  "src/pages/CheckoutPage.jsx": {
    values: ["#FFE600", "#ffe600", "#fffce6", "#7a6200", "#003087", "#f0f4ff", "#1e3a8a"],
    why: "MercadoPago / PayPal brand chips and their tints — payment trust cues",
  },

  // Hand-drawn / illustrated scenes. These are artwork, not UI surfaces:
  // the palettes are internally balanced and snapping any one swatch to a
  // brand token breaks the illustration's colour relationships.
  "src/pages/AboutPage.jsx": {
    values: "*",
    why: "tech-stack logo colours + device-mockup hardware colours + categorical skill-bar gradients",
  },
  "src/components/heroes/ContactHero.jsx": {
    values: "*",
    why: "hand-drawn kanban / rocket scene — self-contained illustration palette",
  },
  "src/components/AuthBrandPanel.jsx": {
    values: "*",
    why: "decorative aurora blur blobs (blurred past recognition at 3xl)",
  },
  "src/components/public/layout.jsx": {
    values: ["#f5bf9e"], why: "terracotta button hover — lighter peach; no lighter-terracotta token exists yet",
  },
  "src/components/heroes/StoreHero.jsx": {
    values: ["#ffd9be"], why: "terracotta button hover — lighter peach; no lighter-terracotta token exists yet",
  },
  "src/pages/CheckoutSuccessPage.jsx": { values: ["#B9A6F2"], why: "decorative confetti swatch" },
  "src/pages/AdminEmailTemplatesPage.jsx": { values: ["#888"], why: "placeholder inside an email-preview srcDoc string", fonts: true },

  /* ── PENDING · owned by concurrent auth/downloads work at the time step 22
   * landed, so they were left untouched to avoid a merge collision. Each one
   * is a mechanical `rgba(<brand triple>, a)` → `rgb(var(--color-*-rgb)/a)`
   * swap. Delete these entries (and make the swap) in the follow-up pass. */
  "src/components/product/FeatureList.jsx":   { values: ["#F8FAFC"], rgba: true, why: "PENDING — concurrent work" },
  "src/components/product/FileList.jsx":      { values: [], rgba: true, why: "PENDING — concurrent work" },
  "src/pages/DashboardDownloadsPage.jsx":     { values: [], rgba: true, why: "PENDING — concurrent work" },
  "src/pages/LoginPage.jsx":                  { values: [], rgba: true, why: "PENDING — concurrent work" },
  "src/pages/SignupPage.jsx":                 { values: [], rgba: true, why: "PENDING — concurrent work" },

  // The JS mirror of the palette — checked separately for drift below.
  "src/styles/tokens.js": { values: "*", why: "JS mirror of tokens.css (drift-checked)" },
}

/* Brand channel triples that must be composed from `--color-*-rgb`. */
const BRAND_RGB = {
  "93,63,211": "violet", "2,132,199": "azure", "233,196,106": "terracotta",
  "26,27,35": "charcoal", "248,250,252": "mist", "16,185,129": "mint",
  "245,158,11": "amber", "225,29,72": "rose", "224,120,86": "coral",
}

const HEX = /#[0-9a-fA-F]{3,8}\b/g
const RGBA = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g
const FONT = /font-family\s*:\s*(?!var\()|fontFamily\s*[:=]\s*["'](?!var\()/g

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(jsx?|tsx?)$/.test(e)) out.push(p)
  }
  return out
}

const problems = []
for (const abs of walk(SRC)) {
  const rel = relative(WEB, abs).split(sep).join("/")
  const allow = ALLOW[rel]
  const src = readFileSync(abs, "utf8")
  const lines = src.split("\n")

  lines.forEach((line, i) => {
    const at = `${rel}:${i + 1}`

    for (const m of line.matchAll(HEX)) {
      const v = m[0]
      if (UNIVERSAL.has(v.toLowerCase())) continue
      if (allow && (allow.values === "*" || allow.values.includes(v))) continue
      problems.push(`${at}  raw hex ${v}  →  use a token (var(--color-…) or the Tailwind utility)`)
    }

    for (const m of line.matchAll(RGBA)) {
      const key = `${+m[1]},${+m[2]},${+m[3]}`
      const name = BRAND_RGB[key]
      if (name && !(allow && allow.rgba)) problems.push(`${at}  rgba(${key},…) restates --color-${name}  →  rgb(var(--color-${name}-rgb)/<alpha>)`)
    }

    for (const _ of line.matchAll(FONT)) {
      if (allow && (allow.values === "*" || allow.fonts)) continue
      problems.push(`${at}  literal font-family  →  use var(--font-display | --font-body | --font-mono | --font-script)`)
    }
  })
}

/* ── tokens.js ↔ tokens.css drift guard ─────────────────────────────── */
const css = readFileSync(join(SRC, "styles/tokens.css"), "utf8") + readFileSync(join(SRC, "index.css"), "utf8")
const js = readFileSync(join(SRC, "styles/tokens.js"), "utf8")
for (const m of js.matchAll(/^\s*(\w+):\s*"(#[0-9a-fA-F]{6})"/gm)) {
  const [, name, value] = m
  if (UNIVERSAL.has(value.toLowerCase())) continue
  if (!css.toLowerCase().includes(value.toLowerCase())) {
    problems.push(`src/styles/tokens.js  TOKENS.${name} = ${value} has no matching --color-* in tokens.css / index.css`)
  }
}

if (problems.length) {
  console.error("\n[31m✖ Design-token gate failed[0m — tokens win over any generated palette.\n")
  for (const p of problems) console.error("    " + p)
  console.error(`\n  ${problems.length} problem(s). See docs/DESIGN_SYSTEM.md § "Adding a token".`)
  console.error("  If a value is genuinely a third-party brand mark or an illustration")
  console.error("  swatch, add it to ALLOW in web/scripts/check-raw-hex.mjs WITH a reason.\n")
  process.exit(1)
}
console.log("✓ Design-token gate passed — every colour and font in web/src resolves to a token.")
