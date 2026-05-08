# I18N Phase 12 — Visible bilingual completion on the Home page

**Date:** May 6, 2026  
**Scope:** Convert the Home page from "Spanish chrome only" to a fully
bilingual public surface. Every string a visitor reads on `/` or `/es/`
now flows through i18next.

## Why this phase

After Phase 11 the **admin authoring** surface was bilingual end-to-end,
but a Spanish visitor landing on `/es/` still saw the Header, Footer,
nav, and hero in Spanish — and then the entire body of the homepage
in English. That mismatch broke the brand promise more visibly than any
other gap on the platform.

Phase 12 fixes Home (highest-traffic public page). About, Services, and
Solutions remain on the queue under Phase 13 — together those pages add
~3,100 lines and warrant their own phase.

## What shipped

### 12A · Audit

Counted hardcoded English JSX literals across Home, About, Services, and
Solutions. Coverage was lopsided — most pages had `useTranslation`
mounted but only ~10–14 `t()` calls each across files of 600–1200 lines.
Heavy lifting still ahead.

### 12B · Home migration

**`web/src/i18n/locales/en/home.json` + `es/home.json`** — grew from 27
keys per locale to **69 keys per locale**. New key groups: `audiences`
(3 cards), `solutionsList` (6 capability tags), `processSteps` (4
phases), `testimonialRoles` (6 role labels), `cta` (eyebrow + 2-line
title + body + 2 buttons), and richer `sections.*` blocks. Locale
parity verified — every EN key has an ES counterpart.

**`web/src/data/homeData.js`** — refactored from string-data to
key-data. `audiences`, `solutions`, `processSteps`, and `testimonials`
now expose `titleKey` / `descriptionKey` / `roleKey` instead of
hardcoded English strings. Lucide icons remain locale-agnostic.
`featuredProducts` is reference seed data only (the live page fetches
from the API), so kept English for legacy consumers — flagged in a
comment.

**`web/src/pages/Home.jsx`** — converted every JSX literal to `t()`.
`t()` call count went from **10 → 52**. Every section was migrated:
Audiences, Solutions (header + cards + CTA), FeaturedProducts
(heading + empty state + "Notify me"), FeaturedServices (heading +
"Learn more"), FeaturedPortfolio (heading + button), Process
(heading + per-step labels via `processSteps[i].titleKey`),
Testimonials (heading + arrow aria-labels), CTA (eyebrow + 2-line
title + body + 2 pill buttons).

**Naming conflict resolved** — `TestimonialCard` accepts a `t` prop
holding the testimonial object. The i18n hook also returns `t`. Mounted
the hook as `const { t: tx } = useTranslation("home")` so the
testimonial object's `t.text` and the i18n `tx(t.roleKey)` coexist
cleanly.

**Verbatim quote policy** — `testimonial.text` (the actual quote from
the customer) stays in its original English on purpose. Translating a
real quote without the speaker's consent would misrepresent them. Only
`role` labels (e.g. "School Administrator" → "Administradora escolar")
flow through i18n. When a Spanish-speaking customer ships a Spanish
quote, the data file gets a parallel record with its own keys.

### 12D · Verification

- 504 / 504 source files parse cleanly (Babel).
- Audit grep on Home.jsx for remaining English JSX literals: **0 hits**.
- Locale-parity check: **EN 69 keys = ES 69 keys**.
- All `t()` keys in Home.jsx resolve to entries in both locale files.

## Mexican Spanish notes

Translations follow Mustapha's user-preferences style guide for `es-MX`:
`tú` form (informal), tech loanwords kept (software, full-stack,
plataforma, dashboard, hosting), accents per RAE, and idiomatic
phrasing where literal translation would feel stiff. Examples:
- "Build your future with technology that actually works" →
  "Construye tu futuro con tecnología que sí funciona" (idiomatic
  "que sí funciona" beats literal "que de hecho funciona").
- "Let's get to work." → "Pongámonos a trabajar." (collaborative,
  not "comencemos a trabajar" which is more transactional).
- "Templates and toolkits I use myself" → "Plantillas y kits que yo
  mismo uso" (preserves first-person ownership).

A native Mexican Spanish review pass should still happen before formal
launch — these are professional engineering translations, not copy
written by a native speaker.

## Pattern note — extending to About / Services / Solutions

The recipe for Phase 13:

1. **Audit the JSX literals** — grep for `>[A-Z][a-z]+ [a-z]+`-style
   patterns to flag what's still hardcoded.
2. **Refactor the data file** if the page reads from a `data/*.js`
   catalogue (e.g. `aboutProjectsData.js`, `solutionsData.js`).
   Replace string fields with `*Key` fields pointing at namespace
   entries.
3. **Build the bilingual JSON** — locale parity (every EN key has ES).
4. **Patch the page** — migrate JSX literals to `t()` calls.
5. **Watch for hook-name collisions** — `TestimonialCard({ t })`
   pattern is rare but worth checking each component for shadowed
   `t` props.

## What remains

Listed in priority order:

1. **Phase 13 — About + Services + Solutions body copy** (~3,100 lines).
2. **Spanish email seeds — 8 of 13 transactional templates** still
   English-only.
3. **Native Mexican Spanish review pass** on Phase 12 output
   (~$100 Fiverr / Upwork engagement).
4. **Spanish blog content** — the blog scaffolding ships in both
   locales but no Spanish posts exist yet.
5. **Spanish SEO long-tail keywords** — `pageSeoEs.js` covers the
   meta layer; the body keyword density isn't tuned for ES SERPs yet.

---

**Files touched in Phase 12:**

```
web/src/pages/Home.jsx
web/src/data/homeData.js
web/src/i18n/locales/en/home.json
web/src/i18n/locales/es/home.json
docs/I18N_PHASE12_REPORT.md
```
