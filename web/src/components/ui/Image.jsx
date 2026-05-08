import { useState } from "react"

/**
 * Image · SEO09 · responsive media primitive
 *
 * <picture> wrapper with WebP-first source + the original JPG/PNG fallback.
 * Enforces explicit width + height to eliminate CLS (Brand v3 § 16). Defaults
 * are SEO-friendly: lazy-load below-the-fold, async decoding, eager+high
 * priority for hero images.
 *
 *   <Image
 *     src="/images/hero.jpg"      // expects an adjacent /images/hero.webp
 *     alt="Mustapha at a school IT install in Mexico"
 *     width={1200} height={630}
 *     loading="eager" fetchPriority="high"   // for above-fold hero only
 *     sizes="(max-width: 768px) 100vw, 50vw"
 *   />
 *
 * Props:
 *   src           — base path; webp counterpart auto-derived by extension swap
 *   alt           — REQUIRED for a11y + SEO. Empty string only for decorative
 *   width, height — REQUIRED in pixels (prevents CLS · Lighthouse penalises CLS > 0.1)
 *   loading       — "lazy" (default) or "eager"
 *   fetchPriority — "auto" (default) | "high" | "low"
 *   sizes         — responsive sizes attribute, defaults to "100vw"
 *   srcSetWebp    — explicit WebP srcset override
 *   srcSetJpg     — explicit fallback srcset override
 *   className     — applied to the <picture> wrapper
 *   imgClassName  — applied to the inner <img>
 *   onError       — callback when neither source loads (allows fallback UI)
 *   ...rest       — forwarded to <img>
 *
 * Notes:
 * - When `src` is already absolute (http(s)://...) or has no .jpg/.png/.jpeg
 *   extension, the WebP <source> is omitted and the component degrades to a
 *   plain <img> in a <picture> wrapper.
 * - When the WebP variant is not yet generated, browsers will skip the
 *   <source> and fall back to the <img>. Run `npm run images:webp` (defined
 *   in web/package.json after SEO07) to generate WebP siblings.
 */
export function Image({
  src,
  alt,
  width,
  height,
  loading = "lazy",
  fetchPriority = "auto",
  sizes = "100vw",
  srcSetWebp,
  srcSetJpg,
  className = "",
  imgClassName = "",
  onError,
  ...rest
}) {
  const [errored, setErrored] = useState(false)

  if (process.env.NODE_ENV !== "production" && !alt && alt !== "") {
    // Empty string is allowed (decorative); undefined is a developer mistake.
    // eslint-disable-next-line no-console
    console.warn("Image: `alt` prop is required for accessibility + SEO. Pass alt=\"\" only for decorative imagery.")
  }

  const isLocalRaster =
    typeof src === "string" &&
    /\.(jpe?g|png)$/i.test(src) &&
    !/^https?:\/\//i.test(src)

  const webpSrc = isLocalRaster ? src.replace(/\.(jpe?g|png)$/i, ".webp") : null

  function handleError(e) {
    setErrored(true)
    if (typeof onError === "function") onError(e)
  }

  return (
    <picture className={className}>
      {!errored && webpSrc && (
        <source srcSet={srcSetWebp || webpSrc} type="image/webp" sizes={sizes} />
      )}
      {!errored && srcSetJpg && (
        <source srcSet={srcSetJpg} sizes={sizes} />
      )}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding="async"
        sizes={sizes}
        onError={handleError}
        className={imgClassName}
        {...rest}
      />
    </picture>
  )
}

export default Image
