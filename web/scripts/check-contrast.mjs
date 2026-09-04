#!/usr/bin/env node
/**
 * check-contrast.mjs · WCAG contrast gate  (`npm run lint:contrast`)
 * ─────────────────────────────────────────────────────────────────────────
 * Sibling of `check-raw-hex.mjs`. That gate proves every colour in `web/src`
 * comes from a token; this one proves the token PAIRS we actually ship as
 * text clear WCAG 2.1 AA.
 *
 * Thresholds (WCAG 2.1 §1.4.3 / §1.4.11):
 *   body   — text < 18.66px bold / < 24px regular …… 4.5:1
 *   large  — text ≥ 18.66px bold / ≥ 24px regular …… 3.0:1
 *   ui     — icons, borders, focus rings, chart fills  3.0:1
 *
 * Colours are read from the token declarations themselves — `tokens.css`
 * first, then the `@theme` block of `index.css` (Tailwind v4 registers a
 * handful of scale steps such as `--color-steel-700` and `--color-mint-700`
 * there rather than in tokens.css). Nothing here restates a hex: if a token
 * moves, this file follows it.
 *
 * A pair belongs in PAIRS when the combination is actually rendered as text
 * somewhere in `web/src`. Decorative fills, gradients, blobs and icon tints
 * are listed under EXEMPT with the reason they are out of scope — they are
 * documented, not checked as body text.
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const WEB = join(fileURLToPath(new URL(".", import.meta.url)), "..")
const SRC = join(WEB, "src")

/* ── Token table ───────────────────────────────────────────────────────── */
const TOKENS = {}
for (const file of ["styles/tokens.css", "index.css"]) {
  const css = readFileSync(join(SRC, file), "utf8")
  for (const m of css.matchAll(/--color-([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    if (!(m[1] in TOKENS)) TOKENS[m[1]] = m[2]
  }
}
TOKENS.white = "#FFFFFF"
TOKENS.black = "#000000"

/* ── Colour maths ──────────────────────────────────────────────────────── */
function rgb(hex) {
  let h = hex.replace("#", "")
  if (h.length === 3) h = h.split("").map(c => c + c).join("")
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))
}
const srgb = c => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
const luminance = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b)
const ratio = (a, b) => {
  const [l1, l2] = [luminance(rgb(a)), luminance(rgb(b))].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}
/** Flatten `bg-<token>/<alpha>` against the surface it actually sits on. */
const over = (top, bottom, alpha) => {
  const [t, b] = [rgb(top), rgb(bottom)]
  return "#" + t.map((c, i) => Math.round(c * alpha + b[i] * (1 - alpha))
    .toString(16).padStart(2, "0")).join("")
}

/** `"azure"` | `"azure/10 on white"` -> hex.
 *
 * The same `token/alpha on ground` form is valid on BOTH sides of a pair, so
 * a Tailwind alpha TEXT utility (`text-charcoal-80/65`) is expressed exactly
 * like an alpha FILL (`bg-mint/15`): the foreground is flattened against the
 * surface it is painted on before the ratio is taken. That is what the
 * browser does, and it is why `text-charcoal-80/55` reads as #818286 rather
 * than as charcoal. */
function resolve(spec) {
  const m = /^([a-z0-9-]+)(?:\/([\d.]+))?(?:\s+on\s+([a-z0-9-]+))?$/.exec(spec)
  if (!m) throw new Error(`unparseable colour spec: ${spec}`)
  const [, name, alpha, ground] = m
  const hex = TOKENS[name]
  if (!hex) throw new Error(`unknown token --color-${name}`)
  if (!alpha) return hex
  if (!TOKENS[ground]) throw new Error(`unknown ground token --color-${ground}`)
  return over(hex, TOKENS[ground], Number(alpha) / 100)
}

const MIN = { body: 4.5, large: 3, ui: 3 }

/* ── The pairs we ship ─────────────────────────────────────────────────────
 * Every entry is a real rendered combination. `size` picks the threshold.
 * `why` names where it lives so a failure is actionable, not a puzzle. */
const PAIRS = [
  /* Links and action text on light grounds — the `azure-deep` sweep. */
  ["azure-deep", "white",             "body", "links, mail/tel anchors, ghost buttons"],
  ["azure-deep", "mist",              "body", "links on the page canvas"],
  ["azure-deep", "slate-100",         "body", "links inside dashboard cards"],
  ["azure-deep", "azure/10 on white", "body", "info chips (bg-azure/10)"],
  ["azure-800",  "azure-pale",        "body", "status pills, toasts, file-type chips"],
  ["white",      "azure-deep",        "body", "white text on a solid azure action fill"],

  /* Muted / secondary text. */
  ["steel",      "white",     "body", "secondary copy on cards"],
  ["steel-700",  "white",     "body", "muted labels on cards"],
  ["steel-700",  "mist",      "body", "muted labels on the canvas"],
  ["steel-700",  "slate-100", "body", "muted labels on dashboard fills"],
  ["steel-700",  "slate-50",  "body", "muted labels on soft neutral fills"],

  /* Feedback text on light grounds. */
  ["mint-700",  "white",             "body", "success text / pill labels"],
  ["mint-700",  "mint-50",           "body", "success pills (bg-mint-50)"],
  ["mint-700",  "mint/10 on white",  "body", "success chips (bg-mint/10)"],
  ["mint-700",  "mint/15 on white",  "body", "success chips (bg-mint/15)"],
  ["amber-700", "white",             "body", "pending text / pill labels"],
  ["amber-700", "amber-50",          "body", "pending pills (bg-amber-50)"],
  ["amber-700", "amber/10 on white", "body", "pending chips (bg-amber/10)"],
  ["amber-700", "amber/15 on white", "body", "pending chips (bg-amber/15)"],
  ["rose-700",  "white",             "body", "error text / pill labels"],
  ["rose-700",  "rose-50",           "body", "error pills (bg-rose-50)"],
  ["charcoal",  "mint",              "body", "charcoal label on a solid mint fill"],
  ["charcoal",  "amber",             "body", "charcoal label on a solid amber fill"],
  ["charcoal",  "coral",             "body", "charcoal label on a solid coral fill"],
  ["white",     "rose",              "body", "white label on a destructive rose fill"],

  /* Warm accent. Terracotta is a light hue: it reads as text on DARK grounds
   * only. `terracotta-deep` is its hover twin and is still light — the
   * body-text companion on light grounds is `terracotta-800`. */
  ["terracotta",     "charcoal",               "body", "eyebrows / highlights on dark sections"],
  ["terracotta",     "charcoal-deep",          "body", "eyebrows on the deepest dark canvas"],
  ["terracotta-800", "white",                  "body", "warm accent text on cards"],
  ["terracotta-800", "mist",                   "body", "warm accent text on the canvas"],
  ["terracotta-800", "terracotta/12 on white", "body", "warm chips (bg-terracotta/12)"],
  ["terracotta-800", "terracotta/20 on white", "body", "warm chips (bg-terracotta/20)"],
  ["terracotta-800", "coral-pale",             "body", "coral chip labels"],
  ["charcoal",       "terracotta",             "body", "charcoal label on a solid terracotta fill"],

  /* Violet. */
  ["white",       "violet",      "body", "the primary button and every violet band"],
  ["white",       "violet-deep", "body", "hover / active violet"],
  ["violet",      "white",       "body", "brand text on cards"],
  ["violet",      "mist",        "body", "brand text on the canvas"],
  ["violet",      "violet-pale", "body", "violet chips"],
  ["violet-deep", "terracotta",  "body", "violet label on a terracotta fill"],
  ["violet-deep", "white",       "body", "hover state of every violet link"],

  /* Dark surfaces. */
  ["mist",         "charcoal",      "body", "body copy on dark sections"],
  ["mist",         "charcoal-deep", "body", "body copy on the deepest dark canvas"],
  ["cyan",         "charcoal",      "body", "links on dark / dashboard dark mode"],
  ["violet-light", "charcoal",      "body", "violet text on dark surfaces"],
  ["code-fg",      "charcoal",      "body", "code blocks"],
  ["white",        "charcoal",      "body", "headings on dark sections"],

  /* Initials avatars. */
  ["avatar-1-fg", "avatar-1-bg", "body", "deterministic initials avatar"],
  ["avatar-2-fg", "avatar-2-bg", "body", "deterministic initials avatar"],
  ["avatar-3-fg", "avatar-3-bg", "body", "deterministic initials avatar"],
  ["avatar-4-fg", "avatar-4-bg", "body", "deterministic initials avatar"],
  ["avatar-5-fg", "avatar-5-bg", "body", "deterministic initials avatar"],

  /* ── Alpha TEXT utilities ────────────────────────────────────────────────
   * `text-<token>/<alpha>` is flattened against its ground exactly like
   * `bg-<token>/<alpha>`. These are the steps we actually ship as small copy;
   * anything lighter than the step listed here failed a real Lighthouse
   * mobile run and was raised at the usage site. Do not lower them.
   *
   * charcoal-80 needs /65 to clear 4.5:1 on BOTH white and mist (/60 is
   * 4.52 on white but only 4.45 on mist, so /65 is the shipped floor).
   * violet never clears 4.5:1 below /85, so violet body copy is solid.
   * white on the violet band needs /85. */
  ["charcoal-80/65 on white",     "white",       "body", "muted copy, meta rows, card captions (text-charcoal-80/65)"],
  ["charcoal-80/65 on mist",      "mist",        "body", "muted copy on the page canvas"],
  ["charcoal-80/65 on slate-100", "slate-100",   "body", "muted copy on dashboard fills"],
  ["charcoal-80/65 on coral-pale","coral-pale",  "body", "services-hero float card caption (8px mono)"],
  ["charcoal-80/70 on white",     "white",       "body", "secondary copy one step darker"],
  ["charcoal-80/85 on white",     "white",       "body", "near-solid body copy"],
  ["violet",                      "white",       "body", "step numerals, eyebrows, feed link (solid — /70 is 3.52)"],
  ["violet",                      "mist",        "body", "eyebrows on the canvas"],
  ["azure-deep",                  "azure-pale",  "body", "About stat-tile hints (solid — /75 on azure-pale is 3.32)"],
  ["white/85 on violet",          "violet",      "body", "PageHero subtitle + eyebrows on the violet band"],
  ["white",                       "white/10 on violet", "body", "Privacy/Terms hero badge — the bg-white/10 pill lifts the ground, so /85 (4.43) is not enough; solid white"],
  ["white/85 on charcoal",        "charcoal",    "body", "muted copy on dark sections"],
  ["mint-700",                    "mint/15 on coral-pale", "body", "delivery-trend chip inside the services-hero float card"],

  /* Large / display type — 3:1 applies. The brand anchors live here. */
  ["azure",      "white",  "large", "display headline accents"],
  ["azure",      "mist",   "large", "display headline accents on the canvas"],
  ["terracotta", "violet", "large", "terracotta accent word inside a violet band"],
  ["violet",     "white",  "large", "page and section headings"],

  /* Non-text UI — 3:1 applies (icons, borders, focus rings, chart marks). */
  ["azure",      "white",    "ui", "lucide icons, focus rings, chart strokes"],
  ["azure",      "mist",     "ui", "lucide icons on the canvas"],
  ["rose",       "white",    "ui", "destructive icons"],
  ["coral",      "white",    "ui", "illustration accent strokes"],
  ["steel",      "white",    "ui", "icon-only affordances"],
  ["terracotta", "charcoal", "ui", "star ratings on dark"],
]

/* ── Documented exemptions ──────────────────────────────────────────────────
 * These render a brand anchor at a size or in a role where the AA body-text
 * rule does not apply. Listed so the next reader knows they were considered. */
const EXEMPT = [
  "terracotta star-rating glyphs, hero sparkles and decorative <Star fill> marks — icons, 3:1",
  "azure / mint / amber / rose / coral as lucide icon tints inside h-8…h-14 tiles — non-text UI, 3:1",
  "violet↔azure gradients, blurred blobs, ring-* / border-* tints — decoration, no text",
  // Verified 2026-08-25: every terracotta accent word inside a heading sits on a
  // DARK ground — StoreHero (bg-violet-deep), Footer, and the AboutPage CTA band
  // are all text-white sections, covered by the declared terracotta-on-charcoal
  // pair above. There is currently NO light-ground terracotta heading, so the
  // "1.9:1 display heading" debt recorded in docs/LAUNCH_HANDOVER_2026-08.md §7
  // was stale. Azure accent words are the remaining reason this line exists.
  //
  // CAUTION: this gate only checks DECLARED pairs, so a future light-ground
  // terracotta heading would pass silently. If one is added, declare it —
  // terracotta-800 (#856212, 5.60:1 on white) is the light-ground companion.
  "azure accent words inside `.text-display` / `.text-page` headings — large text, 3:1",
  "chart series fills and sparkline strokes drawn from the brand anchors — non-text UI, 3:1",
  "`--color-*-rgb` alpha washes used as backgrounds rather than as text — surfaces, not text",
  "mint (2.54:1) and amber (2.15:1) on white as icon tints: below even the 3:1 non-text bar,",
  "  but every one of them sits beside a text label that already carries the state — kept as",
  "  brand identity, never as the sole carrier of meaning",
  "slate-300 borders on white (2.39:1) — hairline separators, not meaningful boundaries",
]

/* ── Run ───────────────────────────────────────────────────────────────── */
const rows = []
const failures = []
for (const [fg, bg, size, why] of PAIRS) {
  const r = ratio(resolve(fg), resolve(bg))
  const ok = r >= MIN[size]
  rows.push({ fg, bg, size, why, r, ok })
  if (!ok) failures.push({ fg, bg, size, why, r })
}

const pad = (s, n) => String(s).padEnd(n)
if (process.argv.includes("--report")) {
  for (const row of rows) {
    console.log(`  ${row.ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✖\x1b[0m"} ${pad(row.fg, 15)} on ${pad(row.bg, 24)} ${pad(row.size, 6)} ${row.r.toFixed(2).padStart(6)}:1   ${row.why}`)
  }
  console.log("\n  Exempt by role:")
  for (const e of EXEMPT) console.log("    · " + e)
  console.log("")
}

/* ── Rule: never dilute an already-darkened scale step for TEXT ────────────
 * The -600/-700/-800 steps exist precisely because the brand anchor fails
 * AA as body text. Putting an alpha back on top undoes that: `text-mint-700/75`
 * measured 3.86:1 at 10.5px on white and failed a desktop Lighthouse run,
 * while the declared-pair table above passed — because nobody had thought to
 * declare that exact pair. This scan needs no declaration: the pattern itself
 * is the bug. Backgrounds (`bg-*`) and rings are unaffected.
 * ------------------------------------------------------------------------- */
function scanDilutedTextTokens() {
  const roots = ["src"]
  const offenders = []
  const RE = /text-(mint|amber|rose|azure|violet|terracotta|charcoal|steel)-(600|700|800)\/(\d{1,3})\b/g

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${entry.name}`
      if (entry.isDirectory()) { walk(full); continue }
      if (!/\.(jsx?|tsx?)$/.test(entry.name)) continue
      const text = readFileSync(full, "utf8")
      for (const m of text.matchAll(RE)) {
        if (Number(m[3]) >= 100) continue
        offenders.push(`${full}: ${m[0]}`)
      }
    }
  }
  for (const r of roots) { if (existsSync(r)) walk(r) }
  return offenders
}

const diluted = scanDilutedTextTokens()
if (diluted.length) {
  console.error("\n\x1b[31m✖ Contrast gate failed\x1b[0m — a darkened scale step is being diluted for TEXT.\n")
  for (const d of diluted) console.error("    " + d)
  console.error("\n  The -600/-700/-800 steps are the AA-passing choice; an alpha puts them back under 4.5:1.")
  console.error("  Use the solid token for text. Alpha is fine on bg-* and ring-*.\n")
  process.exit(1)
}

/* ── Rule: text tokens meant for light grounds must clear AA on white ──────
 * U5. Everything above checks pairs someone DECLARED. The 3.86:1 miss that
 * reached CI (`text-mint-700/75` at 10.5px) was a pair nobody had thought to
 * declare. This scan derives candidates from USAGE instead:
 *
 *   for every `text-<token>[/alpha]` in a className, where the token is a
 *   dark-scale step or a brand anchor (i.e. one that exists to be read on a
 *   light ground), compute its ratio against white — unless the SAME
 *   className also paints a dark fill (a dark section), or the class list
 *   marks the text as display/large (3:1 applies), or the exact spec is
 *   already declared in PAIRS.
 *
 * "Against white" is the honest default: ancestors are not resolvable from
 * a static scan, and public pages sit on white/mist. Light tokens (white,
 * *-pale, *-ghost, *-50/100, mist) are skipped — they are for dark grounds
 * and would only produce noise. This is a floor, not a proof; it catches the
 * class of bug that actually shipped.
 * ------------------------------------------------------------------------- */
function scanUndeclaredTextOnLight() {
  const LIGHT = /^(white|black|mist|slate-100|[a-z]+-(pale|ghost|50|100|light|mid)|[a-z]+-rgb)$/
  const DARK_FILL = /\bbg-(charcoal|charcoal-deep|charcoal-light|charcoal-80|violet|violet-deep|violet-mid|azure-deep|black|slate-[6-9]00)\b/
  /* The trailing \b used to sit after the whole alternation, which quietly
   * killed all three arbitrary-value branches: they end in `]` or `(`, and a
   * word boundary cannot match between a non-word character and the space
   * that follows. `text-[28px]`, `text-[32px]` and `text-[clamp(...)]` all
   * tested false, so every large arbitrary-size heading was measured against
   * the 4.5:1 body bar instead of the 3:1 large-text one this file documents.
   * The boundary now applies only to the branches that end in a word
   * character; the bracket forms are self-delimiting. \d is required rather
   * than optional too, so `text-[2px]` no longer counts as large text. */
  const LARGE = /\b(?:text-(?:display|page|hero)\b|text-(?:3|4|5|6)xl\b|text-\[clamp\((?:2|3|4)|text-\[(?:2|3|4)\dpx\])/
  const CLASS_RE = /className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g
  const TEXT_RE = /\btext-([a-z]+(?:-[a-z0-9]+)*)(?:\/(\d{1,3}))?\b/g

  const declaredOnLight = new Set(
    PAIRS.filter(([, bg]) => /^(white|mist)$/.test(bg)).map(([fg]) => fg)
  )
  const offenders = []
  const seen = new Set()

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${entry.name}`
      if (entry.isDirectory()) { walk(full); continue }
      if (!/\.(jsx?|tsx?)$/.test(entry.name)) continue
      const text = readFileSync(full, "utf8")
      for (const cm of text.matchAll(CLASS_RE)) {
        const cls = cm[1] ?? cm[2] ?? cm[3] ?? ""
        if (DARK_FILL.test(cls)) continue
        const min = LARGE.test(cls) ? MIN.large : MIN.body
        for (const tm of cls.matchAll(TEXT_RE)) {
          const [, name, alpha] = tm
          if (!(name in TOKENS) || LIGHT.test(name)) continue
          const spec = alpha ? `${name}/${alpha} on white` : name
          if (declaredOnLight.has(spec)) continue
          let hex
          try { hex = resolve(spec) } catch { continue }
          const r = ratio(hex, TOKENS.white)
          if (r >= min) continue
          const line = text.slice(0, cm.index).split("\n").length
          const key = `${full}:${line}:${spec}`
          if (seen.has(key)) continue
          seen.add(key)
          offenders.push(`${full.replace(SRC + "/", "src/")}:${line}  text-${name}${alpha ? "/" + alpha : ""} on white = ${r.toFixed(2)}:1 (needs ${min}:1)`)
        }
      }
    }
  }
  walk(SRC)
  return offenders
}

/* Ratchet, not a cliff.
 *
 * The first run of the usage scan surfaced 307 findings: real debt
 * (text-charcoal-80/35 body copy at 2.2:1) mixed with things a static scan
 * cannot judge (text-violet/0 as an animation start state; terracotta on a
 * dark ANCESTOR ground). Failing CI on all of it would block every PR on
 * three years of history; hiding it would defeat the scan. So the current
 * findings are committed as a baseline and shown as debt, and the gate fails
 * only on a NEW finding — a usage that was not there before. The debt can
 * then be paid down file by file, and `--update-baseline` re-snapshots.
 *
 * The key is file + spec, not line, so moving code does not create "new"
 * findings; adding the same bad token in a new file does. */
const BASELINE_PATH = join(WEB, "scripts", "contrast-baseline.json")
const undeclared = scanUndeclaredTextOnLight()
const undeclaredKey = (o) => o.replace(/^(src\/[^:]+):\d+\s+(text-[^ ]+) on white.*$/, "$1 $2")

if (process.argv.includes("--update-baseline")) {
  const keys = [...new Set(undeclared.map(undeclaredKey))].sort()
  writeFileSync(BASELINE_PATH, JSON.stringify(keys, null, 2) + "\n")
  console.log(`  baseline written: ${keys.length} known findings → ${BASELINE_PATH}`)
}

const baseline = new Set(existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, "utf8")) : [])
const fresh = undeclared.filter((o) => !baseline.has(undeclaredKey(o)))
const known = undeclared.length - fresh.length

if (known) {
  const byToken = {}
  for (const o of undeclared) {
    if (fresh.includes(o)) continue
    const t = o.replace(/.*  (text-[a-z0-9-]+)(?:\/\d+)? on white.*/, "$1")
    byToken[t] = (byToken[t] || 0) + 1
  }
  const top = Object.entries(byToken).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t, n]) => `${t} ×${n}`).join(", ")
  console.log(`  ⚠ ${known} known text-on-light findings in the baseline (debt, not a failure): ${top}`)
}

if (fresh.length) {
  console.error("\n\x1b[31m✖ Contrast gate failed\x1b[0m — NEW text colour usage that does not clear AA on a light ground.\n")
  for (const o of fresh) console.error("    " + o)
  console.error("\n  Either swap the usage site for the darker sibling (*-deep / *-700 / *-800),")
  console.error("  or — if the element really sits on a dark ground the scan cannot see —")
  console.error("  put a bg-* token on the same element, or declare the pair in PAIRS with its ground.")
  console.error("  (Known pre-existing findings live in scripts/contrast-baseline.json.)\n")
  process.exit(1)
}

if (failures.length) {
  console.error("\n\x1b[31m✖ Contrast gate failed\x1b[0m — WCAG 2.1 AA (4.5:1 body · 3:1 large & non-text UI).\n")
  for (const f of failures) {
    console.error(`    ${f.fg} on ${f.bg} — ${f.r.toFixed(2)}:1, needs ${MIN[f.size]}:1 (${f.size})`)
    console.error(`        ${f.why}`)
  }
  console.error("\n  Fix at the usage site: swap the body-text colour for its darker")
  console.error("  sibling (*-deep / *-700 / *-800), or darken the fill. Do NOT retune a")
  console.error('  brand anchor. See docs/DESIGN_SYSTEM.md § "Adding a token".\n')
  process.exit(1)
}
console.log(`✓ Contrast gate passed — ${PAIRS.length} shipped colour pairs clear WCAG 2.1 AA (${EXEMPT.length} roles exempt by size/usage).`)
