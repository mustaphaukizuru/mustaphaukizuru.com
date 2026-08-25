/**
 * tokens.js · JS mirror of the color tokens in `tokens.css`
 * ─────────────────────────────────────────────────────────────────────────
 * `var(--color-*)` is the right answer almost everywhere. A handful of
 * call sites genuinely cannot use it:
 *
 *   · <canvas> 2D contexts (`ctx.fillStyle`) — no CSS variable resolution
 *   · code that PARSES the value (`parseInt(hex.slice(0,2), 16)`, hue rotation)
 *   · code that APPENDS an 8-digit alpha suffix (`${color}80`)
 *   · `<meta name="theme-color">` / web-app manifest values
 *
 * Those sites import from here instead of hard-coding a hex literal, so
 * there is still exactly ONE place a brand color is written down per
 * medium. Keep every value in this file byte-identical to its
 * `--color-*` counterpart in `tokens.css` — the `lint:tokens` check
 * verifies that they never drift apart.
 *
 * DO NOT import this for anything that can take a CSS value. Use
 * `var(--color-violet)` (or the Tailwind `bg-violet` utility) there.
 */
export const TOKENS = {
  violet:       "#5D3FD3",
  violetLight:  "#8B6FE8",
  violetMid:    "#7B5FE0",
  violetDeep:   "#4A2EAB",
  azure:        "#0284C7",
  cyan:         "#7DD3FC",
  terracotta:   "#E9C46A",
  coral:        "#E07856",
  charcoal:     "#1A1B23",
  charcoalDeep: "#0E0F14",
  mist:         "#F8FAFC",
  mint:         "#10B981",
  mintLight:    "#34D399",
  amber:        "#F59E0B",
  rose:         "#E11D48",
  white:        "#FFFFFF",
}

export default TOKENS
