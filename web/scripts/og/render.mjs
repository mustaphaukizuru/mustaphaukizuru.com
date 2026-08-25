/**
 * scripts/og/render.mjs · rasterise SVG → PNG/JPG with sharp, enforcing a
 * byte budget (OG images should stay ≤ 200 kB). Tries a 256-colour palette
 * first, then shrinks the palette until the file fits.
 */
import fs from "node:fs/promises"
import path from "node:path"

export const MAX_BYTES = 200 * 1024

export async function renderPng(sharp, svg, outPath, { maxBytes = MAX_BYTES } = {}) {
  const input = Buffer.from(svg, "utf8")
  const attempts = [
    { compressionLevel: 9, adaptiveFiltering: true, palette: true, quality: 100, colours: 256, dither: 0.6 },
    { compressionLevel: 9, palette: true, quality: 90, colours: 192, dither: 0.6 },
    { compressionLevel: 9, palette: true, quality: 80, colours: 128, dither: 0.7 },
    { compressionLevel: 9, palette: true, quality: 70, colours: 64, dither: 0.8 },
  ]
  let buf
  for (const opts of attempts) {
    buf = await sharp(input, { density: 72 }).png(opts).toBuffer()
    if (buf.byteLength <= maxBytes) break
  }
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, buf)
  return { bytes: buf.byteLength, overBudget: buf.byteLength > maxBytes }
}

export async function renderJpg(sharp, svg, outPath, { quality = 86 } = {}) {
  const buf = await sharp(Buffer.from(svg, "utf8")).jpeg({ quality, mozjpeg: true }).toBuffer()
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, buf)
  return { bytes: buf.byteLength }
}
