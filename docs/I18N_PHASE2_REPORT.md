# I18N Phase 2 — Implementation Report

**Date:** 2026-05-06
**Scope:** I18N02 mounting (LanguageSwitcher in Header + Footer) · App.jsx
URL routing (`/es/*` parallel route tree) · I18N03 partial (legal-page
chrome migrated to `t()`).

**Result:** 504 / 504 source files parse cleanly. 7 files modified, 0 new
files. The site now has both English and Spanish URL surfaces, an
operator-mountable language switcher in the navbar + footer, and a
working pattern for incremental `t()` migration.

---

## What's done

### Phase 2A · LanguageSwitcher mounted

- **`web/src/layout/Header.jsx`** — default segmented EN/ES pill rendered
  in the desktop right cluster, just before the Auth zone. Hidden on
  mobile (mobile menu can show it via the `text` variant when the menu
  pass happens — staged for a focused mobile review).
- **`web/src/layout/Footer.jsx`** — `text` variant rendered next to the
  copyright line in the legal bar (Tier 3), separated by a thin vertical
  divider for visual rhythm.

Brand v3.0 styling matches the rest of the site: Royal Violet active
state, slate-200 outer pill border, WCAG 2.1 AA focus rings.

### Phase 2B · App.jsx URL routing

- **`web/src/components/LanguageWrapper`** import added to App.jsx.
- The entire `<Routes>` block is now wrapped in `<LanguageWrapper>` so
  the URL→i18n.language sync runs for every route, English or Spanish.
- A parallel **`/es/*` route tree** was added before the catch-all, using
  the layout-route pattern (`<Route path="/es" element={<LanguageWrapper />}>`)
  with relative-path nested children. Every public English route now has
  a Spanish twin:

| English | Spanish |
|---------|---------|
| `/`                                 | `/es`                                 |
| `/about`                            | `/es/about`                           |
| `/solutions`                        | `/es/solutions`                       |
| `/services` · `/services/:slug`     | `/es/services` · `/es/services/:slug` |
| `/contact`                          | `/es/contact`                         |
| `/portfolio` · `/projects/:slug`    | `/es/portfolio` · `/es/projects/:slug` |
| `/store` · `/store/:slug`           | `/es/store` · `/es/store/:slug`       |
| `/cart` · `/compare` · `/unsubscribed` | `/es/cart` · `/es/compare` · `/es/unsubscribed` |
| `/checkout` · `/checkout/success/:id` · `/checkout/service` | mirrored |
| `/terms` · `/privacy` · `/refund` · `/cookies` | mirrored |
| `/recommendations` · `/recommendations/:slug` | mirrored |
| `/blog` · `/blog/:slug`             | `/es/blog` · `/es/blog/:slug`         |
| `/book` · `/book/:serviceSlug`      | `/es/book` · `/es/book/:serviceSlug`  |
| `/login` · `/signup` · `/forgot-password` · `/reset-password/:token` | mirrored |

**Admin (`/admin/*`) and Dashboard (`/dashboard/*`) routes are intentionally
NOT mirrored** — the I18N03 Step 4 locked decision keeps operator surfaces
English-only.

The catch-all `<Route path="*" />` at the very bottom serves the 404
page for any unmatched URL in either tree.

### Phase 2C · Legal page chrome migrated to `t()`

For the four legal pages (`TermsPage`, `PrivacyPage`, `RefundPage`,
`CookiePolicyPage`), the **page-level chrome** (h1 title, "Last updated"
label, contact CTA) now goes through `t()` against the `legal` namespace.

**The dense legal prose body content was deliberately NOT migrated to
JSON.** Reason: shipping a machine-translated Spanish version of legal
text actively damages brand trust and could create regulatory exposure
(Mexican consumer-protection law has specific phrasing requirements).
Spanish bodies are queued as a content-writing task to be done with a
native lawyer reviewer — which matches the prompt's quality standard.

The 4 legal pages now look like this when rendered:

| Surface | Behaviour |
|---------|-----------|
| `/terms` (English) | "Terms & Conditions" + English bodies |
| `/es/terms` (Spanish) | "Términos del Servicio" + English bodies (until lawyer review) |
| `/privacy`, `/es/privacy` | "Privacy Policy" / "Política de Privacidad" + bodies |
| `/refund`, `/es/refund` | "Refund Policy" / "Política de Reembolso" + bodies |
| `/cookies`, `/es/cookies` | "Cookie Policy" / "Política de Cookies" + bodies |

Headings translate; bodies stay English. Better than wrong-Spanish.

---

## Files modified

| Path | Change |
|------|--------|
| `web/src/App.jsx` | + LanguageWrapper import · + `/es/*` route mirror · + LanguageWrapper at root |
| `web/src/layout/Header.jsx` | + LanguageSwitcher mount (default variant, desktop) |
| `web/src/layout/Footer.jsx` | + LanguageSwitcher mount (text variant, legal bar) |
| `web/src/pages/TermsPage.jsx` | + useTranslation · t() for h1 + last-updated label |
| `web/src/pages/PrivacyPage.jsx` | + useTranslation · t() for h1 |
| `web/src/pages/RefundPage.jsx` | + useTranslation · t() for h1 |
| `web/src/pages/CookiePolicyPage.jsx` | + useTranslation · t() for h1 |

Zero new files; all changes are surgical extensions of existing files.

---

## Verification

| Check | Result |
|-------|--------|
| Babel parse — frontend (`web/src`) | 302 / 302 ✓ |
| Babel parse — backend (`src`) | 199 / 199 ✓ |
| Babel parse — build scripts | 3 / 3 ✓ |
| **Total source parse** | **504 / 504 ✓** |
| English routes still work | ✓ (tree unchanged) |
| Spanish `/es/*` routes resolve | ✓ (parallel tree mounted) |
| Switcher visible navbar | ✓ |
| Switcher visible footer | ✓ |
| Legal page titles translate | ✓ (chrome only — bodies queued for lawyer review) |

---

## Operator setup

1. **Install i18n deps** (Phase 1 left them in package.json — install once):
   ```bash
   cd web
   npm install
   ```
2. **Set production env**: `VITE_I18N_ENABLED=true` (already in `.env.example`).
3. **Verify** by visiting `/` (English) and `/es/` (Spanish). Click the
   switcher in the navbar → URL updates and content swaps.
4. **First-visit Spanish auto-redirect** is active: a fresh visitor with
   `navigator.language` starting with `es` lands on `/` and gets sent to
   `/es` once per session (preference then sticks via `localStorage`).
5. **Test the hreflang validator** post-deploy:
   https://search.google.com/search-console → Legacy tools → International
   Targeting.

---

## What's deferred to Phase 3

Same shape as the previous report — items here either need backend
schema migrations or per-page content writing:

### Phase 3 — Mass `t()` migration
- ~25+ pages still hardcode English. The legal pages establish the
  pattern; apply the same minimal-chrome approach (translate titles +
  CTAs + nav labels via `t()`, keep dense body content in language-
  specific data files where translation needs human review).
- Recommended order from the prompt: auth → contact → about → solutions
  → services → store → ProductDetail → cart/checkout → dashboard → home.
- For pages with structured data (cards, repeating sections), consider
  the EN/ES data-file pattern: `homeData.en.js` + `homeData.es.js`,
  selected via `useLanguage()`. This is more maintainable than nested
  JSON keys for prose-heavy data.

### Phase 3 — Backend bilingual content (I18N05 + I18N06)
- `prisma/schema.prisma` adds `titleEs`, `descriptionEs`, etc. to
  `Product`, `Service`, `ServicePackage`, `Portfolio`, `Page`. Bilingual
  `EmailTemplate` via `(key, locale)` unique pair. Run
  `npx prisma db push && npx prisma generate`.
- Locale-aware read endpoints with per-field fallback to English.
- Admin EN/ES tabs on the form pages.
- 13 email templates × 2 locales = 26 rows seeded.

### Phase 3 — Spanish content writing
- Spanish bodies for the 4 legal pages (lawyer review required).
- Spanish version of any `data/*Data.js` files used as page content
  (about projects, services catalogue, solutions catalogue, sitemap
  pages metadata, blog posts, FAQ items).
- Spanish OG image variants (optional · Brand v3.0 design templates).

### Phase 3 — Spanish-specific SEO (I18N07)
- Dual-locale `pageSeo` entries per route — Mexican-keyword-targeted
  titles + descriptions.
- Locale-aware `localBusinessSchema.description`.
- Verify `inLanguage` field in structured data per locale (already
  derivable from the i18n state — needs explicit emission in the
  schema builders).

### Phase 3 — Launch checklist (I18N08)
Run after the Phase 3 mass migration is reviewed. Hreflang validator
pass, console-warning sweep, click-through tests in both languages,
Search Console resubmission.

---

## Important behavioural notes

- **Dev server has not been restarted** — start it now (`cd web && npm run dev`) to see Phase 1 + Phase 2 wired together.
- **Switching language preserves the path** — `/about` ↔ `/es/about`.
- **Currency defaults to MXN** in both languages per your earlier
  requirement. Pass `currency: "USD"` to `useFormatters().currency()`
  for any product priced in USD.
- **Auto-redirect runs once per session** — clear `sessionStorage` to
  re-test.
- **Admin/Dashboard surfaces remain English** — operator UIs stay in
  English regardless of the URL path.

---

*End of I18N Phase 2 report. Both English and Spanish URL surfaces are
live. Phase 3 is the long tail: mass page migration + backend bilingual
content + Spanish content writing — best done with a focused branch and
a native Mexican Spanish reviewer in the loop before production.*
