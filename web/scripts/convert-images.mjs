import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

/**
 * convert-images.mjs · SEO07 / PERF · responsive WebP generation
 *
 * Walks web/public/images (or any directory passed as the first arg) and for
 * every .jpg / .jpeg / .png emits:
 *
 *   <name>.webp          — full source width (used by <Image> as the default)
 *   <name>-<w>.webp      — one per breakpoint width (≤ source width) plus the
 *                          source width itself, e.g. photo-400.webp
 *
 * Breakpoints:
 *   default            400, 800, 1200, 1600
 *   images/profile/**  112, 224, 448   (avatars rendered at 44–56 px, 2–3× DPR)
 *
 * Skipped directories (user uploads, handled at runtime by the API):
 *   images/products/**, any directory named "media" or "avatars"
 *
 * Source compression: a source PNG/JPG larger than 400 kB is re-encoded in
 * place (mozjpeg q82 · png compressionLevel 9, then palette quantisation as a
 * second pass when lossless is still over budget). The re-encoded file is only
 * written when it is actually smaller than the original.
 *
 * Idempotent: an output is skipped when it is newer than its source.
 *
 * Usage (from web/):
 *   node scripts/convert-images.mjs                # default: ../public/images
 *   node scripts/convert-images.mjs ../public/og   # custom root
 */

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, "../public/images"))

const QUALITY         = Number(process.env.WEBP_QUALITY || 80)
const SOURCE_BUDGET   = 400 * 1024
const DEFAULT_WIDTHS  = [400, 800, 1200, 1600]
const PROFILE_WIDTHS  = [112, 224, 448]
const SKIP_DIR_NAMES  = new Set(["products", "media", "avatars"])

let sharp
try {
  ({ default: sharp } = await import("sharp"))
} catch {
  console.error("[convert-images] `sharp` is not installed.")
  console.error("                  Install with: npm install --save-dev sharp")
  process.exit(2)
}

async function* walk(dir, depth = 0) {
  let entries
  try { entries = await fs.readdir(dir, { withFileTypes: true }) }
  catch (err) { console.warn(`[convert-images] cannot read ${dir}: ${err.message}`); return }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (SKIP_DIR_NAMES.has(e.name.toLowerCase())) continue
      yield* walk(full, depth + 1)
    } else if (e.isFile() && /\.(jpe?g|png)$/i.test(e.name)) {
      yield full
    }
  }
}

async function isFresh(srcPath, dstPath) {
  try {
    const [src, dst] = await Promise.all([fs.stat(srcPath), fs.stat(dstPath)])
    return dst.mtimeMs >= src.mtimeMs
  } catch { return false }
}

function widthsFor(srcPath) {
  const rel = path.relative(ROOT, srcPath).split(path.sep)
  return rel[0] === "profile" ? PROFILE_WIDTHS : DEFAULT_WIDTHS
}

const kb = (n) => `${(n / 1024).toFixed(1)} kB`

/** Re-encode an oversized source in place. Returns {before, after} or null. */
async function compressSource(srcPath, buf) {
  if (buf.length <= SOURCE_BUDGET) return null
  const isPng = /\.png$/i.test(srcPath)
  let out
  if (isPng) {
    out = await sharp(buf).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer()
    if (out.length > SOURCE_BUDGET) {
      // Lossless still over budget → palette quantisation (visually lossless
      // for UI screenshots, ~4–6× smaller).
      out = await sharp(buf).png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 }).toBuffer()
    }
  } else {
    out = await sharp(buf).jpeg({ quality: 82, mozjpeg: true }).toBuffer()
  }
  if (out.length >= buf.length) return null
  await fs.writeFile(srcPath, out)
  return { before: buf.length, after: out.length, buf: out }
}

async function convertOne(srcPath) {
  let buf = await fs.readFile(srcPath)
  const result = { srcPath, outputs: [], skipped: 0, compressed: null }

  const c = await compressSource(srcPath, buf)
  if (c) { buf = c.buf; result.compressed = c }

  const meta = await sharp(buf).metadata()
  const srcW = meta.width || 0
  const base = srcPath.replace(/\.(jpe?g|png)$/i, "")

  const widths = [...new Set([...widthsFor(srcPath).filter((w) => w <= srcW), srcW])].sort((a, b) => a - b)
  const targets = [
    { dst: `${base}.webp`, width: null },
    ...widths.map((w) => ({ dst: `${base}-${w}.webp`, width: w })),
  ]

  for (const t of targets) {
    if (await isFresh(srcPath, t.dst)) { result.skipped++; continue }
    let pipe = sharp(buf)
    if (t.width) pipe = pipe.resize({ width: t.width, withoutEnlargement: true })
    const out = await pipe.webp({ quality: QUALITY, effort: 4, smartSubsample: true }).toBuffer()
    await fs.writeFile(t.dst, out)
    result.outputs.push({ dst: t.dst, size: out.length })
  }
  return result
}

async function main() {
  console.log(`[convert-images] root = ${ROOT}`)
  let files = 0, written = 0, skipped = 0
  for await (const file of walk(ROOT)) {
    files++
    try {
      const r = await convertOne(file)
      const rel = path.relative(ROOT, file)
      if (r.compressed) console.log(`  * ${rel}: source ${kb(r.compressed.before)} -> ${kb(r.compressed.after)}`)
      for (const o of r.outputs) console.log(`  + ${path.relative(ROOT, o.dst)} (${kb(o.size)})`)
      written += r.outputs.length
      skipped += r.skipped
    } catch (err) {
      console.warn(`  ! ${file}: ${err.message}`)
    }
  }
  console.log(`\n[convert-images] done - ${files} sources - ${written} webp written - ${skipped} up to date`)
}

main().catch((err) => { console.error("[convert-images] fatal:", err); process.exit(1) })
