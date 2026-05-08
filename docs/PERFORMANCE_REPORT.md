# Core Web Vitals · audit + fixes + measurement plan

**Date:** May 6, 2026  
**Scope:** Audit the frontend for Core Web Vitals issues a code review
can catch — font loading strategy, third-party-script footprint, DNS
resolution latency, asset chunking. Patches applied for everything
code-fixable; operator-side Lighthouse runs listed at the bottom for
quantified impact.

## Headline finding

**The brand font wasn't actually loading.** `index.html` preloaded
both Sora-Variable.woff2 (56 KB) and JetBrainsMono-Variable.woff2
(114 KB) via `<link rel="preload" as="font">`, but **zero
`@font-face` declarations existed anywhere in the CSS**. The browser
downloaded the font files, never registered them, and `font-family:
"Sora"` silently fell through to system-ui across the entire site.

Two costs:

1. **Brand consistency lost** — every page rendered with system-ui
   instead of Sora. The brand font preview in /admin/bio is the only
   surface that ever rendered correctly because PDFs.js inlines its
   own @font-face for embedded font preview.
2. **Bandwidth waste** — ~170 KB of font payload downloaded on every
   first visit and never used. Then served from cache forever.

Fixed.

## Issues found and fixed

| # | Severity | Issue | Fix |
|---|---|---|---|
| 1 | **Critical (brand + perf)** | No `@font-face` declarations — preloaded fonts never registered | Added `@font-face` blocks for Sora + JetBrains Mono with `font-display: swap` so fallback text shows immediately and swaps without CLS |
| 2 | **High (perf)** | Google Identity Services SDK (~80 KB) loaded on every page via unconditional `<script>` in `index.html` | Removed from `index.html`; `GoogleLoginButton` now lazy-injects the script on mount with idempotent insert (won't re-add on remount) |
| 3 | Medium | No DNS prefetch for payment gateways → ~80–150ms first-checkout DNS-lookup tax | Added `<link rel="dns-prefetch">` for PayPal (3 origins), MercadoPago (3 origins), and `accounts.google.com` |
| 4 | Medium | iOS Safari auto-links phone-number-shaped strings (years, prices) | Added `<meta name="format-detection" content="telephone=no">` |
| 5 | Low | Vite `assetsInlineLimit: 4096` inlines small SVGs into JS bundles, defeating CDN caching of those bytes | Lowered to `1024` — keeps tiny placeholder SVGs inline (where round-trip dominates) without bleeding medium icons into the bundle |

## Files changed

```
web/src/index.css                          — @font-face for Sora + JetBrains Mono
web/index.html                             — removed unconditional GSI, added DNS prefetch + format-detection
web/src/components/GoogleLoginButton.jsx   — lazy GSI loader on first mount
web/vite.config.js                         — assetsInlineLimit lowered to 1024
docs/PERFORMANCE_REPORT.md                 — this file
```

Bonus: `web/src/layout/Footer.jsx` was missing the closing `)` after
`</footer>` — same AV-truncation pattern as a previous session — caught
during the parse-sweep verification and patched.

## What was already solid

The audit confirmed a lot of strong existing work:

- **Route-level code splitting** — every page-level component already
  uses `React.lazy(() => import(...))`. The router emits per-page
  chunks rather than one mega-bundle. Fully wired across public,
  member, and admin route trees.
- **Manual chunk strategy** in `vite.config.js` — React + ReactDOM +
  scheduler in one chunk; router, framer-motion, lucide-react,
  react-icons each in their own chunks; everything else in `vendor`.
  Avoids the React/vendor circular-import warning Rollup emitted in
  earlier rounds.
- **Workbox runtime caching** — API (NetworkFirst, 5s timeout, 1h
  cache), images (CacheFirst, 30 days), fonts (CacheFirst, 1 year),
  OG assets (StaleWhileRevalidate). All set up by the SEO Phase 3 work.
- **Font preload tags in `<head>`** — already present, now
  effective with the @font-face declarations behind them.
- **GA preconnect** — saves ~80ms on first gtag request.
- **Long-cache headers + immutable** on `/assets` and `/fonts` — set
  in `app.js` from the SEO Phase 3 work.
- **Hashed Vite asset filenames** — content-addressed, safe to cache
  for 1 year.
- **`<Image />` component** with WebP-first responsive serving from
  SEO Phase 3A — wired up for all new image use.

## Expected Core Web Vitals impact

These are code-review estimates. Actual Lighthouse runs will quantify
the wins after deployment.

### Largest Contentful Paint (LCP)

- **Before:** Hero text rendered with system-ui because Sora never
  registered. The "preloaded" font files were dead-weight bytes.
- **After:** Sora applies on second paint via `font-display: swap`.
  LCP element (hero h1) renders immediately with system-ui as fallback,
  then swaps when Sora is parsed (~50–150ms post-preload). LCP target
  unchanged — text-heavy LCP elements always paint with first
  available font under `swap`. Net win: brand-correct rendering with
  no LCP regression.

### Cumulative Layout Shift (CLS)

- `font-display: swap` does cause a font-swap layout reflow when Sora
  arrives. Mitigation: Sora's metrics are very close to system-ui
  defaults at the same weights. If post-deployment Lighthouse flags
  CLS regression, add `size-adjust` and `ascent-override` to the
  `@font-face` declarations to match system-ui metrics exactly.
- Removing GSI from every page drops one render-blocking deferred
  script — no CLS impact, but reduces TBT (Total Blocking Time).

### First Input Delay / INP

- ~80 KB less JS to parse on every public page (GSI removal). Direct
  TBT/INP improvement, especially on low-end mobile.
- DNS prefetch is a network optimization with no parse-time cost.

### Time to First Byte (TTFB)

- No changes. TTFB is server-side; the work here is all client-side.

## Operator-side Lighthouse runs

These need the deployed site, not local dev:

1. **Mobile + Desktop Lighthouse** on `/`, `/store`, `/services`,
   `/about`, `/contact`. Capture Performance / Accessibility / SEO
   scores. Targets:
   - Performance ≥ 85 (mobile), ≥ 90 (desktop)
   - Accessibility ≥ 95
   - SEO ≥ 95
   - Best Practices ≥ 90
2. **Web Vitals** — use the [PageSpeed Insights](https://pagespeed.web.dev/)
   field-data report after a few days of real traffic. Targets:
   - LCP ≤ 2.5s
   - CLS ≤ 0.1
   - INP ≤ 200ms
3. **Bundle visualizer** — `ANALYZE=true npm run build` and inspect
   `public/stats.html`. Confirm:
   - Per-route page chunks are 30–80 KB each
   - `react-vendor` is the largest non-route chunk
   - No duplicate dependencies between route chunks (e.g. lucide
     re-bundled per-page)
4. **Network panel · waterfall on /** — confirm:
   - Sora.woff2 + JetBrainsMono.woff2 in `<head>` Initiator
     before HTML parse
   - GSI script absent from network until /login navigation
   - No phone numbers rendered as auto-links
5. **DevTools Performance tab** — record a cold load of `/`, look
   at the Long-Tasks track for any > 50ms task that could be split.
6. **Real-device Safari iOS** — checkout flow on actual iPhone (not
   Simulator). Validates:
   - Font rendering (iOS rejects malformed @font-face silently)
   - PayPal Buttons SDK on WebKit
   - format-detection meta is honoured
7. **Lighthouse CI in GitHub Actions** — if you want regression
   protection. Configure thresholds matching the targets above.

## What was deliberately deferred

These were considered but skipped for Phase B:

- **`size-adjust` / `ascent-override` font metrics override** — only
  needed if CLS regression actually surfaces in Lighthouse data.
  Adding pre-emptively would risk introducing a different visual
  regression.
- **`react-icons` tree-shaking audit** — the manual-chunk strategy
  already isolates it. Worth a closer look only if the `icons`
  chunk grows above 100 KB.
- **Image lazy-loading default on `<img>` tags** — many pages still
  use raw `<img>` instead of the `<Image />` component. Bulk
  conversion is a separate phase — most of those images are
  below-the-fold and would benefit from `loading="lazy"`.
- **Critical CSS inlining** — Tailwind v4 + Vite already produce
  reasonable CSS sizes (~30 KB compressed). Inlining critical CSS
  would trade simplicity for a marginal LCP improvement that's
  better captured by font-display: swap which already shipped.
- **HTTP/2 server push hints** — Hostinger's Node setup doesn't
  expose the underlying HTTP/2 connection to user code; not actionable.
- **Service Worker stale-while-revalidate for HTML** — Workbox is
  already configured with `navigateFallback: "/index.html"` which
  handles SPA routing offline. Adding HTML SWR would interfere with
  the auth-aware shell.

## Verification

- 504 / 504 source files parse cleanly via Babel after every patch.
- Font files exist on disk: `web/public/fonts/Sora-Variable.woff2`
  (56 KB), `JetBrainsMono-Variable.woff2` (114 KB).
- DNS prefetch landed: 6 prefetch tags + 1 preconnect on auth domain
  in index.html.
- GSI script tag count in index.html: 0 (was 1).
- @font-face count in index.css: 2 (was 0).

---

**Bottom line:** The single most impactful change is the `@font-face`
fix — every visitor since launch has been seeing system-ui where the
brand font should have been. Combined with the GSI lazy-load, public
pages should see ~80 KB less JS execution per first visit. DNS
prefetch is the cheapest fix here, but compounds well with the
checkout-flow improvements from the payment-hardening + store-launch
phases. Real Lighthouse numbers need a deployed run to confirm.
