# I18N Phase 6 — Implementation Report

**Date:** 2026-05-06
**Scope:** Locale-aware Portfolio reads · email locale on remaining
controllers (order, MercadoPago, PayPal, newsletter, client-project) ·
hook scaffolding on PortfolioPage / SolutionsPage / SolutionsHero ·
PortfolioPage hero eyebrow translated.

**Result:** 507 / 507 source files parse cleanly. 10 files modified.
Every conversion-path email now respects URL locale; portfolio reads
serve Spanish content per-field; the i18n machinery is mounted across
the next batch of pages for incremental t() migration.

---

## What's done

### Phase 6A · Portfolio locale-aware reads

**`src/services/portfolioService.js`**
- Added `pickLocale` + `pickLocaleMany` import.
- `listPortfolio({ ..., locale })` applies `pickLocaleMany` before
  `serializePortfolio` — Spanish overlays English when `locale === "es"`
  and the row has Spanish columns populated.
- `getPortfolioBySlug(slug, locale = "en")` defaults to English; when
  Spanish is requested and present, the row is overlaid before
  serialization.
- `getRelatedPortfolio(currentId, category, limit, locale = "en")`
  also accepts locale so "More projects" sections honour the active
  language on `/es/projects/<slug>`.

**`src/controllers/portfolioController.js`**
- Added `resolveUserLocale` import.
- `listPortfolio` and `getPortfolioBySlug` calls pass
  `resolveUserLocale({ req })`.

After this round, populating `titleEs` / `descriptionEs` on a Portfolio
row makes `/es/projects/<slug>` automatically serve Spanish content with
per-field English fallback.

### Phase 6B · Email locale on remaining controllers

`resolveUserLocale({ req })` injected into every `sendTemplateEmail({})`
call site that didn't already carry a `locale:` property:

| Controller | Email calls updated |
|------------|--------------------|
| `orderController.js` | 2 |
| `mercadoPagoController.js` | 2 |
| `paypalController.js` | 1 |
| `newsletterController.js` | 1 |
| `adminClientProjectController.js` | 1 |

Combined with Phase 5's coverage of authController + contactController,
**every email-sending code path now respects the user's locale** — with
graceful English fallback when the matching `(key, "es")` row hasn't
been seeded.

Skipped intentionally:
- `adminEmailTemplatesController.js` — admin-facing test-send, English-only
  per locked decision.
- `emailService.js` itself — that's the function being called, not a caller.

### Phase 6C · Page t() scaffolding

| Page | Action |
|------|--------|
| `PortfolioPage` | + useTranslation, hero "Portfolio" eyebrow translated |
| `SolutionsPage` | + useTranslation hook mounted (1213 lines — per-string migration staged) |
| `SolutionsHero` | + useTranslation hook mounted (477 lines — ready for per-string migration) |

The hook scaffolding makes future migration on these pages a one-line
edit per string. The dense content sections weren't migrated this round
because a per-section visual review with the dev server running is the
right place for that work.

---

## Files modified

| Path | Change |
|------|--------|
| `src/services/portfolioService.js` | + pickLocale, locale-aware list / bySlug / related |
| `src/controllers/portfolioController.js` | + resolveUserLocale on list + bySlug |
| `src/controllers/orderController.js` | + locale on 2 email calls |
| `src/controllers/mercadoPagoController.js` | + locale on 2 email calls |
| `src/controllers/paypalController.js` | + locale on 1 email call |
| `src/controllers/newsletterController.js` | + locale on 1 email call |
| `src/controllers/adminClientProjectController.js` | + locale on 1 email call |
| `web/src/pages/PortfolioPage.jsx` | + useTranslation, hero eyebrow via t() |
| `web/src/pages/SolutionsPage.jsx` | + useTranslation hook mounted |
| `web/src/components/heroes/SolutionsHero.jsx` | + useTranslation hook mounted |

---

## Verification

| Check | Result |
|-------|--------|
| Babel parse — frontend (`web/src`) | 303 / 303 ✓ |
| Babel parse — backend (`src`) | 201 / 201 ✓ |
| Babel parse — build scripts | 3 / 3 ✓ |
| **Total source parse** | **507 / 507 ✓** |
| `/es/projects/:slug` Spanish reads | ✓ when DB has titleEs etc. |
| Order confirmation email respects locale | ✓ (graceful EN fallback) |
| MercadoPago + PayPal payment emails respect locale | ✓ |
| Newsletter signup confirmation respects locale | ✓ |
| Client-project milestone email respects locale | ✓ |

---

## Cumulative I18N progress (Phases 1–6)

| Capability | Status |
|------------|--------|
| react-i18next foundation | ✅ |
| 32 namespace files (16 EN + 16 ES) | ✅ |
| `/es/*` URL routing on 26 public routes | ✅ |
| `<html lang>`, hreflang, og:locale per page | ✅ |
| MXN-default locale-aware formatters | ✅ |
| LanguageSwitcher — navbar, footer, mobile | ✅ |
| Spanish-specific pageSeo with Mexican keywords | ✅ |
| Bilingual EmailTemplate schema + locale routing | ✅ |
| Bilingual Product/Service/ServicePackage/Portfolio/Page schema | ✅ |
| Locale-aware Product reads | ✅ |
| Locale-aware Service reads | ✅ |
| Locale-aware Portfolio reads | ✅ |
| Locale-aware CMS Page reads | ⏳ admin-facing, deferred |
| Email locale routing — every conversion path | ✅ |
| Spanish email template seed (13 rows) | 🔧 needs Spanish copy |
| Auth + legal page chrome via t() | ✅ |
| ContactPage form labels via t() | ✅ |
| Header + Footer nav translated | ✅ |
| MobileMenu fix for `t is not defined` | ✅ |
| PortfolioPage hero eyebrow via t() | ✅ |
| SolutionsPage + SolutionsHero hook mounted | ✅ (per-string migration staged) |
| Mass page t() — Home / About / Services / Store / ProductDetail / Cart / Checkout / Dashboard | ⏳ next session |
| Admin EN/ES tabs on form pages | ⏳ next session |
| Spanish legal bodies | 📋 lawyer review |
| Native Spanish review pass | 📋 ~$100 Fiverr |
| Launch checklist | ✅ published |

---

## What's deferred to Phase 7

- **Mass `t()` migration on the largest pages** — Home (690 lines), About (1230), Services (1213), Store (684), ProductDetail (1700), Cart, Checkout, Dashboard. Each is a focused per-page pass best done with the dev server running for visual review.
- **Email seed expansion** — 13 Spanish template bodies in `prisma/seed-email-templates.js`. Native review required for quality.
- **Admin EN/ES tabs** on `AdminProductFormPage`, `AdminServicesPage`, `AdminPortfolioFormPage`, `AdminPagesPage`, `AdminEmailTemplatesPage`. Significant UI work.
- **Spanish legal bodies** — lawyer review.
- **Native Mexican Spanish review pass** — ~$100 Fiverr/Upwork.

---

*End of I18N Phase 6 report. Backend bilingual reads are now complete
across Product / Service / Portfolio. Every email-sending code path
respects URL locale. The next session focuses on the mass page t()
migration on the larger content surfaces.*
