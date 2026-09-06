# Asset slots — where to drop images

**Written:** 2026-09-06 · **Component:** `web/src/components/ui/MediaSlot.jsx`

Every path below is a slot the app already asks for. Drop a file there and it
appears — no code change, no import, no rebuild of anything but the bundle.

Until a file exists, `MediaSlot` draws **on-brand generative art** seeded on
the item's slug: a soft wash in the category's accent with one thin geometric
motif. That is deliberate, not a placeholder graphic — a slot with no file
looks finished, so the catalogue can ship before the photography does. The art
is deterministic, so the same service keeps the same cover across renders,
deploys and both languages.

The box owns its aspect ratio, so swapping a real file in **moves nothing** —
no layout shift either way.

---

## 1 · Service categories — **generated, in place**

**Status: done.** All four exist as 1600×900 JPGs with full AVIF + WebP
variant sets (`-400/-800/-1200/-1600`), built by
`cd web && npm run service-covers:build`. Verified loading on `/services`:
each card fetches the 800px AVIF for its 422px slot.

They are *generated brand art*, not photography — same pipeline as the nine
product covers (`scripts/og/*`, the real Brand v3 tokens, Sora, the same
rasteriser). Drop a photograph at the same path and it wins; the generator is
not wired into the build, so nothing overwrites a real asset. Re-run it only
if you want the generated versions back.

Four files cover the whole catalogue. The 24 offerings inherit their
category's cover, which is why this is four assets rather than twenty-four.

| Drop at | Used by |
|---|---|
| `public/images/services/it-strategy-consulting.jpg` | `/services` card + `/services/it-strategy-consulting` hero |
| `public/images/services/ai-automation.jpg` | same pattern |
| `public/images/services/cloud-architecture-migration.jpg` | same |
| `public/images/services/digital-product-engineering.jpg` | same |

**Spec:** 1600×900 (16:9), JPG or PNG. The card crops to 16:9 and the detail
hero to 16:10, so keep the subject centred and away from the bottom edge —
a caption gradient sits there.

**If you replace one**, run `cd web && npm run images:webp` then
`node scripts/generate-avif.js --apply` (from the repo root) to re-emit the
siblings the slot's `srcset` asks for. Without them the original still loads;
with them mobile gets a 400px file instead of a 1600px one, which matters
given FCP is over budget on every page.

Both `web/public/images/services/` and `public/images/services/` carry the
files — Vite serves the first in dev and wipes the second on build, Express
serves the second in production. The generator writes both.

---

## 2 · Case studies

`ProjectShowcase` uses the project's own image folder. Only three of these
exist today, so most cards currently show generative art.

| Drop at | Notes |
|---|---|
| `public/images/projects/<project-slug>/` | Folder per project; the first image is the cover |

**Spec:** 1600×1200 (4:3). Cover is cropped to 16:10 and anchored top-left, so
put the important part at the top.

**Have:** `intellectual-school`, `raindrop-college`, `ukizuru-portfolio` (54
files each — full sets).

---

## 3 · Store products

| Drop at | Notes |
|---|---|
| `public/images/products/<product-slug>/` | Rendered `object-contain` on a pale square |

**Spec:** 1200×1200 (1:1), transparent PNG preferred — the card contains
rather than crops, so a product mockup on transparency looks best.

**Have:** 9 slugs already have a cover directory. Anything without one draws
generative art.

**Note:** `cd web && npm run covers:build` generates the nine covers
programmatically. Real product mockups will beat it.

---

## 4 · Already filled — leave alone

| Slot | Status |
|---|---|
| Blog post covers | `BlogCoverGradient` generates one per post. Working as designed. |
| 404 page | `NotFoundArt` — a branded SVG illustration already exists |
| Home showcase | `public/images/pages/home-platform-showcase.png` + full variant set |
| Profile / headshots | `public/images/profile/` — two photos, full variant sets |
| Client logos | `public/images/brand/companies/` — 7 logos, AVIF + WebP + @2x |
| Contact form art | `public/images/pages/Conctact_Form_Image.svg` |
| OG share cards | `public/og/` — 14 files, and `npm run seo:og-static` generates more |

---

## 5 · Still worth having, no slot wired yet

These need a design decision before a slot goes in, so they are listed rather
than stubbed:

- **Illustration set.** The tree has two SVGs (`il-cloud-server.svg`,
  `il-server-cloud.svg`) and they are near-duplicates. A set of ~8 in one
  style would serve the empty states, the how-it-works steps and the schools
  page. Until then those places use icons, which is honest but plain.
- **Category header banners** (2400×800) for the top of each
  `/services/<slug>` page, above the current hero. The hero slot in §1
  covers the need for now.
- **Per-service OG cards** (1200×630 × 24). `npm run seo:og-static` can
  generate them from the catalogue once a template exists.

---

## Adding a new slot

Import from the modules directly, **not** from the `ui` barrel — re-exporting
MediaSlot there put it, `accent.js` and `Image.js` on the homepage's critical
path (~14 KB for components the homepage never renders), and Rollup cannot
tree-shake a barrel re-export.

```jsx
import MediaSlot from "../components/ui/MediaSlot"
import { accentFor } from "../components/ui/accent"

<MediaSlot
  src={`/images/services/${category.slug}.jpg`}
  alt={name}                        // "" if a heading already names it
  seed={category.slug}              // keeps the art stable
  accent={accentFor(category.accent)}
  aspectRatio="16 / 9"
  widths={[400, 800, 1200]}
  sizes="(max-width: 640px) 100vw, 33vw"
/>
```

`alt` is required by the a11y gate for anything meaningful, and must be `""`
for decorative art whose meaning is already in an adjacent heading.
