# SEO regeneration package for mustaphaukizuru.com

## Replace these files

- `web/package.json`
- `web/index.html`
- `web/src/main.jsx`
- `web/src/components/SeoRouteManager.jsx`
- `web/src/components/seo/Seo.jsx`
- `web/src/seo/siteSeo.js`
- `web/src/seo/pageSeo.js`
- `web/public/robots.txt`
- `web/public/site.webmanifest`
- `web/public/sitemap.xml`
- `web/scripts/generate-sitemap.mjs`

## Why this package is the correct first SEO implementation

Your uploaded architecture document explicitly requires canonical URLs, structured data, sitemap generation, internal linking, and optimized titles/descriptions. Your upgrade plan and Prisma schema also already support `metaTitle` and `metaDescription` for products, services, and CMS pages. This package aligns the codebase with that architecture instead of leaving SEO in one static HTML file.

## What this implementation fixes

- Removes the current single-page static-only metadata limitation.
- Adds route-aware metadata through React Helmet.
- Adds canonical tags that strip query strings.
- Adds Open Graph and Twitter metadata per route.
- Adds JSON-LD for website, organization, person, services, and product pages.
- Adds a production-grade robots.txt.
- Replaces the placeholder manifest with branded values.
- Adds a sitemap generator so you can later feed dynamic product URLs into the sitemap without rewriting the SEO layer.

## Product-detail SEO behavior

`SeoRouteManager.jsx` automatically detects `/store/:slug`, fetches the current product via the existing `fetchProductBySlug()` service, and builds product-specific metadata from live product fields.

The logic uses these fields when present:

- `metaTitle`
- `metaDescription`
- `title`
- `shortDescription`
- `description`
- `price` or `basePrice`
- `currency`
- `sku`
- `images`

## Noindex handling included

These routes are automatically marked `noindex,nofollow`:

- `/login`
- `/signup`
- `/forgot-password`
- `/reset-password/*`
- `/checkout/*`
- `/cart`
- `/dashboard/*`
- `/admin/*`

## Important asset requirement

The SEO files assume these public files exist and remain in `web/public/`:

- `favicon.ico`
- `favicon.svg`
- `apple-touch-icon.png`
- `web-app-manifest-192x192.png`
- `web-app-manifest-512x512.png`

## Recommended next implementation after this package

1. Add real OG images under `web/public/og/`:
   - `og-default.jpg`
   - `og-profile.jpg`
   - `og-solutions.jpg`
   - `og-services.jpg`
   - `og-store.jpg`
   - `og-contact.jpg`

2. Export product slugs to `web/public/sitemap-products.json` during build or deployment so the sitemap includes every product detail page.

Example format:

```json
[
  { "path": "/store/product-slug-1", "lastmod": "2026-03-31", "changefreq": "weekly", "priority": "0.8" },
  { "path": "/store/product-slug-2", "lastmod": "2026-03-31", "changefreq": "weekly", "priority": "0.8" }
]
```

3. Add page-level content tuning inside the actual page components: single H1, better intro copy, descriptive image alt text, and stronger internal linking blocks.

4. Move high-value public pages to prerender or SSR when you are ready. Google can render JavaScript, but official guidance still requires careful JavaScript SEO implementation and validation.
