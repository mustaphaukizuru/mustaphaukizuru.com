/**
 * imageCompress · downscale + re-encode an image in the browser before upload.
 * ─────────────────────────────────────────────────────────────────────────
 * Caps the long edge (default 1600px) and re-encodes to WebP (default q0.85),
 * turning multi-MB photos into ~150–250 KB files. Keeps uploads fast and
 * makes images render without a multi-second blank state — no server-side
 * image pipeline (sharp) required.
 *
 * Safe by design: returns the ORIGINAL file untouched for non-raster types
 * (GIF, SVG), when the browser can't decode it, or when compression wouldn't
 * actually shrink the file. So callers can always upload the returned File.
 *
 *   const optimized = await compressImage(file)
 *   formData.append("file", optimized)
 */
export async function compressImage(file, { maxEdge = 1600, quality = 0.85 } = {}) {
  if (
    !file ||
    !file.type?.startsWith("image/") ||
    file.type === "image/gif" ||
    file.type === "image/svg+xml"
  ) {
    return file
  }
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality))
    if (!blob || blob.size >= file.size) return file // never upload a bigger file
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".webp", { type: "image/webp" })
  } catch {
    return file // any failure → fall back to the original upload
  }
}

export default compressImage
