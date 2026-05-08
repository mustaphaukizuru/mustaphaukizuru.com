/**
 * SEO09 · <Image /> — responsive image component
 *
 * Wraps <picture> with WebP-first / fallback-format swap, explicit width/height
 * to eliminate Cumulative Layout Shift, and `loading` + `decoding` defaults
 * tuned for Core Web Vitals.
 *
 * USAGE:
 *   <Image src="/images/products/hero.jpg" alt="Hero"
 *          width={1200} height={630} />
 *
 *   With explicit srcSet:
 *   <Image src="/images/products/hero.jpg" alt="Hero"
 *          width={1200} height={630}
 *          srcSet={[
 *            { src: "/images/products/hero-480.webp",  width: 480  },
 *            { src: "/images/products/hero-960.webp",  width: 960  },
 *            { src: "/images/products/hero-1920.webp", width: 1920 },
 *          ]}
 *          sizes="(max-width: 768px) 100vw, 50vw"
 *   />
 *
 *   Above-the-fold hero (eager-load):
 *   <Image src="..." alt="..." width={...} height={...} priority />
 *
 * BEHAVIOR:
 *   - If `srcSet` is provided, emits a <picture> with WebP <source> first,
 *     then a fallback (e.g. JPG) <source>, then the <img> tag.
 *   - If `srcSet` is omitted, uses `src` as-is — caller is responsible for
 *     having generated optimized images already (build step or Hostinger CDN).
 *   - `priority` flips loading to "eager" + decoding to "sync" + sets
 *     fetchpriority="high" for above-the-fold hero images. Otherwise lazy.
 *   - `width` and `height` are MANDATORY when no `aspectRatio` style is set.
 *     They prevent CLS by reserving the layout slot before the image loads.
 *
 * NOTE: This component does NOT generate optimized images itself. It assumes
 * the caller has either:
 *   (a) pre-generated WebP + JPG variants at build time, or
 *   (b) is using a CDN that serves modern formats automatically.
 */

const propTypes = null; // intentional, keep this component prop-types-free; React 19 + JSDoc above is enough

function isAbsolute(url) {
  return /^(https?:)?\/\//i.test(url) || url.startsWith("data:") || url.startsWith("blob:");
}

function deriveFallbackFormat(src) {
  // If the primary src is a JPG/PNG, use it as the fallback type.
  // If it's already WebP, AVIF, or unknown, default fallback to JPEG.
  const lower = String(src || "").toLowerCase().split("?")[0];
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".avif")) return "image/avif";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "image/jpeg";
}

function joinSrcSet(items) {
  if (!Array.isArray(items) || items.length === 0) return undefined;
  return items.map(({ src, width }) => `${src} ${width}w`).join(", ");
}

export default function Image({
  src,
  alt,
  width,
  height,
  srcSet, // optional: array of { src, width }
  fallbackSrcSet, // optional: array of { src, width } for non-WebP browsers
  sizes = "100vw",
  priority = false,
  className = "",
  style,
  decoding,
  loading,
  fetchPriority,
  draggable,
  onLoad,
  onError,
  ...rest
}) {
  if (!src) return null;
  if (typeof alt !== "string") {
    // Decorative image MUST pass alt="" explicitly per a11y rules.
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[<Image />] alt is required. Use alt=\"\" for decorative images.");
    }
  }

  const eager = priority === true;
  const finalLoading = loading ?? (eager ? "eager" : "lazy");
  const finalDecoding = decoding ?? (eager ? "sync" : "async");
  const finalFetchPriority = fetchPriority ?? (eager ? "high" : "auto");

  const hasSrcSet = Array.isArray(srcSet) && srcSet.length > 0;
  const webpSrcSet = hasSrcSet ? joinSrcSet(srcSet) : undefined;
  const fallbackSet = Array.isArray(fallbackSrcSet) && fallbackSrcSet.length > 0
                          ? joinSrcSet(fallbackSrcSet)
                          : undefined;
  const fallbackType = deriveFallbackFormat(src);

  const imgEl = (
    <img
      src={src}
      alt={alt || ""}
      width={width}
      height={height}
      loading={finalLoading}
      decoding={finalDecoding}
      fetchpriority={finalFetchPriority}
      draggable={draggable}
      className={className}
      style={style}
      onLoad={onLoad}
      onError={onError}
      {...rest}
    />
  );

  // No multi-source variants → emit plain <img> (still gets lazy + width/height).
  if (!hasSrcSet) return imgEl;

  return (
    <picture>
      <source
        type="image/webp"
        srcSet={webpSrcSet}
        sizes={sizes}
      />
      {fallbackSet && (
        <source
          type={fallbackType}
          srcSet={fallbackSet}
          sizes={sizes}
        />
      )}
      {imgEl}
    </picture>
  );
}

void propTypes;
