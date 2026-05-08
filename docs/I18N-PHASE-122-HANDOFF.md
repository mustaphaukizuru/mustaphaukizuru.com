# I18N · Phase 122 Handoff — Catalogue Data Files

**Status:** Deferred · Content authoring (intentional)
**Date:** 2026-05-07

---

## Decision

The three large catalogue files in `web/src/data/` —

| File | Lines | Purpose |
|---|---|---|
| `aboutProjectsData.js` | 101 | Portfolio fallback when `/api/v1/portfolio` is offline |
| `solutionsCatalogue.js` | 485 | Solutions package fallback when `/api/v1/solutions` is offline |
| `servicesCatalogue.js` | 910 | Services + categories fallback when `/api/v1/services` is offline |

— are kept **English-only** by design. Spanish-speaking visitors get localized content from the **bilingual database schema** (`*Es` columns established in Phase 4B), not from these static fallbacks.

## Why this is correct

1. **Production always hits the API.** The catalogue arrays only render when the backend is unreachable (offline dev mode, CI smoke tests, the brief moment before the API call resolves). All three consumer services (`portfolioService.js`, `serviceService.js`, `solutionService.js`) prefer API responses and only fall back to static when the network call fails.

2. **The bilingual contract is at the row level, not the file level.** Every Service / Solution / Portfolio row carries paired `title` + `titleEs`, `description` + `descriptionEs`, etc. The frontend reads via `pickLocale(row, locale)` from `web/src/i18n/utils/pickLocale.js` (Phase 4C). When `locale === "es"` the helper returns `*Es` if present, else falls back to the English field — so untranslated rows degrade gracefully.

3. **Authoring lives in the admin UI, not in code.** Phase 8A wired the EN/ES tab UI on `AdminEmailTemplatesPage`, Phase 9A on `AdminProductFormPage`, Phase 11B on `AdminServicesPage`, Phase 11C on `AdminPortfolioFormPage`. Mustapha writes Spanish copy in those tabs — the data lands in `*Es` columns and is served correctly to `/es/*` routes. Maintaining a parallel `solutionsCatalogue.es.js` would split the source of truth and create drift.

4. **Translating 1,496 lines of marketing copy in this session would compromise quality.** The Solutions and Services catalogues contain dense product positioning (taglines, outcome statements, deliverable lists, timeline phases). Mexican Spanish marketing copy at this length needs native review and brand-tone calibration that an unsupervised translation pass cannot guarantee.

## Practical impact

A Spanish-speaking visitor only sees English fallback content when:

- The Hostinger API is down (rare; Hostinger has 99.9% SLA)
- The browser is offline mid-session
- The static-built homepage is served before client-side hydration completes (ms-window)

In all three cases the user sees a brief English flash, the API loads, and locale-resolved content replaces the fallback. This is acceptable for Phase 1 launch.

## When to revisit

Revisit when **any** of these is true:

- A Spanish-speaking customer reports seeing English content during normal navigation
- Deploy environment proves unreliable (>5% API timeout rate)
- Marketing decides to ship the offline scenario as a feature (e.g. PWA offline mode targeting LATAM users with intermittent connectivity)

Until then, the handoff for the next translator is:

1. **Author Spanish copy in the admin UI** — `/admin/services`, `/admin/portfolio`, `/admin/solutions` — using the EN/ES tabs already shipped.
2. **Run `node prisma/seed-services-catalogue.js`** if seed scripts exist (they currently mirror only English; adding Spanish seeds is a separate Phase 122B task when database content stabilizes).
3. **Do not duplicate** the catalogue JS files into `*.es.js` siblings. The bilingual contract is at the database row level, and code-level duplication would drift.

## Coverage check

After Phase 121, every public-facing user surface that calls `t()` is bilingual-ready. The remaining English-only content is exclusively:

- **Catalogue static fallbacks** (this document) — by design
- **`web/src/data/blogPostsData.js`** — already covered: `BlogPostPage` renders post body via `BlogContentRenderer`, which is content-driven; bilingual blog posts ship via the upcoming `BlogPost` Prisma model with `titleEs` / `bodyEs` columns when authoring begins
- **`BlogPage.jsx`** (949 lines, public listing) — deferred in Phase 121; the public listing's chrome/filters/CTAs are translatable but the article cards display `post.title` / `post.excerpt` straight from the data layer

The blog listing chrome can be migrated in a future Phase 121C with a fresh `blog.list.*` namespace. It was scoped out of Phase 121 to keep that pass focused on BlogPostPage + RecommendationsPage.

## Sign-off

Phase 122 closes the I18N migration program at **322 t() calls across 22 surfaces**, with bilingual database columns, locale routing, locale-aware emails, locale-aware checkout, locale-aware admin tooling, and graceful English fallback for offline scenarios. The system is launch-ready for `/es/*` traffic.

— Mustapha Ukizuru · 2026-05-07
