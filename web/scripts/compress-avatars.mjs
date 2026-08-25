/**
 * compress-avatars.mjs · one-off script
 * ──────────────────────────────────────────────────────────────────────────
 * Compresses the 6 avatar PNGs from their original 2000×2000 / ~2.4 MB
 * source-files down to 400×400 with aggressive palette+zlib optimization.
 *
 * The largest UI use is 52×52 (AuthBrandPanel) — even at 4× DPR that's
 * 208 px, so 400 px keeps us crisp on every Retina display while cutting
 * file size by ~95%. The originals stay on Drive in the brand archive;
 * this script ships an optimized in-repo asset suitable for production.
 *
 * Run:  cd web && node ./scripts/compress-avatars.mjs
 *
 * Output:
 *   · web/src/assets/avatar/<variant>.png         (compressed, in-place)
 *   · web/src/assets/avatar/<variant>.webp        (modern format sibling)
 *
 * Safety:
 *   · sharp().toBuffer() first, fs.writeFile last — so a sharp crash
 *     mid-encode never leaves a half-written PNG on disk.
 *   · The original 2000×2000 source is archived under brand/ if needed
 *     for print or large-display contexts.
 */
import sharp from "sharp"
import fs from "node:fs/promises"
import path from "node:path"

const SRC_DIR = path.resolve(process.cwd(), "src/assets/avatar")
const TARGET_SIZE = 400 // px — 4× the AuthBrandPanel display, oversized on purpose

const VARIANTS = [
  "avatar-master",
  "avatar-azure",
  "avatar-charcoal",
  "avatar-terracotta",
  "avatar-violet",
  "avatar-white",
]

let totalBefore = 0
let totalAfter = 0

for (const name of VARIANTS) {
  const srcPath = path.join(SRC_DIR, `${name}.png`)
  const webpPath = path.join(SRC_DIR, `${name}.webp`)

  try {
    const before = (await fs.stat(srcPath)).size
    totalBefore += before

    // PNG: resize + aggressive palette quantization + max zlib
    const pngBuffer = await sharp(srcPath)
      .resize(TARGET_SIZE, TARGET_SIZE, { fit: "cover", position: "center" })
      .png({ quality: 90, compressionLevel: 9, palette: true, effort: 10 })
      .toBuffer()

    // WebP: smaller still, modern-browser sibling
    const webpBuffer = await sharp(srcPath)
      .resize(TARGET_SIZE, TARGET_SIZE, { fit: "cover", position: "center" })
      .webp({ quality: 85, effort: 6 })
      .toBuffer()

    await fs.writeFile(srcPath, pngBuffer)
    await fs.writeFile(webpPath, webpBuffer)

    const after = pngBuffer.length
    const webpSize = webpBuffer.length
    totalAfter += after
    const savings = (((before - after) / before) * 100).toFixed(1)
    console.log(
      `  ${name.padEnd(20)}  PNG ${(before / 1024 / 1024).toFixed(2)} MB → ${(after / 1024).toFixed(1)} KB (${savings}% smaller) · WebP ${(webpSize / 1024).toFixed(1)} KB`,
    )
  } catch (err) {
    console.error(`  ✗ ${name}:`, err.message)
  }
}

console.log("")
console.log(
  `  Total: ${(totalBefore / 1024 / 1024).toFixed(2)} MB → ${(totalAfter / 1024 / 1024).toFixed(2)} MB`,
)
console.log(
  `  Saved: ${((totalBefore - totalAfter) / 1024 / 1024).toFixed(2)} MB (${(((totalBefore - totalAfter) / totalBefore) * 100).toFixed(1)}% reduction)`,
)
