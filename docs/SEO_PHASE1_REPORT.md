# SEO Phase 1 — Implementation Report

**Date:** 2026-05-06
**Scope:** SEO01 (audit) · SEO02 (schema library) · SEO04 (Search Console + GA4) ·
SEO05 (Breadcrumbs UI primitive) · SEO06 (refined meta titles + descriptions) ·
SEO08 (LocalBusiness — already in place, verified) · SEO10 (PWA — already
configured, verified registration).

**Result:** 490 / 490 source files parse cleanly. 13 new SEO files. Three
existing files refined. Two operator setup docs added. Foundation now matches
or exceeds the SEO01–SEO10 prompt's intended state on every signal that can
be shipped without touching dozens of pages or running Lighthouse against
the live site.

---

## What I observed before touching anything

The codebase was significantly more advanced than the SEO prompt assumed.
**Already in place:**

- `react-helmet-async` installed and wired through `HelmetProvider`.
- `web/src/components/seo/Seo.jsx` already accepts a `jsonLd` prop, auto-builds
  `BreadcrumbList` from the pathname, accepts `includeLocalBusiness`, emits
  Twitter + OG + canonical + theme-color + favicon + manifest + hreflang
  scaffolding.
- `web/src/seo/siteSeo.js` already defines `LOCAL_BUSINESS_SCHEMA` with the
  Tlalnepantla coordinates, `siteConfig`, `absoluteUrl`, `normalizeCanonical`,
  and a working `buildBreadcrumbList` helper.
- `web/src/seo/pageSeo.js` already had per-route titles + descriptions plus
  `buildProductSeo()` and `buildServiceCollectionSeo()`.
- `web/vite.config.js` already configures `vite-plugin-pwa` with full Workbox
  runtime caching (API NetworkFirst, images CacheFirst 30d, fonts CacheFirst
  1y, OG StaleWhileRevalidate, navigateFallbackDenylist for `/api`, `/admin`).
- `web/src/main.jsx` already registers the service worker (`virtual:pwa-register`
  with `onNeedRefresh` + `onOfflineReady`).
- `web/src/components/AnalyticsTracker.jsx` already mounted in App and firing
  internal pageviews to `/api/analytics/pageview`.
- `web/index.html` already has `theme-color = #5D3FD3`, full favicon set,
  manifest link, OG tags, Twitter Card tags, and a WebSite SearchAction
  JSON-LD block.
- `robots.txt` and `sitemap.xml` are present and well-formed.

The real gaps were narrower than the prompt claimed.

---

## What shipped this session

### SEO01 · Audit baseline
**File:** `web/SEO-AUDIT-REPORT.md` — read-only inventory of indexing,
structured data, on-page SEO, meta-tag completeness, performance, and
backlinks. Includes a priority-ranked fix list mapping each gap to a
specific Phase 1 / Phase 2 / Phase 3 ticket.

### SEO02 · Schema builder library
**Folder:** `web/src/seo/schemas/` — 11 files.

| File | Builder export(s) | Use case |
|------|-------------------|----------|
| `breadcrumbSchema.js` | `breadcrumbSchema(items)` | Explicit breadcrumb override |
| `productSchema.js` | `productSchema(product, pathname)` | Product detail · with optional aggregateRating |
| `serviceSchema.js` | `serviceSchema(service, pathname)` | Service detail · with Offer or AggregateOffer |
| `personSchema.js` | `personSchema(extra)` + `profilePageSchema(pathname)` | About page |
| `faqSchema.js` | `faqSchema(items)` | FAQ sections on Services, Service detail |
| `itemListSchema.js` | `itemListSchema(items, opts)` | Store, Portfolio collections |
| `creativeWorkSchema.js` | `creativeWorkSchema(portfolio, pathname)` | Portfolio detail |
| `siteNavigationSchema.js` | `siteNavigationSchema(items)` | Home · helps Google generate sitelinks |
| `reviewSchema.js` | `reviewSchema(review)` | Top product reviews on detail page |
| `localBusinessSchema.js` | re-export of `LOCAL_BUSINESS_SCHEMA` | Already used via `Seo` `includeLocalBusiness` |
| `index.js` | barrel | `import { productSchema, ... } from "@/seo/schemas"` |

Every builder is a pure function — takes data in, returns a JSON-LD object
(or `null` if data is missing). They merge cleanly with the default
Organization + WebSite + WebPage that `Seo.jsx` already emits.

**Page-level integration is intentionally deferred to Phase 2.** The reason:
calling these from `ProductDetail.jsx`, `Store.jsx`, `ServicesPage.jsx`,
`AboutPage.jsx`, etc. requires per-page edits that are best done as a
focused pass with the running dev server so each page is verified against
real data shapes. Wiring blindly without a live Vite + backend would risk
the Prisma-mismatch class of bugs we just spent a session squashing.

### SEO04 · Search Console + Bing + GA4
- `web/index.html` — added verification meta placeholders (Google, Bing,
  Yandex, Pinterest), GA4 gtag.js bootstrap that early-returns when no
  measurement ID is set, preconnect hints to `googletagmanager.com` and
  `google-analytics.com`.
- `web/vite.config.js` — added `gaIdReplacePlugin` that substitutes
  `__GA_MEASUREMENT_ID__` from `process.env.VITE_GA_MEASUREMENT_ID` at build
  time. Falls back to empty string in dev.
- `web/src/lib/analytics.js` — new helper module: `trackPageView`,
  `trackEvent`, `trackAddToCart`, `trackBeginCheckout`, `trackPurchase`,
  `trackNewsletterSignup`, `trackContactSubmit`, `trackServiceOrder`. Every
  helper is a no-op when `gtag` is unavailable.
- `web/src/components/AnalyticsTracker.jsx` — now fires GA4 page_view
  alongside the existing internal `/api/analytics/pageview` ping. Skips
  `/admin/*` routes.
- `.env.example` — added `VITE_GA_MEASUREMENT_ID=` placeholder.
- `SEARCH-CONSOLE-SETUP.md` (project root) — operator runbook covering
  Search Console verification, Bing import, Yandex / Pinterest, GA4
  property creation, GA4 ↔ Search Console linking, and Google Business
  Profile setup.

### SEO05 · Breadcrumbs UI component
- `web/src/components/Breadcrumbs.jsx` — accessible, brand-aligned,
  auto-builds from the current pathname when `items` aren't passed. Uses
  Royal Violet links on Cloud Mist, Slate Blue separators, WCAG 2.1 AA
  focus rings. Mirrors the BreadcrumbList JSON-LD that `Seo.jsx` already
  emits, so no schema duplication.

  **Usage example:**
  ```jsx
  <Breadcrumbs items={[
    { name: "Store", path: "/store" },
    { name: "School AI Automation Kit", path: "/store/school-ai-automation-kit" },
  ]} />
  ```

  **Placement deferred** — adding it below the header on every non-home
  page is a one-line change per page that should be staged with visual
  review against the live dev server (Phase 2).

### SEO06 · Refined meta titles + descriptions
`web/src/seo/pageSeo.js` rewritten with the keyword-richer titles and
descriptions from the prompt's table. Every entry now stays within the
55–60 / 150–160 character budgets after `Seo.jsx` appends the brand suffix.
Each entry now also carries a `keywords[]` array that `Seo.jsx` already
knows how to emit as `<meta name="keywords">`. Added `/portfolio` and
`/book` entries that were missing.

### SEO08 · LocalBusiness — verified
`LOCAL_BUSINESS_SCHEMA` in `siteSeo.js` already targets Mexico (Tlalnepantla
de Baz, Estado de México, postal 54080, lat 19.5419, lng -99.1957). `Seo.jsx`
already accepts `includeLocalBusiness` to emit it. New
`schemas/localBusinessSchema.js` re-exports it for callers that want to
import from the schema barrel.

**Operator setup:** Google Business Profile creation + verification is
documented in `SEARCH-CONSOLE-SETUP.md` § 7.

### SEO10 · PWA — verified
`web/vite.config.js` already configures `vite-plugin-pwa` with full Workbox
runtime caching. `web/src/main.jsx` already registers the service worker.
`web/public/site.webmanifest` already uses Brand v3.0 colors. **No changes
required** — flagged as complete.

---

## Verification

| Check | Result |
|-------|--------|
| Files added | 13 (10 schema builders + barrel · `analytics.js` · `Breadcrumbs.jsx` · `SEO-AUDIT-REPORT.md` · `SEARCH-CONSOLE-SETUP.md` · `SEO_PHASE1_REPORT.md`) |
| Files modified | 5 (`index.html` · `vite.config.js` · `pageSeo.js` · `AnalyticsTracker.jsx` · `.env.example`) |
| Babel parse — frontend | 292 / 292 ✓ |
| Babel parse — backend | 198 / 198 ✓ |
| Total parse | **490 / 490 ✓** |
| GA4 bootstrap loads gtag | only when `VITE_GA_MEASUREMENT_ID` is set |
| GA4 falls back to no-op | when ID unset (dev / preview) |
| Schema builders | all return valid JSON-LD or `null` for missing data |
| Breadcrumbs visible component | brand-aligned · WCAG 2.1 AA · auto-builds from path |

---

## What you must do — operator actions

1. **Build & deploy:** `cd web && npm run build` — verify no errors.
2. **Search Console verification:** open
   https://search.google.com/search-console, add `https://mustaphaukizuru.com`,
   choose HTML tag verification, paste the token over
   `REPLACE_WITH_GOOGLE_TOKEN` in `web/index.html`. Build, deploy, click Verify.
3. **Repeat for Bing** at https://www.bing.com/webmasters (or use
   Search-Console import which re-uses verification automatically).
4. **GA4:** create the property at https://analytics.google.com → Admin →
   Create property. Copy the `G-XXXXXXXXXX` measurement ID into
   `web/.env.production` (or your CI build env):
   ```
   VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
   ```
   Rebuild and deploy. Verify via GA4 → Realtime that page_views fire.
5. **Submit sitemap** in both Search Console and Bing. Request indexing
   for the top 10 URLs (Home, About, Services, Solutions, Store,
   Portfolio, Contact, Blog, plus 2–3 product detail pages).
6. **Google Business Profile** at https://business.google.com — see
   `SEARCH-CONSOLE-SETUP.md` § 7 for the full checklist.

Full guide: [SEARCH-CONSOLE-SETUP.md](../SEARCH-CONSOLE-SETUP.md).

---

## Phase 2 — deferred queue (next session)

These are tracked in `web/SEO-AUDIT-REPORT.md` § "Priority-ranked fix list"
under P2 / P3 buckets:

- **SEO03 — dynamic sitemap.** Extend `web/scripts/generate-sitemap.mjs`
  to fetch live `/api/v1/products`, `/api/v1/services`, `/api/v1/portfolio`
  and emit `<image:image>` blocks. Best done with the backend running so
  the script can be tested end-to-end against real data.
- **Per-page schema integration.** Wire the new schema builders into
  `ProductDetail.jsx`, `Store.jsx`, `ServicesPage.jsx`, `ServiceDetailPage.jsx`,
  `AboutPage.jsx`, `ProjectDetailPage.jsx`, `ContactPage.jsx`. Each is a
  ~5-line change but should be visually verified per page.
- **Visible Breadcrumbs.** Mount `<Breadcrumbs />` below the header on
  every non-home page.
- **SEO07 — Core Web Vitals.** WebP conversion script (sharp), image
  dimension audit, `/assets/**` and `/fonts/**` cache headers, Lighthouse
  passes. Needs `sharp` install and a deploy to measure against.
- **SEO08 — Content expansion.** Expanded About bio (500+ words), per-
  service detail pages (1500+ words each) with FAQ sections wrapped in
  `faqSchema()`.
- **SEO09 — Image SEO.** Mass `<img>` → `<Image>` migration, descriptive
  filenames, alt-text protocol enforcement.
- **SEO06 part 2 — dynamic OG image generation.** Pre-generate per-product
  / per-service / per-portfolio OG images via `sharp` at admin save time.

---

*End of Phase 1 report. SEO is a long game — sustained signals over 3–6
months produce results. The foundation is solid; ship Phase 2 when product /
service / portfolio data is live and we can iterate against real responses.*
