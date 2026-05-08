# I18N Phase 13 — Visible bilingual completion across the public site

**Date:** May 6, 2026  
**Scope:** Migrate the three remaining high-traffic public pages
(Solutions, Services, About) from "chrome-only Spanish" to fully
bilingual end-to-end. Pair Phase 12's Home migration to deliver a
coherent `/es/*` reading experience across the whole top-level
navigation.

## Why this phase

Phase 12 fixed Home but left About, Services, and Solutions visibly
half-translated under `/es/*`. A Spanish visitor would land on the
Spanish hero, scroll, and immediately hit English body copy on every
non-home page — a worse experience than no Spanish at all. Phase 13
closes that gap.

## What shipped

### 13A · SolutionsPage

- `solutions` namespace grew from **3 keys → 85 keys** per locale.
- 8 pain quotes, 3 approach pillars, before/after section, 4 ROI
  metrics, recently-shipped header, 3 fit pillars (with 12 list items),
  and final CTA all flow through `t()`.
- Pattern: keyed item arrays (`{ keyId, Icon }.map`) so each loop
  resolves its own translation. Scales cleanly to longer card lists.
- `t()` calls: **4 → 47** (12× increase).

### 13B · ServicesPage

- `services` namespace grew from **9 keys → 71 keys** per locale.
- Migrated: overview header, value comparison toggle, why-choose-us,
  social proof + embedded testimonial, process header, pricing matrix
  labels (Service Details / Get started / Most popular / MXN / Choose
  your plan), catalog download band, full FAQ search/filter UI,
  final CTA.
- Used i18next interpolation for FAQ count: `t("faq.countFormat",
  { count, total })` — single key, both locales handle plural grammar.
- `t()` calls: **14 → 70** (5× increase).

### 13C · AboutPage

- `about` namespace grew from **18 keys → 76 keys** per locale.
- Migrated: Core Competencies (5 items), Mission/Vision/Values header,
  Expertise header, Professional Journey (eyebrow + Education /
  Experience labels + period strings "Present" / "Date pending"),
  Credentials section, Tech Stack header + 4 category labels
  (Frontend / Backend / Database / Tools & Platforms), Skills tabs
  (Technical / Professional / Languages), Portfolio section + empty
  + error states, CTA band.
- Refactored `CORE_COMPETENCIES` and `techStackByCategory` constants
  in-file from string-data to keyId-data so the maps render via `t()`.
- `t()` calls: **9 → 56** (6× increase).

### 13D · Verification

| Page          | t() before | t() after | EN keys | ES keys | Parity |
|---------------|-----------:|----------:|--------:|--------:|:------:|
| SolutionsPage |          4 |        47 |      85 |      85 |  ✓     |
| ServicesPage  |         14 |        70 |      71 |      71 |  ✓     |
| AboutPage     |          9 |        56 |      76 |      76 |  ✓     |

- Babel parser sweep across `web/src` + `src`: **504 / 504 OK**.
- All four highest-traffic public pages (Home + the three above) now
  render coherent Spanish under `/es/*` for every visible chrome
  string. A Spanish visitor's reading experience is end-to-end
  Spanish from top of hero through CTA on each page.

## What's deliberately deferred

Three dense data-catalogue files were scoped out of Phase 13 because
they're better treated as content authoring rather than engineering:

1. `solutionsCatalogue.js` — 8 packages × ~30 fields ≈ 240 strings of
   product copy (package names, taglines, outcomes, deliverables,
   timelines).
2. `servicesCatalogue.js` — 6 categories × 3 audiences × 3 tiers ≈
   ~120 strings of pricing matrix copy.
3. `aboutProjectsData.js` + `sitePagesData.js` — about-page data for
   Mission/Vision/Values, Expertise areas, Experience timeline, and
   Education timeline. (Note: `bioExperience` / `bioCertificates` /
   `bioSkills` come from the `/api/v1/bio/*` endpoints when available
   and fall back to these data files on fresh installs.)

Under `/es/*` these catalogues still render English. The chrome
around them — section headings, navigation, CTAs, filter UIs, and
empty/error states — is fully Spanish, so the gap is visible but
contained.

The recommended next step for these is **content authoring with the
bilingual product strategy in hand**, not blind translation. Mustapha's
user-preferences explicitly call for "native Mexican Spanish quality"
on body content, and these catalogues carry the brand voice for the
core revenue surfaces.

## Pattern catalogue established across Phases 12 + 13

These are the patterns Cowork can reuse on any future bilingual
surface:

- **Atomic Python writes** for files larger than ~500 lines. Edit tool
  truncation under AV scanners is a real failure mode; Python
  `tempfile + os.replace` round-trips cleanly.
- **Backup before patching** — `cp file /tmp/file.bak.jsx` so a
  failed patch script can rebuild from a clean source.
- **Anchor-based replacements** with explicit `[label] anchor missing`
  errors — fast feedback when an anchor drifts.
- **keyId-data pattern** — refactor catalogue arrays from strings to
  i18next keys so the page renders via `t(item.titleKey)`. Keeps
  data shape stable and lets locale files own all copy.
- **Hook collision pattern** — when a component prop named `t`
  shadows the i18n hook (e.g. `TestimonialCard({ t })`), alias the
  hook with `const { t: tx } = useTranslation(...)`.
- **Locale parity audit** — Python script compares EN vs ES keysets
  recursively and flags missing entries before the file ships.

## Mexican Spanish quality notes

All translations follow Mustapha's user-preferences style guide for
`es-MX`:

- `tú` form for direct address (informal-professional, not `usted`).
- Tech terms kept as loanwords: `software`, `full-stack`, `dashboard`,
  `hosting`, `stack`, `MVP`, `webhook`, `API`, `LMS`, `SIS`, `CRM`.
- Idiomatic phrasing where literal would be stiff:
  - "Does any of this sound like you?" → "¿Algo de esto te suena
    familiar?" (not "¿Suena algo de esto como tú?")
  - "Slots into your stack, not around it" → "Encaja en tu stack, no
    a su alrededor".
  - "Newer beats bigger" → "Lo más reciente le gana a lo más grande".
- Accents per RAE conventions — `ó`, `é`, `í`, `á`, `ú` consistent.

Native Mexican Spanish review pass still recommended before formal
launch (~$100 Fiverr/Upwork engagement).

## What's still on the runway

In priority order:

1. Catalogue content authoring (`solutionsCatalogue.js`,
   `servicesCatalogue.js`, `aboutProjectsData.js`).
2. Native Mexican Spanish review pass on Phases 12 + 13 output.
3. Spanish blog content — `/es/blog/*` posts.
4. Spanish SEO long-tail keyword tuning in body copy (meta layer is
   already covered by `pageSeoEs.js`).
5. Remaining Spanish email templates — 8 of 13 still EN-only.

---

**Files touched in Phase 13:**

```
web/src/pages/SolutionsPage.jsx
web/src/pages/ServicesPage.jsx
web/src/pages/AboutPage.jsx
web/src/i18n/locales/en/solutions.json
web/src/i18n/locales/es/solutions.json
web/src/i18n/locales/en/services.json
web/src/i18n/locales/es/services.json
web/src/i18n/locales/en/about.json
web/src/i18n/locales/es/about.json
docs/I18N_PHASE13_REPORT.md
```
