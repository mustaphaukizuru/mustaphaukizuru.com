import { useState } from "react"
import { Image } from "./Image"
import { TOKENS } from "../../styles/tokens.js"

/**
 * MediaSlot · a place an image goes, that looks finished before it has one
 * ─────────────────────────────────────────────────────────────────────────
 * The catalogue sells 24 services with no imagery at all, and there is no
 * illustration set — two SVGs in the whole tree, and they are near
 * duplicates of each other. So most of the places that WANT a picture
 * either have nothing or would show a broken one.
 *
 * The pattern this borrows is already in the repo and already works:
 * `BlogCoverGradient` draws an on-brand generative cover when a post has
 * `cover: null`, which is why the blog never looks unfinished. This
 * generalises that to every other slot — services, categories, case
 * studies, products, empty states — so a slot with no file is a deliberate
 * piece of brand art, not a grey box with a torn-page icon.
 *
 * Three states, one box, one aspect ratio:
 *
 *   src given, loads      → the real image, through <Image> (AVIF → WebP →
 *                           fallback, srcset, explicit dimensions)
 *   src given, 404s       → generative art. A file that has not been
 *                           uploaded yet must not turn into a layout hole.
 *   no src                → generative art
 *
 * The art is DETERMINISTIC on `seed`, so the same service keeps the same
 * cover between renders, deploys and languages — a card that reshuffles its
 * artwork on every navigation reads as a glitch.
 *
 * CLS: the wrapper owns the aspect ratio, so the box is the same size in all
 * three states and swapping a real file in later moves nothing.
 *
 * To fill a slot: drop the file at the `src` path this was given. Nothing
 * else changes — no code edit, no import. `docs/ASSET_SLOTS.md` lists every
 * path the app asks for and the size it wants.
 */

/**
 * Rotate a hex hue and return it WITH an alpha channel.
 *
 * The alpha is not optional and the first version of this got it wrong: it
 * returned a bare `hsl()`, which cannot take the `${color}18` hex-alpha
 * suffix the gradient stops were written with, so stops 2 and 3 rendered at
 * FULL saturation. A violet category came out orange-to-green and a
 * terracotta one came out cyan-to-purple — measured by screenshotting the
 * cards rather than trusting that it compiled.
 *
 * The rotations are small for the same reason. `BlogCoverGradient` rotates
 * 140° and 220° and gets away with it because every stop is ~8-13% alpha, so
 * the result is a pale wash. At full strength those are complementary hues
 * and they fight. Small shifts plus low alpha keep the accent recognisable
 * as the brand colour it is.
 */
function rotateHue(hex, deg, alpha = 0.12) {
  const h = hex.replace("#", "")
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  let hue = 0, s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0))
    else if (max === g) hue = (b - r) / d + 2
    else hue = (r - g) / d + 4
    hue *= 60
  }
  const hh = Math.round(((hue + deg) % 360 + 360) % 360)
  return `hsl(${hh} ${Math.round(s * 100)}% ${Math.round(l * 100)}% / ${alpha})`
}

/** Stable small integer from a string — same seed, same art, every time. */
function hashOf(seed) {
  let h = 0
  for (let i = 0; i < String(seed).length; i += 1) {
    h = (h * 31 + String(seed).charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/**
 * The fallback artwork. Deliberately abstract: it has to sit under a real
 * photograph's caption without pretending to be a photograph, and it has to
 * work for a school audit and a content calendar alike.
 */
function GeneratedArt({ seed, accent, label, aspectRatio, className }) {
  const h = hashOf(seed)
  // Small, same-family shifts. The accent stays the dominant colour.
  const second = rotateHue(accent, 34, 0.13)
  const third = rotateHue(accent, -26, 0.10)
  const wash = rotateHue(accent, 18, 0.22)
  // Four layouts, chosen by seed, so a grid of eight cards does not read as
  // one repeated tile.
  const variant = h % 4

  return (
    <div
      className={`relative w-full overflow-hidden ${className}`}
      style={{
        aspectRatio,
        background: `linear-gradient(135deg, ${accent}2E 0%, ${second} 52%, ${third} 100%)`,
      }}
      /* Decorative unless it was given a label. `role="img"` with an empty
         aria-label is an axe `role-img-alt` violation — I shipped exactly
         that and it failed on four cards. Where a heading beside the art
         already names the thing, the art carries no information and should
         be hidden from the accessibility tree rather than announced as an
         unnamed image. */
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": "true" })}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            `radial-gradient(ellipse 70% 60% at ${12 + (h % 30)}% 20%, ${accent}3D, transparent 65%)`,
            `radial-gradient(ellipse 50% 70% at ${60 + (h % 25)}% 75%, ${wash}, transparent 62%)`,
          ].join(", "),
          opacity: 0.9,
        }}
      />

      {/* One geometric motif per variant. Thin strokes only — this sits
          behind text often enough that a busy fill would fight it. */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <g fill="none" stroke={accent} strokeOpacity="0.22" strokeWidth="1.25">
          {variant === 0 && [70, 110, 150, 190].map((r) => (
            <circle key={r} cx={330 - (h % 40)} cy={60} r={r} />
          ))}
          {variant === 1 && [0, 1, 2, 3, 4, 5].map((i) => (
            <line key={i} x1={-40 + i * 90} y1={320} x2={120 + i * 90} y2={-20} />
          ))}
          {variant === 2 && [0, 1, 2, 3].map((i) => (
            <rect key={i} x={40 + i * 26} y={40 + i * 20} width={200} height={150} rx={18} />
          ))}
          {variant === 3 && [0, 1, 2, 3, 4].map((i) => (
            <path key={i} d={`M -20 ${90 + i * 34} Q 120 ${40 + i * 34} 220 ${100 + i * 34} T 440 ${70 + i * 34}`} />
          ))}
        </g>
      </svg>

      {/* A soft floor so a caption or a chip laid over the bottom edge keeps
          its contrast whatever the accent is. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
        style={{ background: `linear-gradient(to top, ${TOKENS.charcoal}26, transparent)` }}
      />
    </div>
  )
}

export default function MediaSlot({
  src,
  alt = "",
  seed,
  accent = TOKENS.violet,
  aspectRatio = "16 / 9",
  width,
  height,
  widths,
  sizes = "100vw",
  loading = "lazy",
  fetchPriority = "auto",
  className = "",
  imgClassName = "",
  rounded = "rounded-2xl",
}) {
  const [failed, setFailed] = useState(false)
  const showArt = !src || failed

  if (showArt) {
    return (
      <GeneratedArt
        seed={seed || alt || "slot"}
        accent={accent}
        label={alt}
        aspectRatio={aspectRatio}
        className={`${rounded} ${className}`}
      />
    )
  }

  return (
    <div className={`relative w-full overflow-hidden ${rounded} ${className}`} style={{ aspectRatio }}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        widths={widths}
        sizes={sizes}
        loading={loading}
        fetchPriority={fetchPriority}
        className="h-full w-full"
        imgClassName={`h-full w-full object-cover ${imgClassName}`}
        onError={() => setFailed(true)}
      />
    </div>
  )
}

export { MediaSlot, GeneratedArt }
