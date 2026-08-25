#!/usr/bin/env node
/**
 * generate-avif.js
 *
 * Emits an .avif sibling for every responsive .webp under public/images.
 *
 * WHY OFFLINE, AND WHY THE OUTPUT IS COMMITTED
 * --------------------------------------------
 * Same contract as scripts/optimize-images.sh (which does the WebP pass with
 * cwebp): this runs on a developer machine, never in CI and never on the
 * server. The derivatives are committed alongside the sources, which is the
 * existing convention for public/ — source assets are tracked, build output
 * is not.
 *
 * The alternative — a Vite plugin that encodes at build time — would put a
 * native image toolchain (sharp/libvips) on the critical path of a deploy
 * that runs `npm ci` on Hostinger shared hosting. That is a bad trade for a
 * set of images that changes a few times a year.
 *
 * REQUIRES: sharp, resolved from web/node_modules (it is already present
 * there). Not added to package.json for the reason above: nothing in CI or
 * on the server should ever need to install it.
 *
 * USAGE
 *   node scripts/generate-avif.js            # dry run — lists what it would write
 *   node scripts/generate-avif.js --apply
 *   node scripts/generate-avif.js --apply --quality 50
 */

const fs = require("fs")
const path = require("path")

const ROOT = path.resolve(__dirname, "..")
// NOTE: web/public/images is the SOURCE. Vite empties its outDir (the
// repo-root public/) on every build and re-copies web/public/* into it, so
// anything written straight to public/images is silently destroyed by the
// next build. Both trees are tracked in git; run the SPA build after this
// script to propagate the new files.
const IMG_DIR = path.join(ROOT, "web", "public", "images")

const apply = process.argv.includes("--apply")
const qArg = process.argv.indexOf("--quality")
// AVIF q45-50 is roughly visually equivalent to WebP q80 while landing
// meaningfully smaller; 50 is a deliberately conservative default.
const QUALITY = qArg > -1 ? Number(process.argv[qArg + 1]) : 50

let sharp
try {
  sharp = require(path.join(ROOT, "web", "node_modules", "sharp"))
} catch (e) {
  console.error("sharp not resolvable from web/node_modules.")
  console.error("Run `cd web && npm install` first. This script is offline-only —")
  console.error("sharp is deliberately not a declared dependency.")
  process.exit(1)
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name)
    if (e.isDirectory()) walk(f, out)
    else if (e.name.toLowerCase().endsWith(".webp")) out.push(f)
  }
  return out
}

async function main() {
  const sources = walk(IMG_DIR)
  let written = 0, skipped = 0, bytesWebp = 0, bytesAvif = 0, failed = 0

  for (const src of sources) {
    const dest = src.replace(/\.webp$/i, ".avif")
    if (fs.existsSync(dest)) { skipped++; continue }

    const inSize = fs.statSync(src).size
    if (!apply) {
      console.log(`  would write  ${String(Math.round(inSize / 1024)).padStart(5)} KB  ${path.relative(ROOT, dest)}`)
      written++
      bytesWebp += inSize
      continue
    }

    try {
      await sharp(src).avif({ quality: QUALITY, effort: 4 }).toFile(dest)
      const outSize = fs.statSync(dest).size
      // Never ship a "modern format" that is bigger than what it replaces —
      // that happens on small or already-tiny images.
      if (outSize >= inSize) {
        fs.unlinkSync(dest)
        skipped++
        continue
      }
      written++
      bytesWebp += inSize
      bytesAvif += outSize
    } catch (err) {
      failed++
      console.warn(`  failed: ${path.relative(ROOT, src)} — ${err.message}`)
    }
  }

  console.log("")
  console.log(apply ? "APPLIED" : "DRY RUN")
  console.log(`  webp sources found : ${sources.length}`)
  console.log(`  avif written       : ${written}`)
  console.log(`  skipped            : ${skipped}  (already exist, or avif was not smaller)`)
  if (failed) console.log(`  failed             : ${failed}`)
  if (apply && written) {
    const saved = bytesWebp - bytesAvif
    console.log(`  ${Math.round(bytesWebp / 1024)} KB webp -> ${Math.round(bytesAvif / 1024)} KB avif  (saved ${Math.round(saved / 1024)} KB, ${Math.round((saved / bytesWebp) * 100)}%)`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
