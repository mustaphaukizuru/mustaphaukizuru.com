# Brand Redesign Prompt — Image → On-Brand SVG

**Purpose:** Reusable prompt for redesigning any supplied image into an original,
on-brand illustration for mustaphaukizuru.com, at professional design standard.

**Version:** 1.0 · July 2026
**Owner:** Mustapha Ukizuru
**Brand reference:** Brand Identity System v3.0 (PROJECT_INSTRUCTIONS § 09)

---

## When to use

Paste the prompt below into a tool that can produce **vector or high-fidelity
output** — Recraft, Adobe Firefly, or an SVG-capable assistant. Do **not** use a
raster upscaler (e.g. Magnific); it will sharpen the source, not redesign it.

Always attach the **actual source image** — a text description alone yields
generic results.

---

## The prompt

> **ROLE:** You are a senior brand illustrator and visual designer. Redesign the
> image I provide into an original, on-brand illustration for
> mustaphaukizuru.com. Do not copy the source — extract its *concept and
> composition* only, then rebuild it from scratch to professional standard in my
> brand system. Output clean vector **SVG** (scalable, low file weight,
> retina-crisp).
>
> **SOURCE:** [attach or describe the image here]
>
> **BRAND PALETTE — use these exact values, no other hues:**
> - Anchor / dominant: Royal Violet `#5D3FD3`, with Violet Light `#8B6FE8` and Violet Pale `#EDE9FB`
> - Action / secondary: Deep Azure `#0284C7`; Electric Cyan `#7DD3FC` as a *spark accent only*, never a large fill
> - Warm accent: Soft Terracotta `#E9C46A` — exactly one small moment, ≤10% of the surface
> - Neutrals / depth: Midnight Charcoal `#1A1B23`, Cloud Mist `#F8FAFC`, Slate `#64748B`
> - Signature gradient (hero/premium surfaces): linear 135° `#5D3FD3 → #0284C7 → #7DD3FC`
>
> **DESIGN QUALITY RUBRIC — all mandatory:**
> 1. **Color balance (60-30-10):** ~60% violet family, ~30% azure/neutral, ~10% cyan+terracotta accents. Never stack more than three hues in the composition.
> 2. **Single light source:** pick one direction (upper-left) and keep every highlight, core shadow, and cast shadow consistent with it. No conflicting light.
> 3. **Depth & dimension:** build form with layered tonal steps — lightest plane (top/lit), mid plane, darkest plane (recessed). Use a soft, low-opacity brand-violet cast shadow on the ground, never harsh black.
> 4. **Shadow discipline:** shadows are desaturated violet/charcoal at low opacity, never pure `#000`. Ambient occlusion in the crevices, softer as it moves away.
> 5. **Contrast & accessibility:** any text or fine detail holds ≥ 3:1 against its background; the composition reads clearly at both large hero size and small thumbnail.
> 6. **Restraint:** clean geometry, generous negative space, one focal point, one warm accent. Modern and minimal — no gradients-as-decoration, no drop-shadow clutter, no dated skeuomorphism.
> 7. **Gradient rule:** the signature gradient appears once, on the primary/hero element only — not on every surface.
>
> **OUTPUT:**
> - One original SVG, transparent background, tightly cropped (no dead canvas).
> - All colors defined in a single `<defs>` gradient/variable block so I can recolor in one place.
> - After generating, run a self-check against the rubric above and list any point you compromised and why.

---

## Usage notes

- **Recolor later in one place.** The "all colors in a single `<defs>` block"
  instruction is what makes post-hoc recoloring trivial — keep it.
- **Watch two contrast pairs:** white/light detail on a front face, and any
  outline stroke on a pale fill. These are the first to fail WCAG AA when
  recoloring.
- **Format discipline (PROJECT_INSTRUCTIONS § 11):** import the result as a
  module from `web/src/assets/brand/`, never inline base64 or external CDN.
- **Icons are exempt:** icons remain Lucide React (§ 03). Use this prompt for
  hero/spot illustrations and marketing graphics, not UI icons.
