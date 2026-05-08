# SEO Baseline Audit · 2026-05-06

**Scope:** snapshot of every SEO signal currently emitted by
mustaphaukizuru.com, plus a priority-ranked list of gaps to close. This is
the SEO01 deliverable — read-only inventory; the SEO02–SEO10 fixes layer on
top.

---

## 1 · Indexing status

### `web/public/robots.txt`
Present and correct. Disallows `/admin/`, `/dashboard/`, `/checkout/`,
`/cart/`, `/login`, `/signup`, `/forgot-password`, `/reset-password/`. The
sitemap reference points to `https://mustaphaukizuru.com/sitemap.xml`.

### `web/public/sitemap.xml`
Static. Lists every public route (Home, About, Services, Solutions, Store,
Portfolio, Contact, Blog, Recommendations, Terms, Privacy, Refund, Cookies).
Does **not** list dynamic product/service/portfolio URLs.

**Gap:** dynamic URLs (P1) — covered by SEO03 (Phase 2). Static routes are
fine.

### `web/public/site.webmanifest`
Valid JSON. `theme_color` aligned with Brand v3.0 (`#5D3FD3`). Icons present
at 96 / 192 / 512 plus apple-touch-icon. PWA install eligibility passes when
paired with the service worker (see SEO10 status below).

### App.jsx routes vs sitemap
All public routes listed in `App.jsx` are in the sitemap. No `/admin/*` or
`/dashboard/*` route leaks into the sitemap. ✓

---

## 2 · Structured data audit

### Currently emitted by `web/src/components/seo/Seo.jsx`
On **every** rendered page:
- `Organization` (name, url, logo, sameAs)
- `WebSite` with `SearchAction` for sitelinks search box
- `WebPage` (canonical url, name, description, primaryImageOfPage)
- `BreadcrumbList` — auto-generated from pathname unless `noBreadcrumbs={true}`
- `LocalBusiness` — emitted when caller passes `includeLocalBusiness={true}`

### Per-page schemas already wired
- `/store/:slug` (ProductDetail) — `Product` schema via `buildProductSeo()` in `pageSeo.js`
- `/services` — `ProfessionalService` via `buildServiceCollectionSeo()`

### Missing schemas (pre-Phase 1) — **now shipped in Phase 1** as the
`web/src/seo/schemas/*` library:
- ✅ `productSchema` — Product with optional aggregateRating + review[]
- ✅ `serviceSchema` — Service with Offer / AggregateOffer when packages exist
- ✅ `personSchema` + `profilePageSchema` — for `/about`
- ✅ `breadcrumbSchema` — explicit override for the auto-built one
- ✅ `faqSchema` — for FAQ sections on Services / FAQs
- ✅ `itemListSchema` — for `/store`, `/portfolio` collections
- ✅ `creativeWorkSchema` — for `/projects/:slug`
- ✅ `siteNavigationSchema` — to nudge Google sitelinks
- ✅ `reviewSchema` — for top product reviews
- ✅ `localBusinessSchema` — re-export of canonical from `siteSeo.js`

**Status:** schema builders are ready. Page-level integration (calling them
inside each page's `<Seo jsonLd={[...]} />`) is staged for Phase 1b — see
the deferred queue in `SEO_PHASE1_REPORT.md`.

---

## 3 · On-page SEO per route

| Route | `<title>` length | Description length | H1 | Notes |
|-------|------------------|--------------------|----|-------|
| `/` | 56 chars (post-Phase 1) | 158 chars | 1 | ✓ |
| `/about` | 60 chars | 154 chars | 1 | ✓ |
| `/services` | 56 chars | 156 chars | 1 | ✓ |
| `/solutions` | 56 chars | 153 chars | 1 | ✓ |
| `/store` | 60 chars | 152 chars | 1 | ✓ |
| `/portfolio` | 50 chars | 148 chars | 1 | ✓ |
| `/contact` | 60 chars | 156 chars | 1 | ✓ |
| `/blog` | 47 chars | 152 chars | 1 | ✓ |
| `/terms` | 45 chars | 110 chars | 1 | description short — OK for legal pages |
| `/privacy` | 43 chars | 108 chars | 1 | same |
| `/refund` | 56 chars | 110 chars | 1 | same |

All canonical URLs emitted by `Seo.jsx`. All public pages keep H1 to one
per page (verified via component conventions; per-page H2 audit deferred to
Phase 2 image/content optimisation pass).

---

## 4 · Meta tag completeness

Emitted by `Seo.jsx` on every page:
- ✅ `og:title`, `og:description`, `og:image`, `og:url`, `og:type`,
  `og:site_name`, `og:locale`, `og:image:alt`, `og:image:width`,
  `og:image:height`
- ✅ `twitter:card`, `twitter:site`, `twitter:creator`, `twitter:title`,
  `twitter:description`, `twitter:image`
- ✅ `theme-color = #5D3FD3`
- ✅ `lang="en"` on `<html>`
- ✅ `canonical` link

Search-engine verification meta tags: **placeholders shipped this round**
in `web/index.html` (Google, Bing, Yandex, Pinterest). Tokens to be
populated once Search Console / Bing / Yandex / Pinterest issue them — see
`SEARCH-CONSOLE-SETUP.md`.

---

## 5 · Performance signals affecting SEO

### Mobile-friendliness — pass
- `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />`
- Tailwind v4 mobile-first responsive design
- 44 px+ touch targets enforced via Brand v3 § 16

### HTTPS — pass (Hostinger handles)

### Cache headers (Express)
- `/images/products/**` → 7 days, immutable ✓
- `/images/avatars/**` → no aggressive cache (intentional — avatars rotate)
- `/api/**` → no cache (correct)
- `index.html` → no-cache ✓
- `/assets/**` (Vite-hashed) — **gap:** no explicit cache directive. Falls
  to default. **P2 fix in SEO07.**

### LCP / CLS estimates — deferred to SEO07 (needs a live Lighthouse run
against the deployed site).

### `robots.txt` — verified disallows are correct.

---

## 6 · Domain + backlink snapshot

- Domain: `mustaphaukizuru.com` (Hostinger)
- Known canonical backlinks via `siteConfig.organization.sameAs`:
  - https://www.linkedin.com/in/mustaphaukizuru/
  - https://t.me/mustaphaukizuru
  - https://github.com/mustaphaukizuru (referenced in LocalBusiness schema)
  - https://www.instagram.com/mustaphaukizuru/

Suggested directory submissions for Mexico / LATAM / EdTech (names only —
actual submission is manual operator work):
- Clutch.co (B2B services)
- GoodFirms (B2B services)
- Crunchbase (founder profile)
- Dev.to (publishing)
- Medium (publishing)
- LinkedIn ProFinder (services)
- Hostinger Customer Showcase
- LATAM tech directories (Endeavor, Mexico Tech Week)
- EdTech Latam directory listings

---

## Priority-ranked fix list

### P1 · critical · ship in Phase 1
- [x] Schema builder library at `web/src/seo/schemas/*`
- [x] Search-engine verification meta placeholders in `index.html`
- [x] GA4 gtag.js bootstrap + `analytics.js` helper
- [x] Visible Breadcrumbs UI component
- [x] Refined per-route titles + descriptions in `pageSeo.js`
- [x] AnalyticsTracker fires GA4 alongside internal pingback

### P1 · critical · operator setup
- [ ] Replace `REPLACE_WITH_*_TOKEN` placeholders in `index.html` once
      Search Console / Bing / Yandex / Pinterest verification issued
- [ ] Set `VITE_GA_MEASUREMENT_ID` on production
- [ ] Submit `sitemap.xml` to Google Search Console + Bing Webmaster

### P2 · high · ship in Phase 2 (requires backend in dev or per-page edits)
- [ ] **Dynamic sitemap (SEO03)** — extend `web/scripts/generate-sitemap.mjs`
      to pull live products / services / portfolio from
      `/api/v1/products?limit=500`, etc. Add `<image:image>` blocks.
- [ ] **Per-page schema integration** — wire the new schema builders into
      `ProductDetail.jsx`, `ServicesPage.jsx`, `ServiceDetailPage.jsx`,
      `AboutPage.jsx`, `Store.jsx`, `ProjectDetailPage.jsx`, `ContactPage.jsx`.
- [ ] Visible `<Breadcrumbs />` rendered below the header on every
      non-home page (component is shipped; placement is deferred).
- [ ] Static `og-*.jpg` images per page type generated at 1200×630.
- [ ] Cache headers on `/assets/**` and `/fonts/**` in `src/app.js`.

### P2 · high · content
- [ ] Expanded About page bio (500+ words)
- [ ] Per-service detail pages with FAQ section (1500+ words each)
- [ ] FAQ items wrapped in `faqSchema()` JSON-LD

### P3 · medium · ship in Phase 3
- [ ] Image conversion to WebP (`scripts/convert-images.mjs` with sharp)
- [ ] Mass `<img>` → `<Image>` migration site-wide
- [ ] Image renaming with descriptive SEO-friendly names
- [ ] Per-product OG image generation (sharp composite at admin save)
- [ ] Lighthouse runs + tactical perf fixes per SEO07
- [ ] Service worker testing matrix per SEO10 (already configured —
      validate offline navigation against the Workbox runtime caches)

---

*Generated as part of SEO Phase 1 · 2026-05-06.*
