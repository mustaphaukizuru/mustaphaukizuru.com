# SEO Baseline · Launch Readiness Report

Snapshot taken **2026-05-03** after the SEO audit + dynamic sitemap wiring.
Use this as the launch-day reference for what's in place and what's still optional.

---

## ✅ Already in place (no action needed)

### Foundation

- **`<Seo />` primitive** (`web/src/components/seo/Seo.jsx`) — wraps `react-helmet-async`, emits `<title>`, `description`, canonical, Open Graph, Twitter Card, and an arbitrary number of JSON-LD `<script>` blocks.
- **`pageSeo.js` config** (`web/src/seo/pageSeo.js`) — per-route SEO defaults so every public page lands on the right meta without per-page duplication.
- **`robots.txt`** (`web/public/robots.txt`) — disallows admin, dashboard, checkout, cart, auth routes; declares the sitemap URL; sets canonical Host.
- **`site.webmanifest`** + favicon set (96x96, 192x192, 512x512, apple-touch-icon, .svg).

### Page-level JSON-LD

- **ProductDetail** emits `Product` + `BreadcrumbList` + `FAQPage` schemas (line 1300, `allJsonLd`).
- **ServicesPage** emits `Service` schema (line 131, inline `<script>`).

### Static metadata

Every public page that uses the `<Seo />` primitive gets:
- `<meta name="description">` with per-page copy
- `<link rel="canonical">` derived from `pageSeo.js`
- Open Graph: `og:title`, `og:description`, `og:image`, `og:type`, `og:url`
- Twitter Card: `summary_large_image` with title / description / image
- Optional `article:published_time` / `article:modified_time` when supplied

---

## 🆕 Added in this batch

### Dynamic `/sitemap.xml` endpoint

Backed by `src/services/sitemapService.js` — wired in `src/app.js` ahead of `express.static` so it pre-empts the legacy static file at `public/sitemap.xml`.

**What it includes**

| Source | Filter | Frequency hint | Priority |
|---|---|---|---|
| Static marketing pages (10) | hand-curated list | varies | 0.30–1.00 |
| `Product` rows | `isActive: true` | `weekly` | 0.7 |
| `Service` rows | `isActive: true` | `monthly` | 0.7 |
| `PortfolioProject` rows | `status: "published"` | `yearly` | 0.5 |
| `Page` (CMS) rows | `status: "published"` | `monthly` | 0.4 |

**Behaviour**

- 1-hour in-process cache (no DB hit per crawl).
- Fail-soft: if any one query throws, that section is skipped with a `console.warn` and the rest of the sitemap still serves.
- Hard fail-soft: if the entire dynamic build throws, falls back to the static `public/sitemap.xml` so SEO crawlers never see a 5xx.
- `Cache-Control: public, max-age=3600` so CDNs / browsers can cache too.
- `<lastmod>` derived from each row's `updatedAt` — Google's primary signal these days.
- CMS slugs that overlap a static page (e.g. `privacy`) are de-duped automatically.

**Smoke-tested** with stubbed Prisma data — 15 URLs generated, header / closing tag / dedup / cache all verified.

---

## 🟡 Optional — defer until you see real traffic

These are nice-to-have polish items that can ship after launch without blocking anything. Listed in order of expected impact.

### 1 · Add an `og:image` per product

`pageSeo.js` ships a brand default OG image. ProductDetail currently passes `seoImage` from the product's primary image, which is correct — but verify after launch that Twitter / LinkedIn previews render at the recommended 1200×630 ratio. Many product images are square and will be cropped awkwardly.

### 2 · `application/ld+json` for Organization on `/`

Adds a `WebSite` + `Organization` schema to the Home page. Lets Google show the brand panel and sitelinks search box. Roughly 30 lines, no DB queries.

### 3 · BreadcrumbList on every public page

Already on ProductDetail. Add to ServicesPage, AboutPage, BlogPostPage (when blog ships), and individual project pages.

### 4 · `lastmod` accuracy for static pages

Today the static-page entries use *today's date* as `lastmod` because there's no per-page CMS row to track. This is fine but technically lies to Google about content freshness — they'll deprioritise the signal over time. To fix: track marketing-page edits in a `Page` row (CMS-driven) and let the dynamic sitemap pick them up automatically.

### 5 · Sitemap index file

Once you exceed ~50,000 URLs in the sitemap (you won't anytime soon), split into category sitemaps and emit an index. Not a launch concern.

### 6 · Hreflang tags for Spanish pages

Mustapha's bio mentions intermediate Spanish. If the platform ever serves Spanish content, add `hreflang` annotations to every translated page.

---

## 🔴 Pre-deploy checklist

Before flipping the DNS to point at the new build:

- [ ] `npm run build` in `/web` (Vite copies `web/public/*` to `/public/*` for Express to serve)
- [ ] Restart the Node API
- [ ] Hit `https://mustaphaukizuru.com/sitemap.xml` — should return XML with the dynamic content, NOT the old static file
- [ ] Hit `https://mustaphaukizuru.com/robots.txt` — verify the `Sitemap:` line still resolves correctly
- [ ] Submit the sitemap to **Google Search Console** (https://search.google.com/search-console) — property is already verified for the domain, just paste `/sitemap.xml`
- [ ] Submit to **Bing Webmaster Tools** (https://www.bing.com/webmasters)
- [ ] Run **Rich Results Test** on a product URL: https://search.google.com/test/rich-results — should detect Product + Breadcrumb + FAQ schemas
- [ ] Run **Mobile-Friendly Test**: https://search.google.com/test/mobile-friendly
- [ ] Run **PageSpeed Insights** on `/`, `/store`, `/services`, and one product detail page — record baseline numbers
- [ ] Verify OG previews on:
  - LinkedIn Post Inspector: https://www.linkedin.com/post-inspector/
  - Twitter Card Validator: https://cards-dev.twitter.com/validator (legacy but still works)
  - Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/

---

## Files touched in this batch

```
src/services/sitemapService.js        NEW   ~190 lines
src/app.js                            EDIT  added sitemap route before express.static
docs/SEO_BASELINE.md                  NEW   this file
```

The legacy static `public/sitemap.xml` and `web/public/sitemap.xml` are untouched
and remain as fallbacks if the dynamic generator ever fails.
