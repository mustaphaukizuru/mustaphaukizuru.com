# I18N Phase 11 — Bilingual content schema for the rest of the catalogue

**Date:** May 6, 2026  
**Scope:** Extend the EN/ES authoring surface from email templates + Pages
(Phases 7B–10B) to the **Service catalogue** and **Portfolio**, and ship the
final controller fix for static Pages bilingual passthrough.

## Goals

The earlier I18N phases stood up the bilingual schema (Phase 4B), per-field
fallbacks via `pickLocale` (Phase 4C), Spanish email routing (Phases 4A/5B),
and the first admin EN/ES tabs (Phase 8A on email templates, Phase 9A on
Products, Phase 10B on static Pages). Phase 11 closes the loop: every
content surface that powers a public Spanish URL now has a coherent admin
experience to author both locales side-by-side.

## What shipped

### 11A · `adminPagesController` bilingual passthrough

Single-line fix that made Phase 10B end-to-end. The static-pages controller
previously demanded a `contentHtml` field while the admin form sent
`content`; the new `pickHtmlBody` / `pickHtmlBodyEs` helpers accept either,
and `createPage` / `updatePage` now write the five Spanish columns
(`titleEs`, `contentEs`, `metaTitleEs`, `metaDescriptionEs`) on both create
and partial update.

`src/controllers/adminPagesController.js` — defensive spread so partial
updates never wipe a translation back to NULL.

### 11B · Service catalogue bilingual authoring

Service is structurally the most complex content row on the platform —
title + slug + base price + delivery type + status + a tree of
`ServicePackage` and `ServiceFeature` children. Phase 11B brings full
EN/ES authoring to both the parent service form and the inline package
edit row.

**Backend** (`src/services/adminServiceService.js`):
- `createService` accepts the five Spanish columns
  (`titleEs`, `shortDescriptionEs`, `descriptionEs`, `metaTitleEs`,
  `metaDescriptionEs`) and writes them as NULL when blank so `pickLocale`'s
  English fallback fires for un-translated rows.
- `updateService` uses the defensive `data.field !== undefined` pattern so
  a partial PATCH never accidentally clobbers a translation.
- `addPackage` + `updatePackage` accept `nameEs` and `descriptionEs` for
  pricing-plan localisation.

**Public service surface** (`src/services/serviceService.js`):
- `serializeService` surfaces the five `*Es` columns plus `nameEs` /
  `descriptionEs` on each `ServicePackage`, so the admin form can hydrate
  both locales from a single GET.
- `listServices` and `getServiceBySlug` pass an explicit `extraPairs` map
  to `pickLocale`: `[["fullDescription", "descriptionEs"]]`. Service has
  an asymmetric schema — the long-form Spanish copy lives in
  `descriptionEs` (no `description` sibling on Service) — so `pickLocale`'s
  auto-suffix detection alone cannot resolve the swap. The extraPair
  rewrites `fullDescription` ← `descriptionEs` when locale === "es".

**Admin form** (`web/src/pages/AdminServicePlansPage.jsx`):
- ServiceModal now carries an EN/ES locale toggle. Translatable inputs
  (Title, Short description, Full description, Meta title, Meta
  description) bind to either English or Spanish columns depending on
  the active tab; non-translatable structure (slug, status, pricing,
  audience, delivery type, flags) stays canonical and is shared across
  locales.
- Locale defaults to EN on every modal open so the admin always lands
  on the canonical surface.
- `PackageRow` editing form gets a compact secondary EN/ES toggle that
  swaps Plan name + Description bindings to `nameEs` / `descriptionEs`.
  Pricing, tier, period, popular badge, save-label, sort order, active
  flag, and the inclusion-feature matrix all stay structural and shared.
- Save sends both locales' fields in one PATCH; the backend's
  `!== undefined` guards make this safe for any partial change.

### 11C · Portfolio bilingual authoring

Portfolio carries five translatable text columns plus structural
metadata (slug, role, client, category, year, duration, links, results,
tools, tags). Schema is symmetric — `description` ↔ `descriptionEs`,
`shortDescription` ↔ `shortDescriptionEs`, `title` ↔ `titleEs`,
`metaTitle` ↔ `metaTitleEs`, `metaDescription` ↔ `metaDescriptionEs` —
so `pickLocale`'s auto-suffix detection handles public reads without
extraPairs.

**Backend** (`src/services/adminPortfolioService.js`):
- `create` writes the five Spanish columns through `nullableString()`,
  collapsing empty strings to NULL.
- `update` uses the defensive spread pattern for the same five columns.

**Public surface** (`src/services/portfolioService.js`):
- `serializePortfolio` surfaces the five `*Es` columns so the admin form
  hydrates both locales from a single GET.

**Admin form** (`web/src/pages/AdminPortfolioFormPage.jsx`):
- A single locale toggle sits at the top of the Basics card and rebinds
  the five translatable inputs (Title, Short description, Overview, Meta
  title, Meta description) to their Spanish siblings.
- Non-translatable structure stays canonical and shared: slug, role,
  client, category, year, duration, challenge, solution, links, results,
  tools, tags, status, featured, display order, cover, gallery.
- The unsaved-changes guard (`computeIsDirty`) automatically picks up
  Spanish edits because the form state object now includes the new
  `*Es` keys.

### 11D · Verification

- Babel parser sweep across `web/src` + `src` — **504 / 504 OK, 0 fail**.
- Anchor checks confirm I18N markers + locale-toggle wiring landed in
  both admin pages and both backend services.
- Asymmetric `fullDescription` ← `descriptionEs` extraPair confirmed
  in `listServices` and `getServiceBySlug`.

## What this unlocks

Every one of the six content surfaces that powers a public Spanish
route — static Pages, Email templates, Products, Services, Service
packages, Portfolio — now has a coherent admin authoring experience.
The admin can flip a single EN/ES pill on the service or portfolio
form and translate inline without leaving the page; un-translated rows
fall through to English transparently for `/es/*` visitors via
`pickLocale`.

## Pattern notes — recipe for the next bilingual surface

1. **Schema** — add `*Es` siblings under the model in `prisma/schema.prisma`,
   then `npx prisma db push` (NEVER `migrate dev` on Hostinger) and
   `npx prisma generate`.
2. **Service layer** — extend `serializeX` to surface the new columns;
   pass `extraPairs` to `pickLocale` only if the schema is asymmetric.
3. **Admin service** — add the columns to `create` (always-write) and
   `update` (defensive `!== undefined` spread).
4. **Frontend form** — add the `*Es` keys to the initial state, mount a
   `[locale, setLocale]` toggle, ternary-swap each translatable input.
5. **Atomic writes** — when patching files larger than ~500 lines, use
   the Python `tempfile + os.replace` pattern. The Edit tool can be
   intercepted by AV scanners on long files and silently truncated.

## Remaining bilingual content debt

These are smaller surfaces — none block public Spanish — but should be
worked through before the formal Spanish soft-launch:

- AdminProductFormPage already has EN/ES tabs (Phase 9A) but the
  Spanish category names + tag taxonomy don't yet have an authoring
  surface. Lower priority because pickLocale falls through cleanly.
- 8 of 13 transactional emails still seed in English only. Drafts for
  remaining order-confirmation, payment-receipt, project-milestone,
  ticket-update, and newsletter-welcome variants should be ported.
- Native Mexican Spanish review pass on existing translations
  (~$100 Fiverr / Upwork engagement) — not a code task.
- Spanish content for `aboutProjectsData.js`, blog posts, and the
  `Solutions` page case studies — content authoring, not engineering.

---

**Files touched in Phase 11:**

```
src/controllers/adminPagesController.js
src/services/adminServiceService.js
src/services/serviceService.js
src/services/adminPortfolioService.js
src/services/portfolioService.js
web/src/pages/AdminServicePlansPage.jsx
web/src/pages/AdminPortfolioFormPage.jsx
docs/I18N_PHASE11_REPORT.md
```
