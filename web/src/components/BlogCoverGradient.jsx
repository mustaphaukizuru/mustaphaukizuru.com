/**
 * BlogCoverGradient · auto-generated cover image for blog posts
 * ─────────────────────────────────────────────────────────────────────────
 * Used when a post has `cover: null`. Generates a unique, on-brand
 * gradient cover from the post's category accent color + the post title,
 * displayed as a beautiful illustrated header rather than a blank space.
 *
 * Design language: glassmorphism card with mesh gradient, decorative
 * geometric shapes, the category chip, and the post title typeset in
 * Sora Extra-Bold — matching the Brand Identity v3.1 slide template spec.
 *
 * Props:
 *   title        — post title (used as large background text)
 *   category     — category label string
 *   accent       — category accent hex color
 *   readMinutes  — reading time number
 *   aspectRatio  — CSS aspect-ratio (default "16 / 7")
 *   className    — extra classes on the wrapper
 */
export default function BlogCoverGradient({
  title = "",
  category = "",
  accent = "#5D3FD3",
  readMinutes,
  aspectRatio = "16 / 7",
  className = "",
}) {
  /* Generate a unique-but-deterministic second color from the accent
     by rotating hue ~140° — gives warm↔cool contrast on every category */
  const secondColor = rotateHue(accent, 140)
  const thirdColor  = rotateHue(accent, 220)

  return (
    <div
      className={`relative w-full overflow-hidden ${className}`}
      style={{
        aspectRatio,
        background: `linear-gradient(135deg, ${accent}22 0%, ${secondColor}18 55%, ${thirdColor}14 100%)`,
      }}
      aria-hidden="true"
    >
      {/* Mesh aurora blobs */}
      <div
        className="pointer-events-none absolute"
        style={{
          inset: 0,
          background: [
            `radial-gradient(ellipse 70% 60% at 10% 20%, ${accent}30, transparent 65%)`,
            `radial-gradient(ellipse 50% 70% at 80% 70%, ${secondColor}22, transparent 60%)`,
            `radial-gradient(ellipse 40% 40% at 50% 10%, ${thirdColor}18, transparent 55%)`,
          ].join(", "),
        }}
      />

      {/* Decorative concentric rings — top right */}
      <svg
        className="pointer-events-none absolute -right-12 -top-12 opacity-[0.12]"
        width="240"
        height="240"
        viewBox="0 0 240 240"
        fill="none"
        aria-hidden="true"
      >
        {[120, 95, 70, 45].map((r, i) => (
          <circle
            key={r}
            cx="120"
            cy="120"
            r={r}
            stroke={accent}
            strokeWidth={i === 0 ? 1.5 : 1}
            fill="none"
            opacity={1 - i * 0.15}
          />
        ))}
      </svg>

      {/* Decorative dot grid — bottom left */}
      <svg
        className="pointer-events-none absolute -bottom-4 -left-4 opacity-[0.08]"
        width="160"
        height="120"
        viewBox="0 0 160 120"
        aria-hidden="true"
      >
        {Array.from({ length: 5 }, (_, row) =>
          Array.from({ length: 8 }, (_, col) => (
            <circle
              key={`${row}-${col}`}
              cx={col * 20 + 10}
              cy={row * 24 + 12}
              r="2"
              fill={accent}
            />
          ))
        )}
      </svg>

      {/* M-mark watermark — brand §23 "12% opacity on every slide" */}
      <div
        className="pointer-events-none absolute bottom-4 right-4 font-display text-[56px] font-extrabold leading-none tracking-[-0.04em] select-none"
        style={{ color: accent, opacity: 0.08 }}
        aria-hidden="true"
      >
        M
      </div>

      {/* Content layer */}
      <div className="relative flex h-full flex-col justify-between p-5 sm:p-6">
        {/* Top row — category + read time */}
        <div className="flex items-center justify-between">
          {category && (
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{
                backgroundColor: `${accent}18`,
                color: accent,
                border: `1px solid ${accent}30`,
              }}
            >
              {category}
            </span>
          )}
          {readMinutes && (
            <span className="font-mono text-[10px] font-semibold text-charcoal/40">
              {readMinutes} min read
            </span>
          )}
        </div>

        {/* Title */}
        <p
          className="line-clamp-3 font-display text-[15px] font-extrabold leading-snug tracking-tight text-charcoal sm:text-[17px]"
          style={{ maxWidth: "85%" }}
        >
          {title}
        </p>
      </div>

      {/* Subtle noise texture — brand §10 */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8," +
            encodeURIComponent(
              "<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.06 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>",
            ) +
            "\")",
        }}
      />
    </div>
  )
}

/* ── Utility: rotate hue of a hex color by `deg` degrees ─────────────── */
function rotateHue(hex, deg) {
  const [r, g, b] = parseHex(hex)
  const [h, s, l] = rgbToHsl(r, g, b)
  const newH = ((h + deg / 360) % 1 + 1) % 1
  const [nr, ng, nb] = hslToRgb(newH, s, l)
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`
}

function parseHex(hex) {
  const c = hex.replace("#", "")
  const f = c.length === 3 ? c.split("").map((x) => x + x).join("") : c
  return [parseInt(f.slice(0,2),16), parseInt(f.slice(2,4),16), parseInt(f.slice(4,6),16)]
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h, s, l = (max + min) / 2
  if (max === min) { h = s = 0 } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      default: h = ((r - g) / d + 4) / 6
    }
  }
  return [h, s, l]
}

function hslToRgb(h, s, l) {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v] }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [hue2rgb(p, q, h + 1/3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1/3)].map(v => Math.round(v * 255))
}

function hue2rgb(p, q, t) {
  if (t < 0) t += 1; if (t > 1) t -= 1
  if (t < 1/6) return p + (q - p) * 6 * t
  if (t < 1/2) return q
  if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
  return p
}

function toHex(n) { return Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0") }
