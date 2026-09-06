import { TOKENS } from "../../styles/tokens.js"

/**
 * accentFor · resolve a token NAME to the hex a canvas or a gradient needs.
 *
 * The catalogue stores accents as names ("violet", "terracotta") because
 * that is what the Tailwind utilities take. MediaSlot's generative art has
 * to PARSE the colour to rotate its hue, so it needs the literal value —
 * and `styles/tokens.js` is the one place a brand hex is allowed to be
 * written down for exactly this reason.
 *
 * This lives in its own module rather than beside the component because
 * `react-refresh/only-export-components` is an error in this repo: a file
 * that exports both a component and a plain function breaks fast refresh,
 * and the rule says to split it. It was worth splitting anyway — a colour
 * lookup is not a component.
 */
export function accentFor(name) {
  const map = {
    violet: TOKENS.violet,
    azure: TOKENS.azure,
    terracotta: TOKENS.terracotta,
    mint: TOKENS.mint,
    coral: TOKENS.coral,
    cyan: TOKENS.cyan,
    amber: TOKENS.amber,
    charcoal: TOKENS.charcoal,
  }
  return map[String(name || "").trim()] || TOKENS.violet
}


/* ── readableOn ──────────────────────────────────────────────────────────
 *
 * Darken a brand accent until it actually reads on a near-white ground.
 *
 * The blog's category chip set `color: accent` on `background: accent15` —
 * the accent as text on an 8% tint of itself. That cannot pass for a light
 * accent, and measured it did not: terracotta came out at 1.6:1, mint 2.34,
 * azure 3.69, violet-mid 4.16. Twenty-three failing nodes on /blog at
 * desktop width.
 *
 * The alternative was charcoal text with the accent kept only as the dot,
 * which always passes but throws away the coloured chip. This keeps the
 * colour and walks its lightness down in HSL until the ratio clears the
 * threshold, so a chip stays recognisably mint or terracotta and is legible
 * at the same time.
 *
 * Deterministic and cheap — a handful of iterations over four accents, at
 * render time, with no allocation worth caring about.
 */

function hexToRgb(hex) {
  const h = String(hex).replace("#", "")
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16))
}

function relLum([r, g, b]) {
  const f = [r, g, b].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]
}

function ratio(a, b) {
  const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Multiply each channel toward black — a cheap, hue-preserving darken. */
function darken(rgb, factor) {
  return rgb.map((v) => Math.max(0, Math.round(v * factor)))
}

/* Rebuilds a hex from channels this module already computed — it is not a
   brand value written down, which is why the token gate is fine with it. */
const toHex = (rgb) => "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("")

/**
 * @param {string} accent  brand hex, e.g. TOKENS.terracotta
 * @param {string} ground  the near-white ground it sits on (the chip's own
 *                         accent tint); defaults to white
 * @param {number} target  required ratio (4.5 for normal text)
 */
/**
 * Composite `hex` at `alpha` over `ground`, returning the flat colour a
 * browser actually paints.
 *
 * Needed because `readableOn` was being asked the wrong question. The blog
 * chip's background is `${accent}15` — the accent at 8% over white — and I
 * passed plain white as the ground. Violet-mid clears 4.5:1 on white but
 * only reaches 4.16:1 on its own tint, so five chips stayed red after the
 * first fix. Measuring against the real ground is the difference.
 */
export function compositeOver(hex, alpha, ground = TOKENS.white) {
  const fg = hexToRgb(hex)
  const bg = hexToRgb(ground)
  return toHex(fg.map((v, i) => Math.round(v * alpha + bg[i] * (1 - alpha))))
}

export function readableOn(accent, ground = TOKENS.white, target = 4.5) {
  const bg = hexToRgb(ground)
  let rgb = hexToRgb(accent)
  if (ratio(rgb, bg) >= target) return accent
  // 24 steps of 6% is enough to take the lightest brand colour past 4.5:1
  // against white without ever reaching pure black.
  for (let i = 0; i < 24; i += 1) {
    rgb = darken(rgb, 0.94)
    if (ratio(rgb, bg) >= target) return toHex(rgb)
  }
  return toHex(rgb)
}


export default accentFor
