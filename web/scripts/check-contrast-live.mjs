/**
 * check-contrast-live.mjs — axe-core colour contrast against the RUNNING app.
 *
 * T3-3. `npm run lint:contrast` checks token pairs from source; it cannot
 * see a colour that loses the cascade, or one produced by an opacity
 * modifier over whatever surface happens to be behind it. Both of those
 * shipped: the primary Button rendered near-black on violet because an
 * unlayered `a { color: inherit }` beat its utility, and /schools carried
 * two opacity modifiers at 4.45:1 and 4.14:1. Lighthouse caught the first
 * only after a push; this catches both in about a minute, locally.
 *
 * Usage — needs the dev server on 5173 (or BASE=... for a built preview):
 *   node scripts/check-contrast-live.mjs
 *   BASE=http://localhost:5098 node scripts/check-contrast-live.mjs
 *
 * REDUCED MOTION IS FORCED, and that is not a detail. Sections here fade in
 * on scroll, and axe computes contrast including every ancestor's opacity —
 * so a page measured mid-animation reports the blended colour and invents
 * violations. One run of /about produced 206 phantom failures at 3.31:1
 * that vanished on the next. Forcing reduced motion pins every section at
 * its resting opacity, which is the state a reader actually sees.
 */
import { chromium } from "@playwright/test"
import { readFileSync } from "node:fs"

const BASE = process.env.BASE || "http://localhost:5173"
const AXE = readFileSync(new URL("../node_modules/axe-core/axe.min.js", import.meta.url), "utf8")

// The public surface Lighthouse audits, plus the Spanish mirror of the page
// whose contrast bug this script was written to find.
const PATHS = [
  "/", "/about", "/services", "/schools", "/store",
  "/contact", "/privacy", "/terms", "/es/schools",
]
const VIEWPORTS = [
  { width: 1440, height: 900, tag: "desktop" },
  { width: 390, height: 844, tag: "mobile" },
]

const browser = await chromium.launch()
let failures = 0

for (const path of PATHS) {
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      reducedMotion: "reduce",
    })
    let violations = []
    try {
      await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 30_000 })
      await page.waitForTimeout(1200)
      await page.addScriptTag({ content: AXE })
      violations = await page.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: ["color-contrast"] })
        return r.violations.flatMap((v) => v.nodes.map((n) => ({
          html: (n.html || "").slice(0, 120),
          why: (n.any?.[0]?.message || "").replace(/\s+/g, " ").slice(0, 150),
        })))
      })
    } catch (err) {
      console.error(`  ✖ ${path} @${vp.tag} — could not be measured: ${err.message.split("\n")[0]}`)
      failures += 1
      await page.close()
      continue
    }

    if (violations.length) {
      failures += violations.length
      console.error(`\n  ✖ ${path} @${vp.tag} — ${violations.length} contrast violation(s)`)
      for (const v of violations.slice(0, 5)) {
        console.error(`      ${v.why}`)
        console.error(`      ${v.html}`)
      }
      if (violations.length > 5) console.error(`      … and ${violations.length - 5} more`)
    } else {
      console.log(`  ✓ ${path} @${vp.tag}`)
    }
    await page.close()
  }
}

await browser.close()

if (failures) {
  console.error(`\n\x1b[31m✖ Live contrast check failed\x1b[0m — ${failures} finding(s).`)
  console.error("  Prefer a darker sibling token over lowering opacity: an opacity modifier")
  console.error("  blends toward whatever is behind it, so the same class passes on one")
  console.error("  surface and fails on another. See web/src/styles/tokens.css.\n")
  process.exit(1)
}
console.log(`\n✓ Live contrast check passed — ${PATHS.length} pages × ${VIEWPORTS.length} viewports, no violations.`)
