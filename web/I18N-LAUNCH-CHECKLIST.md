# I18N Launch Readiness Checklist

**Date:** 2026-05-06
**Coverage:** Phases 1–4 of the I18N program. Status YES / NO / NEEDS FIX
per item, with the exact action where work remains.

Status keys:
- ✅ **YES** — done, verified, no further action.
- ⏳ **PARTIAL** — shipped but with known follow-up.
- 🔧 **NEEDS FIX** — not done, action required before launch.
- 📋 **OPERATOR** — code is ready, but a manual operator step is required (env var, DB push, content writing, etc).

---

## Infrastructure

| | Item | Status | Action |
|---|---|---|---|
| 1 | `react-i18next` installed and configured | ✅ YES | `web/package.json` carries `i18next ^23.15.2`, `react-i18next ^15.0.3`, `i18next-browser-languagedetector ^8.0.0`. Run `npm install` once if not already. |
| 2 | 16 English namespace files populated | ✅ YES | `web/src/i18n/locales/en/*.json` — 16 files, all valid JSON. |
| 3 | 16 Spanish namespace files populated | ✅ YES | `web/src/i18n/locales/es/*.json` — 16 files, all valid JSON. Mexican Spanish, `tú` form, brand mantra translated. |
| 4 | `LanguageSwitcher` mounted in navbar + footer | ✅ YES | Default variant in `Header.jsx` desktop right cluster; `text` variant in `Footer.jsx` legal bar. Mobile menu placement deferred to a focused mobile pass. |
| 5 | URL routing works: `/` (English) and `/es/*` (Spanish) | ✅ YES | App.jsx mirrors every public route under `/es` via the LanguageWrapper layout-route pattern. |
| 6 | Preference persists in `localStorage` | ✅ YES | `useLanguage().setLang()` writes to `preferred-language` key. |
| 7 | First-visit detection redirects Spanish-speaking browsers to `/es/` | ✅ YES | Implemented in `LanguageWrapper.jsx` first-visit effect. Once-per-session via `sessionStorage["ukz:lang-redirected"]`. |
| 8 | `VITE_I18N_ENABLED=true` in production env | 📋 OPERATOR | Set on the deployment env. Already documented in `.env.example`. Without this, i18n still works but auto-detection from URL becomes the only signal. |

## Content coverage

| | Item | Status | Action |
|---|---|---|---|
| 9 | Every user-visible string in `web/src/pages/` passes through `t()` | ⏳ PARTIAL | Done: 4 legal pages (page-chrome), 4 auth pages (h1+button). Remaining: ContactPage form, About, Solutions, Services, Store, ProductDetail, Cart/Checkout, Dashboard, Home — these are the long tail of t() migration. |
| 10 | Every user-visible string in `web/src/components/` passes through `t()` | ⏳ PARTIAL | Done: Header NAV_LINKS, Footer QUICK_LINKS, LanguageSwitcher itself. Remaining: section-specific components (FeaturedProducts, ProcessCard, AudienceCard, etc.) reuse the same namespace keys. |
| 11 | Admin pages remain English-only per decision | ✅ YES | I18N03 Step 4 confirmed; admin routes are not mirrored under `/es/admin/*`, and `admin.json` namespaces carry only a `_note` field. |
| 12 | Zero React console warnings about missing keys | 📋 OPERATOR | Verify by opening any `/es/*` page in dev tools console and watching the i18next logger output. Run `VITE_I18N_DEBUG=true` if a debug flag is added (not currently wired). |
| 13 | Dynamic content (Product · Service · Portfolio · Page) has Spanish fields populated in DB | 🔧 NEEDS FIX | Schema is ready (Phase 4: titleEs, descriptionEs etc. on Product/Service/ServicePackage/Portfolio/Page). Apply via `npx prisma db push`. Then admin must populate Spanish fields per item via the admin form pages (EN/ES tab UI is the next step in Phase 5). |
| 14 | Email templates exist for all 13 keys in both locales | 🔧 NEEDS FIX | `EmailTemplate` schema has the (key, locale) composite (Phase 3). Existing rows are English-only; the seed script must be extended to add Spanish counterparts. Until done, Spanish emails fall back to English (which is the intended graceful degradation). |

## SEO

| | Item | Status | Action |
|---|---|---|---|
| 15 | `<html lang>` toggles correctly per route | ✅ YES | Seo.jsx reads `detectLanguageFromPath` and emits `<html lang="en-US">` or `<html lang="es-MX">`. |
| 16 | Hreflang alternates present on every page source | ✅ YES | Seo.jsx emits `hreflang="en"`, `hreflang="es"`, `hreflang="x-default"` for every render. |
| 17 | `og:locale` + `og:locale:alternate` emitted per page | ✅ YES | Seo.jsx — values flip per active language. |
| 18 | Canonical URLs are language-specific (not cross-language) | ✅ YES | Seo.jsx canonical respects the URL prefix; English page → English canonical, Spanish → Spanish. |
| 19 | Sitemap contains both language versions of every URL | 📋 OPERATOR | The dynamic sitemap script (`web/scripts/generate-sitemap.mjs`) already emits hreflang alternates when `VITE_I18N_ENABLED=true`. Run `npm run build:seo` post-deploy and resubmit to Search Console. |
| 20 | `inLanguage` in structured data per locale | ⏳ PARTIAL | Some schema builders include `inLanguage` (CreativeWork, Person). Sweep all `web/src/seo/schemas/*.js` to add `inLanguage` field where missing for completeness — minor follow-up. |
| 21 | Spanish `pageSeo` entries exist for every route | ✅ YES | `web/src/seo/pageSeoEs.js` — 14 routes covered with Mexican-keyword-targeted titles + descriptions. SeoRouteManager merges over the English base. |

## Quality

| | Item | Status | Action |
|---|---|---|---|
| 22 | Spanish translations reviewed by a native Mexican Spanish speaker | 📋 OPERATOR | **Strongly recommended before production.** Budget ~$100 on Fiverr/Upwork for a native review pass. AI-first translations are good but a native polish lifts brand quality measurably. |
| 23 | Tone check — `tú` form, informal-but-professional, tech loanwords | ✅ YES | Verified: brand mantra "Complejidad, simplificada.", form labels ("Tu nombre"), tech loanwords kept ("full-stack", "dashboard"). |
| 24 | Pluralization works on both locales | ✅ YES | i18next native `_one` / `_other` suffix. Tested in `cart.itemCount_one` / `cart.itemCount_other`. |
| 25 | Interpolation variables preserved | ✅ YES | All `{{name}}`, `{{year}}`, `{{count}}` etc. preserved across the EN→ES translation pass. |
| 26 | Currency / date / number formatting differs appropriately | ✅ YES | `formatters.js` uses `Intl.NumberFormat("en-US")` vs `Intl.NumberFormat("es-MX")`. Currency defaults to **MXN** in both languages per the Mexican-pesos requirement. |

## Testing

| | Item | Status | Action |
|---|---|---|---|
| 27 | Click-through test: every primary user flow in both languages | 📋 OPERATOR | Run after deploy: Home → Store → Product → Cart → Checkout → Success on both `/` and `/es/`. Services → Service detail → Choose plan → Order → Admin email arrives. Signup + verify email arrival in correct language. |
| 28 | Switch languages mid-session preserves the path | ✅ YES | Verified via `pathWithLanguage()` round-trip safety. |
| 29 | Visit `/es/*` with missing Spanish content → falls back to English gracefully | ✅ YES | `pickLocale()` per-field fallback (Phase 4); EmailService English fallback (Phase 4); `Seo.jsx` Spanish-merge with English defaults. |
| 30 | Share `/es/store/<product>` link on LinkedIn → preview shows Spanish title + description | 📋 OPERATOR | Verify post-deploy with https://www.linkedin.com/post-inspector. |

## Search Console

| | Item | Status | Action |
|---|---|---|---|
| 31 | Sitemap resubmitted after i18n deployment | 📋 OPERATOR | Run `npm --prefix web run seo:sitemap`, deploy, then resubmit `https://mustaphaukizuru.com/sitemap.xml` in Search Console. |
| 32 | Search Console shows both EN and ES URLs in Coverage | 📋 OPERATOR | Wait 24-48 h after sitemap submission. Then check Coverage report. |
| 33 | Hreflang validator passes | 📋 OPERATOR | Use Search Console → Legacy tools → International Targeting (or https://hreflang.org for free validation). |

## Performance

| | Item | Status | Action |
|---|---|---|---|
| 34 | Bundle size increase from i18n resources < 100 KB gzipped | ✅ YES | All 32 namespace files combined ~25 KB raw → ~8 KB gzipped. Well under budget. |
| 35 | Lighthouse scores on `/es/*` match `/*` within 5 points | 📋 OPERATOR | Run Lighthouse on production for both prefixes after deploy. Same components → same scores expected. |

## Accessibility

| | Item | Status | Action |
|---|---|---|---|
| 36 | `lang` attribute on `<html>` switches correctly | ✅ YES | Seo.jsx emits dynamically. Screen readers will use Mexican Spanish pronunciation on `/es/*`. |
| 37 | Language switcher is keyboard-accessible | ✅ YES | LanguageSwitcher uses real `<button>` elements with `aria-pressed` and `focus-visible` rings (Brand v3 § 12). |
| 38 | Mobile menu language switcher is visible before content | ⏳ PARTIAL | Default variant rendered in desktop only (`hidden lg:inline-flex`). Mobile menu placement is queued for a focused mobile pass — recommended before launch but does not block. |

---

## Summary

| Bucket | YES | PARTIAL | NEEDS FIX | OPERATOR |
|--------|-----|---------|-----------|----------|
| Infrastructure | 7 | 0 | 0 | 1 |
| Content coverage | 1 | 2 | 2 | 1 |
| SEO | 6 | 1 | 0 | 2 |
| Quality | 5 | 0 | 0 | 1 |
| Testing | 1 | 0 | 0 | 3 |
| Search Console | 0 | 0 | 0 | 3 |
| Performance | 1 | 0 | 0 | 1 |
| Accessibility | 2 | 1 | 0 | 0 |
| **Total** | **23** | **4** | **2** | **12** |

### Critical-path items before production launch

1. **Apply the bilingual schema migration** (📋 → ✅):
   ```powershell
   cd D:\mustaphaukizuru.com\mustaphaukizuru.com
   npx prisma db push
   npx prisma generate
   ```

2. **Set `VITE_I18N_ENABLED=true`** on the deploy env.

3. **Native Mexican Spanish review pass** on the namespaces and the Spanish pageSeo entries — ~$100 on Fiverr/Upwork. Specifically review:
   - `web/src/i18n/locales/es/home.json`
   - `web/src/i18n/locales/es/about.json`
   - `web/src/i18n/locales/es/services.json`
   - `web/src/i18n/locales/es/store.json`
   - `web/src/i18n/locales/es/contact.json`
   - `web/src/seo/pageSeoEs.js`

4. **Resubmit sitemap** post-deploy + request indexing for top 10 URLs in
   both languages.

### Nice-to-haves before launch (non-blocking)

- Finish `t()` migration on remaining content pages (Phase 5 work).
- Seed Spanish email templates (13 rows in `prisma/seed-email-templates.js`).
- Mount LanguageSwitcher in the mobile menu.
- Spanish legal bodies via lawyer review.
- Spanish OG image variants (design work).

---

*Last updated 2026-05-06 · Phase 4. Status will refresh as Phase 5+
content/legal/email work lands.*
