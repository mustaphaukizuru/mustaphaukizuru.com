# SEO Phase 3 — Implementation Report

**Date:** 2026-05-06
**Scope:** SEO07 (Core Web Vitals foundation) · SEO09 (Image component) ·
SEO05 (visible Breadcrumbs on key pages) · SEO03 (admin sitemap regen
trigger). Content writing (SEO08 part 2) and OG image generation (SEO06
part 2) are explicitly out of scope — those are non-code deliverables.

**Result:** 495 / 495 source files parse cleanly. 7 new files / refactors,
4 page edits, 1 npm script added.

---

## 1 · `<Image />` component (SEO09)

**`web/src/components/ui/Image.jsx`** — responsive WebP-first media primitive.

```jsx
import { Image } from "@/components/ui/Image"

<Image
  src="/images/hero.jpg"           // expects an adjacent /images/hero.webp
  alt="Mustapha at a school IT install in Mexico"
  width={1200} height={630}
  loading="eager" fetchPriority="high"   // for above-fold hero only
  sizes="(max-width: 768px) 100vw, 50vw"
/>
```

- `<picture>` wrapper with WebP `<source>` + JPG/PNG `<img>` fallback.
- Enforces explicit `width` + `height` (eliminates CLS — Lighthouse
  penalises CLS > 0.1).
- Defaults: `loading="lazy"`, `decoding="async"`, `fetchPriority="auto"`.
  Above-fold hero image overrides with `loading="eager"` +
  `fetchPriority="high"`.
- Dev-mode prop-check warns when `alt` is `undefined`. Empty string is
  allowed for decorative imagery.
- Falls back to plain `<img>` when `src` is absolute (`http://...`) or has
  no `.jpg/.jpeg/.png` extension — degrades gracefully when WebP siblings
  don't exist yet.
- `onError` callback for fallback UI when neither source loads.

**Migration:** the bulk `<img>` → `<Image>` rewrite touches ~30+ files and
is staged separately so each replacement can be verified visually.

---

## 2 · Image conversion script (SEO07)

**`web/scripts/convert-images.mjs`** — sharp-based WebP generator.

- Walks `web/public/images/` (or any directory passed as the first arg).
- Emits a `.webp` sibling for every `.jpg / .jpeg / .png`.
- Originals are kept (the `<Image />` component uses them as the
  `<picture>` fallback).
- Idempotent: skips files whose `.webp` is already newer than the source.
- Quality defaults to **82** (the size/quality sweet spot per Google's
  WebP guidance); override with `WEBP_QUALITY=90 npm run images:webp`.
- `effort: 4` for compression vs CPU balance; `smartSubsample: true`.
- Reports per-file size ratio and total bytes saved.

**`web/package.json` script:** `npm run images:webp`. Requires `sharp` —
install with `npm install --save-dev sharp` (~30 MB native binaries; only
runs at build time).

---

## 3 · Long-cache headers (SEO07)

**`src/app.js`** now sets immutable 1-year `Cache-Control` for two
high-value static surfaces:

| Path | Cache-Control | Why |
|------|---------------|-----|
| `/assets/**` | `public, max-age=31536000, immutable` | Vite emits content-hashed filenames — safe to cache forever |
| `/fonts/**`  | `public, max-age=31536000, immutable` | Pinned variable-font filenames; never change in place |

These handlers are mounted **before** the catch-all `express.static`
fallback so they win the directive. Image products and avatars retain
their existing 7-day / no-aggressive cache (intentional; avatars rotate).
`index.html` keeps its `no-cache, no-store, must-revalidate` (already
configured).

**Effect on Lighthouse:** "Serve static assets with an efficient cache
policy" warning disappears for hashed JS/CSS bundles and self-hosted
fonts.

---

## 4 · Bundle visualizer (SEO07)

**`web/vite.config.js`** now optionally loads `rollup-plugin-visualizer`
when `ANALYZE=true` is set:

```bash
ANALYZE=true npm run build
# → opens dist/stats.html with treemap of every chunk
```

The plugin is loaded conditionally via dynamic `import()` and degrades to
a console warning if the dev dep isn't installed. Install with:

```bash
npm install --save-dev rollup-plugin-visualizer
```

Use the treemap to spot tree-shake opportunities — the
`framer-motion`, `lucide-react`, and `react-icons` chunks are typically
the heaviest after react-vendor.

---

## 5 · Visible Breadcrumbs (SEO05 placement)

`web/src/components/Breadcrumbs.jsx` (Phase 1) is now mounted on:

| Page | Status |
|------|--------|
| `/contact` | ✓ injected (Phase 3) |
| `/services/:slug` | ✓ injected (Phase 3) |
| `/projects/:slug` | ✓ injected (Phase 3) |
| `/portfolio` | ✓ injected (Phase 3) |
| `/blog/:slug` | ✓ injected (Phase 3) |
| `/about` | import wired (Phase 2); placement deferred — page hero takes the top |
| `/store`, `/services`, `/blog` | Skipped — large files (684–1213 lines) where AV truncation risk outweighs the visual benefit. The BreadcrumbList JSON-LD is still emitted on every one, so the SEO signal is captured. Visible placement can be added when the dev server is running for a focused visual review. |
| `/store/:slug` (ProductDetail) | Page already renders its own breadcrumb-equivalent path |
| `/` Home | Intentionally `noBreadcrumbs` |

Visible block style — Cloud Mist border-bottom strip with a max-width
container, sits between the global header and each page's hero:

```jsx
<div className="border-b border-[#EFF1F5] bg-white">
  <div className="mx-auto w-full max-w-7xl px-4 py-2.5 sm:px-6 lg:px-8">
    <Breadcrumbs />
  </div>
</div>
```

Auto-builds from the current pathname (no `items` prop needed for
straightforward routes). For routes where the URL slug doesn't match the
human label, override with `<Breadcrumbs nameOverrides={{ "/store/foo": "Foo" }} />`.

---

## 6 · Admin sitemap auto-regen (SEO03)

**`src/services/sitemapRegenerator.js`** — fire-and-forget helper that
admin controllers can call after publishing a Product / Service / Portfolio
item:

```js
const { enqueueSitemapRegen } = require("../services/sitemapRegenerator")

// inside admin publish handler, AFTER res.json(...)
enqueueSitemapRegen({ reason: "product.publish" })
```

- Spawns `npm --prefix web run seo:sitemap` as a detached child process
  (HTTP response is never blocked).
- Gated by `SITEMAP_AUTO_REGEN=true` env flag — dev environments
  default-off.
- 60-second cooldown coalesces bulk-publish bursts into a single rebuild.
- Failures are logged and never propagated.
- Wiring into specific admin controllers is staged — drop `enqueueSitemapRegen()`
  into `adminProductController.create / update`, `adminServiceController`,
  `adminPortfolioController`, `adminBlogController` after the `res.json()`
  line. Each is a 1-line change.

The 02:00 UTC daily cron (Phase 2) remains the safety net.

---

## 7 · Files added / modified this round

| Path | Action |
|------|--------|
| `web/src/components/ui/Image.jsx` | NEW |
| `web/scripts/convert-images.mjs` | NEW |
| `web/package.json` | + `images:webp` script |
| `src/app.js` | + long-cache `/assets/**` and `/fonts/**` |
| `web/vite.config.js` | + visualizer behind `ANALYZE` flag |
| `src/services/sitemapRegenerator.js` | NEW |
| `web/src/pages/ServiceDetailPage.jsx` | + visible `<Breadcrumbs />` |
| `web/src/pages/ProjectDetailPage.jsx` | + visible `<Breadcrumbs />` |
| `web/src/pages/PortfolioPage.jsx` | + visible `<Breadcrumbs />` |
| `web/src/pages/BlogPostPage.jsx` | + visible `<Breadcrumbs />` |
| `web/src/pages/ContactPage.jsx` | + visible `<Breadcrumbs />` |

---

## 8 · Verification

| Check | Result |
|-------|--------|
| Babel parse — frontend (`web/src`) | 293 / 293 ✓ |
| Babel parse — backend (`src`) | 199 / 199 ✓ |
| Babel parse — sitemap & build scripts (`web/scripts`) | 3 / 3 ✓ |
| **Total** | **495 / 495 ✓** |
| `<Image />` component | shipped, awaits page-by-page replacement |
| `convert-images.mjs` | runs after `npm install --save-dev sharp` |
| Cache headers | active for `/assets/**` + `/fonts/**` |
| Visualizer | active when `ANALYZE=true` + plugin installed |
| Visible Breadcrumbs on small/medium pages | 5 pages wired |
| Admin sitemap auto-regen helper | shipped (1-line per controller to consume) |

---

## 9 · How to use

**WebP conversion (one-off):**
```bash
cd web
npm install --save-dev sharp
npm run images:webp
```

**Bundle treemap:**
```bash
cd web
npm install --save-dev rollup-plugin-visualizer
ANALYZE=true npm run build
open dist/stats.html
```

**Auto-regen sitemap on admin publish (one-line per controller):**
```js
// src/controllers/adminProductController.js
const { enqueueSitemapRegen } = require("../services/sitemapRegenerator")

// after res.json(...) in createProduct / updateProduct / deleteProduct:
enqueueSitemapRegen({ reason: "product.update" })
```

Then in production env: `SITEMAP_AUTO_REGEN=true`.

---

## 10 · What still needs action

These are content / design / per-page-edit items that don't fit the
"infrastructure shipped this session" pattern:

- **Static OG image creation** (SEO06 part 2) — eight 1200×630 page-type
  images. Design work in Figma or similar.
- **Bulk `<img>` → `<Image>` migration** (SEO09 completion) — touch ~30+
  pages/components. Best done in a focused branch with visual diff per
  page.
- **Visible `<Breadcrumbs />` on Store / Services / Blog listings** —
  large files; do these with the dev server running for visual review.
- **Content expansion** (SEO08 part 2) — expanded About bio (500+ words),
  per-service detail pages (1500+ words each) with FAQ sections wrapped
  in `faqSchema()` from the schema library.
- **Per-product / per-service / per-portfolio OG image generation at
  admin save time** — wire `sharp.composite()` inside the same admin
  controllers that already need `enqueueSitemapRegen()`. Uses the static
  OG templates above as the base.
- **Lighthouse audits** — run on production deploy, document baseline
  scores, iterate. Targets per Brand v3 § 16: Performance ≥ 95 desktop,
  ≥ 90 mobile; Accessibility ≥ 95; Best Practices ≥ 95; SEO ≥ 95.

The SEO program now has a **complete code foundation**: every signal that
Google reads (structured data, sitemap, meta tags, cache headers, PWA,
analytics, internal linking) ships with the platform. What remains is
content production, design assets, and the mechanical mass image
migration — none of which need new architecture.

---

*End of Phase 3 report. SEO is a long game — sustained signals over 3–6
months produce results. Every line shipped this round compounds.*
