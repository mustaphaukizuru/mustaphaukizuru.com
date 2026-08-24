# Design System v1.2

**Source of truth:** `web/src/styles/tokens.css`. Tailwind utilities are registered from it in `web/src/index.css` under `@theme`. A small JS mirror lives at `web/src/styles/tokens.js` for the few places CSS variables cannot reach.

> **The rule: tokens win over any generated palette.** If a design tool, an AI suggestion, a screenshot, or a component library hands you a hex — map it to the nearest token. Never paste it. `npm run lint:tokens` enforces this on every push.
>
> **The second rule: a brand anchor is not automatically a text colour.** Every pair we actually render as text is declared in `web/scripts/check-contrast.mjs` and checked against WCAG 2.1 AA by `npm run lint:contrast`. Both gates run inside `npm run lint`.

---

## Palette

| Token | Hex | Role | On-colour |
|---|---|---|---|
| `--color-violet` | `#5D3FD3` | Brand anchor · primary buttons · headings | white (6.7:1) |
| `--color-violet-light` | `#8B6FE8` | Violet text on dark surfaces | charcoal (4.5:1) |
| `--color-violet-mid` | `#7B5FE0` | Gradient mid-stop between violet and violet-light | white (4.6:1) |
| `--color-violet-deep` | `#4A2EAB` | Hover / active violet | white (9.3:1) |
| `--color-violet-pale` | `#EDE9FB` | Chip / callout background | violet (5.7:1) |
| `--color-violet-ghost` | `#F5F2FE` | Subtle wash | violet (6.1:1) |
| `--color-azure` | `#0284C7` | Action colour — **display type, icons, focus rings only** | white (4.1:1 — large text / non-text only) |
| `--color-azure-deep` | `#0369A1` | **Every azure body-size text**: links, chip labels, ghost buttons, solid action fills | white (5.9:1) |
| `--color-azure-pale` | `#E0F2FE` | Focus ring / info tint | `--color-azure-800` (6.6:1) |
| `--color-cyan` | `#7DD3FC` | Accent · dark-mode links | charcoal (10.3:1) |
| `--color-terracotta` | `#E9C46A` | Warmth · highlight on dark | charcoal (10.3:1) |
| `--color-terracotta-deep` | `#D4A847` | Hover terracotta (still a light hue — never body text on a light ground) | charcoal (9.1:1) |
| `--color-terracotta-800` | `#856212` | **NEW v1.2** — warm accent as body-size text on a light ground | white (5.6:1) · mist (5.4:1) |
| `--color-coral` | `#E07856` | Illustration accent (Services hero) — decoration, not text | charcoal (5.7:1) — never white (3.0:1) |
| `--color-coral-pale` | `#FCE7DC` | Coral chip background | charcoal (14.4:1) |
| `--color-charcoal` | `#1A1B23` | Primary text · dark sections | mist (16.4:1) |
| `--color-charcoal-light` | `#2A2C3A` | Elevated dark surface | white |
| `--color-charcoal-deep` | `#0E0F14` | Deepest dark canvas | mist |
| `--color-mist` | `#F8FAFC` | Page canvas | charcoal (16.4:1) |
| `--color-slate-50/100/200/300` | `#F2F2F2` `#EFF1F5` `#DCDCE4` `#A0A8B8` | Neutral fills and borders | charcoal |
| `--color-steel` / `-700` | `#64748B` `#475569` | Muted / secondary text. `steel` clears white (4.8:1) but **not** `slate-100` (4.2:1) — on any neutral fill use `steel-700` | white (4.8:1) / white (7.6:1) |
| `--color-mint` / `-light` | `#10B981` `#34D399` | Success **fills and icons** | charcoal (6.8:1) — never white (2.5:1) |
| `--color-mint-700` | `#065F46` | Success as body-size text / pill label | white (7.7:1) |
| `--color-amber` | `#F59E0B` | Pending / warning **fills and icons** | charcoal (8.0:1) — never white (2.2:1) |
| `--color-amber-700` | `#92400E` | Pending as body-size text / pill label | white (7.1:1) |
| `--color-rose` | `#E11D48` | Error / destructive | white (4.7:1) |
| `--color-code-fg` | `#C8C8D0` | Code text on the charcoal code surface | — (10.3:1 on charcoal) |
| `--color-avatar-1..5-bg/-fg` | see `tokens.css` | Deterministic initials-avatar tints | each pair ≥ 4.5:1 |

Semantic aliases (`--color-text-*`, `--color-surface-*`, `--color-border-*`, `--color-feedback-*`, `--color-action-*`, `--color-grad-*`) are derived from the above and are what dashboard dark mode re-points. **Prefer a semantic token over a raw brand token** whenever the surface can flip.

### Alpha variants

Never write `rgba(93, 63, 211, 0.06)` — that re-states the palette and drifts. Compose from the channel tokens:

```css
rgb(var(--color-violet-rgb)/0.06)          /* also legal inside a Tailwind arbitrary value */
shadow-[0_4px_16px_rgb(var(--color-violet-rgb)/0.06)]
```

Channels exist for violet, azure, terracotta, charcoal, mist, mint, amber, rose, coral.

---

## Type

`--font-display` and `--font-body` are both **Sora**; `--font-mono` is **JetBrains Mono**; `--font-script` (Caveat) is reserved for hand-drawn annotations inside hero illustrations and nowhere else.

| Class | Mobile | ≥1024px | Weight | Use |
|---|---|---|---|---|
| `.text-micro` | 10px / 0.12em | 11px | 500 | Labels, captions (sizing only — add `uppercase font-bold` for an eyebrow) |
| `.text-meta` | 12px | 13px | 500 | Metadata rows |
| `.text-body` | 14px / 1.65 | 15px | 400 | Body copy |
| `.text-lead` | 16px | 17px | 400 | Intro paragraphs |
| `.text-card` | 18px | 20px | 600 | Card titles |
| `.text-section` | 24px | 32px | 700 | Section H2 |
| `.text-page` | 32px | 48px | 800 | Page H1 |
| `.text-display` | 32px → 40 → 48 | **52px hard cap** | 800 | Hero headlines |

`.eyebrow` is the only surface where uppercase is automatic.

---

## Spacing · radius · motion

- **Spacing** — 4px base: `--space-1 … --space-24` (4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96px). Fluid section rhythm: `--space-section`, `--space-section-y`, `--space-card`, `--space-stack`.
- **Radius** — `--radius-sm|md|lg|xl|2xl|full`. Tailwind's `rounded-sm…xl` map to the `@theme` scale (10/14/20/28px).
- **Shadow** — three elevations only: `--shadow-rest`, `--shadow-hover`, `--shadow-overlay`.
- **Motion** — `--motion-fast|base|slow|deliberate` with `--ease-standard|decelerate|accelerate|spring` (and `--ease-out-soft` for Framer Motion). All durations collapse to `0ms` under `prefers-reduced-motion`.
- **Z-index** — five layers: `--z-base|dropdown|sticky|modal|toast`. Nothing above `--z-toast`.

---

## Adding a token

1. **Try not to.** Find the nearest existing token first — a value within ~2% perceptual distance (ΔE ≲ 3) should snap to it, not spawn a sibling.
2. If the colour is used **3+ times** and has no near neighbour, add it:
   - declare it in `web/src/styles/tokens.css` with a `/* NEW vX.Y — why */` comment;
   - register it in the `@theme` block of `web/src/index.css` so Tailwind emits utilities;
   - if it needs an alpha variant, add `--color-<name>-rgb: R G B` too;
   - add the row to the palette table above **with its on-colour contrast ratio**.
3. Verify contrast: any text/background pair must be **≥ 4.5:1** (≥ 3:1 for text ≥ 24px or ≥ 19px bold). Add the pair to `PAIRS` in `web/scripts/check-contrast.mjs` so it stays true.
4. Run `npm run lint:tokens` and `npm run lint:contrast` (`npm run lint` runs both).

**Known exceptions** live in the `ALLOW` map of `web/scripts/check-raw-hex.mjs` and are limited to third-party brand marks (payment rails, OAuth buttons, vendor logos, flags), self-contained hand-drawn illustration palettes, and pure black/white literals. Every entry carries a written reason. Adding one to silence the gate is not a sanctioned use.

---

## Contrast

`npm run lint:contrast` parses the token declarations, flattens any `bg-<token>/<alpha>` against the surface it sits on, and checks every pair we actually render: **4.5:1** for body-size text, **3:1** for large text (≥ 24px, or ≥ 18.66px bold) and non-text UI. `node scripts/check-contrast.mjs --report` prints the whole table with ratios.

**The nine debts listed in v1.1 are closed.** Not one brand anchor moved — each was fixed at the usage site:

| Was | Now | Ratio | How |
|---|---|---|---|
| `azure` on white — 4.10 | `azure-deep` on white | **5.93** | links, chip labels and ghost buttons swapped to `azure-deep`; on `azure-pale` grounds to `azure-800` (6.59) |
| `azure` on mist — 3.91 | `azure-deep` on mist | **5.67** | same swap |
| white on `azure` — 4.10 | white on `azure-deep` | **5.93** | the one solid azure fill (audit-modal selected option) darkened |
| `terracotta` on `violet` — 4.03 | `terracotta` on `violet-deep` | **5.54** | eyebrow pills on violet grounds lost their `bg-white/10` wash for a `bg-violet-deep` fill |
| `violet` on `terracotta` — 4.03 | `violet-deep` on `terracotta` | **5.54** | terracotta CTAs and the About-timeline dot label swapped to `violet-deep` |
| white on `mint` — 2.54 | `charcoal` on `mint` | **6.76** | fill kept (the mint *is* the success signal), label darkened |
| white on `amber` — 2.15 | `charcoal` on `amber` | **7.98** | same |
| white on `coral` — 3.00 | `charcoal` on `coral` | **5.71** | no white-on-coral shipped; coral is illustration-only. The one coral *text* use became `terracotta-800` (5.60) |
| `steel` on `slate-100` — 4.21 | `steel-700` on `slate-100` | **6.70** | every `bg-slate-100 text-steel` pill |

Body-size `mint` / `amber` / `terracotta` text on light grounds was the same failing pair read in the other direction; those moved to `mint-700` (7.68), `amber-700` (7.09) and the new `terracotta-800` (5.60).

### Intentionally exempt

AA does not apply to these, and they keep the brand anchor on purpose:

- **Large / display type** — `.text-display` and `.text-page` accent words in `azure` (4.10 on white) or `terracotta`. The 3:1 bar applies.
- **Icons and glyph marks** — lucide icons, `<Star fill>` ratings, hero sparkles, the icon inside an `h-8`…`h-14` tinted tile.
- **Decoration** — violet↔azure gradients, blurred blobs, `ring-*` / `border-*` tints, chart series fills and sparkline strokes, `rgb(var(--color-*-rgb)/…)` washes used as surfaces.

### Remaining debt

Two are known and deliberately unchanged, because fixing them means changing what the brand looks like rather than which token a label uses:

- `terracotta` as the accent word in a **light-ground** display headline (`components/PageHero.jsx` light variant, the Blog hero) is 1.9:1 — below even the 3:1 large-text bar. On dark grounds the same accent is 10.3:1. The fix is a different accent hue for light heroes, which is a brand decision, not a token swap.
- `mint` (2.54) and `amber` (2.15) as icon tints on white are below the 3:1 non-text bar. Every one of them sits beside a text label that already carries the state, so none is the sole carrier of meaning.

Both are listed in `EXEMPT` in `check-contrast.mjs` with the same reasoning, so the gate stays honest rather than silent.
