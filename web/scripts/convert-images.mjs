import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

/**
 * convert-images.mjs · SEO07 · WebP conversion (one-off)
 *
 * Walks web/public/images (or any directory passed as the first arg) and
 * emits a .webp sibling for every .jpg / .jpeg / .png. Originals are kept
 * for the <picture> fallback the new <Image /> component produces.
 *
 * Usage (from web/):
 *   node scripts/convert-images.mjs                # default: ../public/images
 *   node scripts/convert-images.mjs ../public/og   # custom root
 *
 * Requires `sharp` — install with `npm install --save-dev sharp` (about 30 MB
 * of native binaries; safe in devDeps since this only runs at build time).
 *
 * Idempotent: skips files whose .webp already exists and is newer than the
 * source. Re-run is cheap.
 */

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, "../public/images"))

const QUALITY = Number(process.env.WEBP_QUALITY || 82)   // 82 strikes the size/quality sweet spot

let sharp
try {
  ({ default: sharp } = await import("sharp"))
} catch (err) {
  console.error("[convert-images] `sharp` is not installed.")
  console.error("                  Install with: npm install --save-dev sharp")
  process.exit(2)
}

async function* walk(dir) {
  let entries
  try { entries = await fs.readdir(dir, { withFileTypes: true }) }
  catch (err) { console.warn(`[convert-images] cannot read ${dir}: ${err.message}`); return }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(full)
    else if (e.isFile() && /\.(jpe?g|png)$/i.test(e.name)) yield full
  }
}

async function isFresh(srcPath, dstPath) {
  try {
    const [src, dst] = await Promise.all([fs.stat(srcPath), fs.stat(dstPath)])
    return dst.mtimeMs >= src.mtimeMs
  } catch { return false }
}

async function convertOne(srcPath) {
  const dstPath = srcPath.replace(/\.(jpe?g|png)$/i, ".webp")
  if (await isFresh(srcPath, dstPath)) return { srcPath, dstPath, skipped: true }

  const buf = await fs.readFile(srcPath)
  const out = await sharp(buf)
    .webp({ quality: QUALITY, effort: 4, smartSubsample: true })
    .toBuffer()
  await fs.writeFile(dstPath, out)

  const inSize  = buf.length
  const outSize = out.length
  return { srcPath, dstPath, inSize, outSize, ratio: outSize / inSize }
}

async function main() {
  console.log(`[convert-images] root = ${ROOT}`)
  let total = 0, converted = 0, skipped = 0, savedBytes = 0
  for await (const file of walk(ROOT)) {
    total++
    try {
      const r = await convertOne(file)
      if (r.skipped) { skipped++; continue }
      converted++
      savedBytes += (r.inSize - r.outSize)
      const pct = ((r.ratio) * 100).toFixed(1)
      console.log(`  â ${path.relative(ROOT, file)} â ${pct}% size`)
    } catch (err) {
      console.warn(`  â  ${file}: ${err.message}`)
    }
  }
  const savedKb = (savedBytes / 1024).toFixed(1)
  console.log(`\n[convert-images] done â¢ ${converted} converted â¢ ${skipped} skipped â¢ ${total} total â¢ ${savedKb} KB saved`)
}

main().catch((err) => { console.error("[convert-images] fatal:", err); process.exit(1) })
