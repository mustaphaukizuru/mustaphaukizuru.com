# Core Web Vitals · Baseline + Optimization Plan

Snapshot taken **2026-05-03**. Use this as the launch-day reference for what's
already optimized, what to fix before/after launch, and how to measure.

---

## ✅ Already in place

### Build pipeline (Vite)

- Route-level **lazy loading** on every page (~25 routes wrapped in `React.lazy` + `<Suspense>`)
- **manualChunks** splits vendor bundles cleanly: `react-dom`, `router`, `framer`, `lucide`, `vendor` — keeps the initial JS payload small and lets the browser cache vendor code separately from app code
- `minify: "esbuild"` + `sourcemap: false` in production
- `assetsInlineLimit: 4096` — small assets get base64-inlined to save HTTP round-trips
- `chunkSizeWarningLimit: 500` — surfaces accidental bloat at build time

### Asset loading

- **Variable fonts preloaded** with `crossorigin` (Sora + JetBrains Mono) — eliminates FOIT/FOUT on first paint
- **PWA / Service Worker** via `vite-plugin-pwa`:
  - API: NetworkFirst + 5s timeout + 1h offline cache
  - Images: CacheFirst, 30 days
  - Fonts: CacheFirst, 1 year
  - Outdated caches auto-cleaned
- `theme-color` and `color-scheme` meta tags for browser UI hint
- `<meta name="robots" content="...max-image-preview:large">` for richer SERP cards

### SEO + indexing

- Dynamic `/sitemap.xml` (built earlier)
- `robots.txt` with proper Disallow + Sitemap pointer
- JSON-LD `Product` + `BreadcrumbList` + `FAQPage` on ProductDetail
- JSON-LD `Service` on ServicesPage

---

## 🔴 Block — fix before launch

### 1 · Image weight is the elephant

**Total weight in `web/public/images/`: 11.9 MB across 22 files.** Five files are >1 MB. The Vite build copies all of them to `/public/` so they're shipped to every visitor that touches a project page.

| File | Size | Issue |
|---|---|---|
| `projects/intellectual-school/*.png` (6 files) | 6.4 MB | Project gallery PNGs that should be WebP |
| `projects/raindrop-college/*.png` (6 files) | 2.6 MB | Same |
| `profile/Ukizuru_Mustapha_Professional_Headshot.png` | 1.1 MB | **Not even referenced anywhere** in `web/src/` — dead weight |
| `profile/Ukizuru_Mustapha_Photo.jpg` | 0.5 MB | Used as AboutHero photo — should be ~80–150 KB WebP |
| `projects/ukizuru-portfolio/*.png` (6 files) | 1.2 MB | Project gallery PNGs → WebP |

**Fix**: convert to WebP at q80. Typical savings 70–85%.

```bash
# Dry run first — see what would be converted
npm run optimize:images

# Apply
npm run optimize:images -- --apply

# After review, update <img src> tags to .webp OR wrap critical ones in <picture>
```

The `optimize:images` script is at `scripts/optimize-images.sh`. It needs `cwebp` installed locally:
- macOS: `brew install webp`
- Linux: `apt-get install webp`
- Windows: Download from https://developers.google.com/speed/webp/download (extract, add `bin/` to PATH)

After conversion, **delete the original PNG/JPG** to save bundle weight (or commit both during a transition period and update `<img>` src incrementally).

### 2 · Drop the unused 1.1 MB headshot PNG

`Ukizuru_Mustapha_Professional_Headshot.png` (1.1 MB) is in `web/public/images/profile/` but no `web/src/` file references it. It still ships to every visitor via the static folder copy. Delete it.

```bash
rm "web/public/images/profile/Ukizuru_Mustapha_Professional_Headshot.png"
```

### 3 · Hero image preload on Home

The Home page LCP is the hero composition. Browser doesn't know to fetch the hero image until JavaScript loads + React renders, costing ~200–400ms of LCP. Once the hero asset is finalised (ideally a WebP after step 1), add a `<link rel="preload">` to `web/index.html`'s `<head>`:

```html
<link rel="preload" as="image" href="/images/profile/Ukizuru_Mustapha_Photo.webp" fetchpriority="high" />
```

(Skip this step until you've actually done step 1 — preloading a 0.5 MB JPG hurts more than it helps.)

---

## 🟡 Polish — tackle after first launch

### 4 · Responsive `srcset` for the project galleries

Every project gallery image is served at full resolution regardless of viewport. Generate 3 sizes (400w, 800w, 1200w) and use `srcset` so a phone doesn't download a 1200px asset:

```html
<img
  src="/images/projects/raindrop/raindrop-1.webp"
  srcset="
    /images/projects/raindrop/raindrop-1-400.webp   400w,
    /images/projects/raindrop/raindrop-1-800.webp   800w,
    /images/projects/raindrop/raindrop-1-1200.webp 1200w"
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
  alt="Raindrop College brand application"
  loading="lazy"
/>
```

Below-the-fold images should always have `loading="lazy"`.

### 5 · `font-display: swap` audit

Sora and JetBrains Mono are preloaded but verify the `@font-face` declaration uses `font-display: swap` (not `block`). Otherwise text is invisible until the font loads, hurting both LCP and CLS.

```bash
grep -rn "font-display" web/src/
```

### 6 · Drop framer-motion from the initial bundle

Framer Motion is ~50 KB gzipped and currently in the initial vendor split. Most landing pages don't need it on first paint — the hero animation could be CSS keyframes. Worth ~150 ms TBT improvement on slow connections.

Quick check:
```bash
grep -rln "framer-motion" web/src/components/heroes/
```

If only used in heroes, consider replacing with CSS animations there. Defer Framer Motion to lazy-loaded route components.

### 7 · Defer PayPal SDK loading

`CheckoutPage.jsx` injects the PayPal SDK script (~280 KB) on mount. It blocks Time-to-Interactive on the checkout page. Defer it until the user actually picks PayPal as the payment method:

```jsx
useEffect(() => {
  if (paymentMethod !== "paypal") return  // ← add this guard
  if (!PAYPAL_CLIENT_ID) return
  if (window.paypal) { setPaypalReady(true); return }
  // ... existing SDK loader
}, [paymentMethod])
```

### 8 · `loading="lazy"` everywhere below the fold

`grep -rn '<img' web/src/pages/` and add `loading="lazy"` to every product card, project thumbnail, and gallery item. Trivial change, frees significant TBT on long pages.

---

## 📏 Measurement runbook

### Lighthouse (local · most reliable)

```powershell
# Install Lighthouse CLI globally (one-time)
npm install -g lighthouse

# Boot the production preview locally
cd web
npm run build      # Vite builds to /public, served by Express
cd ..
npm start          # API + frontend on http://localhost:5000

# In another shell — run Lighthouse against each critical page
lighthouse http://localhost:5000/                       --output=html --output-path=./reports/home.html         --view --preset=desktop
lighthouse http://localhost:5000/                       --output=html --output-path=./reports/home-mobile.html  --view --form-factor=mobile
lighthouse http://localhost:5000/store                  --output=html --output-path=./reports/store.html        --view --preset=desktop
lighthouse http://localhost:5000/services               --output=html --output-path=./reports/services.html     --view --preset=desktop
lighthouse http://localhost:5000/store/<some-product>   --output=html --output-path=./reports/product.html      --view --preset=desktop
```

Save the four reports as the **launch baseline**. After deploying, re-run against the live URL and compare.

### Targets — what "good" looks like

| Metric | Good | Needs work | Poor |
|---|---|---|---|
| **LCP** (Largest Contentful Paint) | ≤ 2.5s | 2.5–4.0s | > 4.0s |
| **INP** (Interaction to Next Paint) | ≤ 200ms | 200–500ms | > 500ms |
| **CLS** (Cumulative Layout Shift) | ≤ 0.1 | 0.1–0.25 | > 0.25 |
| **TBT** (Total Blocking Time) | ≤ 200ms | 200–600ms | > 600ms |
| **Lighthouse Performance score** | ≥ 90 | 50–89 | < 50 |

Realistic post-image-optimization targets for this stack on a deployed Hostinger VPS: 90+ on desktop, 75+ on mobile. The mobile gap is mostly Hostinger's TLS handshake + initial server response time; not much you can do about it without a CDN.

### PageSpeed Insights (real-user data, after launch)

Once the site has real traffic, Google's CrUX dataset will start populating:

- https://pagespeed.web.dev/?url=https%3A%2F%2Fmustaphaukizuru.com%2F&form_factor=mobile

Check it weekly. Field data trumps lab data for understanding actual user experience.

### WebPageTest (for waterfall diagnosis)

When something looks slow but you can't tell why:

- https://www.webpagetest.org/easy
- Pick "Mobile · Slow 4G · Moto G4" for a worst-case test
- Read the waterfall to spot blocking requests, render-blocking CSS, late-discovered images

---

## 🔬 What you should hit after the punch list above

If you do steps 1–3 (image conversion + dead-asset removal + hero preload):

- **Total page weight on `/`**: drops from ~12 MB to ~2 MB
- **LCP on Home**: probably -1.5s on mobile
- **Lighthouse Performance score**: +20 to +30 points

Steps 4–8 add another ~10 points each but are diminishing returns.

---

## Files in this batch

```
scripts/optimize-images.sh         NEW   image-conversion script (dry-run by default)
package.json                       EDIT  added "optimize:images" npm script
docs/CORE_WEB_VITALS.md            NEW   this file
```
