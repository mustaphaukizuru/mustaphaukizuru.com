# Search Console & Analytics Setup

This document walks through everything required to activate the SEO04
verification + GA4 wiring that ships in `web/index.html` and
`web/src/lib/analytics.js`.

---

## 1 · Google Search Console

1. Visit https://search.google.com/search-console.
2. Add property → **URL prefix** → `https://mustaphaukizuru.com`.
3. Choose **HTML tag** verification. Search Console will show a meta tag like
   `<meta name="google-site-verification" content="ABC123..." />`.
4. Replace the placeholder in `web/index.html` line ~21:
   ```
   <meta name="google-site-verification" content="REPLACE_WITH_GOOGLE_TOKEN" />
   ```
5. Build & deploy. Click **Verify** in Search Console.
6. **Submit sitemap:** in Search Console → Sitemaps → enter `sitemap.xml` →
   submit. Status flips to "Success" within minutes.
7. **Request indexing** for the top 10 URLs (URL Inspection tool):
   `/`, `/about`, `/services`, `/store`, `/solutions`, `/contact`,
   `/portfolio`, `/blog`, plus 2–3 product pages once products are live.

> **Alternative — DNS TXT verification (preferred for ownership stability).**
> On Hostinger DNS, add: `_google-site-verification.mustaphaukizuru.com TXT
> "google-site-verification=ABC123..."`. Verify in Search Console. The HTML
> meta tag stays as a fallback for sub-properties.

---

## 2 · Bing Webmaster Tools

1. Visit https://www.bing.com/webmasters.
2. **Import from Google Search Console** (one-click — re-uses verification).
   If that fails, repeat the meta tag flow with `msvalidate.01` in line ~22 of
   `web/index.html`.
3. Submit the same sitemap.

---

## 3 · Yandex Webmaster (optional — useful for some LATAM backlinks)

1. Visit https://webmaster.yandex.com.
2. Add the site, choose meta verification, paste the token into
   `web/index.html` line ~23 (`yandex-verification`).
3. Submit sitemap.

---

## 4 · Pinterest (optional — visual content / pin attribution)

1. Visit https://www.pinterest.com/settings/claim.
2. Claim website → meta tag → paste the token into line ~24
   (`p:domain_verify`).

---

## 5 · Google Analytics 4 (GA4) — gtag.js direct (no GTM)

1. Visit https://analytics.google.com → Admin → Create property → "Mustapha
   Ukizuru". Set timezone to Mexico City, currency MXN.
2. Add a **Web data stream** for `https://mustaphaukizuru.com`. Copy the
   measurement ID (looks like `G-XXXXXXXXXX`).
3. Set the env var on every environment that should report to GA:
   ```
   VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
   ```
   Local dev: leave empty. Staging: leave empty (or use a separate staging
   property to keep prod clean). Production only.
4. Build & deploy. The bootstrap in `web/index.html` substitutes the ID at
   build time via `vite.config.js`'s `gaIdReplacePlugin`. When the var is
   unset, the bootstrap early-returns and never loads gtag.js.
5. **SPA pageviews** fire from `web/src/components/AnalyticsTracker.jsx` on
   every route change, not from gtag's auto-send (we set
   `send_page_view: false` so we control the timing).
6. **Ecommerce events** are emitted by `web/src/lib/analytics.js`:
   - `add_to_cart`
   - `begin_checkout`
   - `purchase`
   - `newsletter_signup`
   - `contact_submit`
   - `service_order`

   Wire these into the matching pages (CartContext, CheckoutPage,
   CheckoutSuccessPage, ContactPage, footer newsletter form,
   ServicesCheckoutPage) by importing the relevant helper.

---

## 6 · Link GA4 ↔ Search Console

1. In Search Console → Settings → Associations → Associate. Pick the GA4
   property.
2. In GA4 → Admin → Search Console links → confirm the bidirectional link.
3. Search Console reports start to populate inside Reports → Acquisition →
   Search Console (~24 h delay).

---

## 7 · Google Business Profile (Local SEO for Mexico)

This is the missing piece that makes mustaphaukizuru.com appear in the local
"Maps pack" for searches like *"technology consultant Mexico City"*. The
LocalBusiness schema is already emitted from `Seo.jsx` (`includeLocalBusiness`
flag); pair that with a verified GBP listing and it compounds.

1. Visit https://business.google.com.
2. Create / claim **"Mustapha Ukizuru, Technology Consulting"**.
   Categories (in order): Technology consultant · Web developer · Business consultant.
3. Fill the profile completely:
   - **Name** — must match the site's footer + the LocalBusiness schema.
   - **Address** — Tlalnepantla de Baz, Estado de México (use service-area
     business if no public office).
   - **Phone** — same number as the site's contact page.
   - **Hours** — Mon–Fri 09:00–18:00.
   - **Photos** — 10+ minimum: cover, headshot, work samples, school
     installations, code screenshots, logo.
4. Publish weekly Google Posts (announcements, blog post promos, milestones).
5. Reply to every review within 48 h, professional tone, no PII.

NAP consistency matters: every Name/Address/Phone reference on the website,
the LocalBusiness schema, and Google Business Profile must match exactly.

---

## 8 · Verification checklist

- [ ] Google Search Console verified
- [ ] Bing Webmaster Tools verified
- [ ] Sitemap submitted to both
- [ ] Top 10 URLs requested for indexing
- [ ] GA4 measurement ID set on production
- [ ] Network tab shows requests to googletagmanager.com on prod
- [ ] GA4 → Realtime fires when you visit a page
- [ ] Search Console ↔ GA4 association shows green
- [ ] Google Business Profile published
- [ ] LocalBusiness schema validates at https://validator.schema.org

---

*Last updated: 2026-05-06 · maintained as part of the SEO Phase 1 rollout.*
