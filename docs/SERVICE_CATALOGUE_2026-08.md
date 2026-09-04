# Retired — see `docs/catalogue/`

This file was the August 2026 catalogue, transcribed from the
"CONSULTORÍA ESTRATÉGICA DE TI" PDF (2026-08-24). It described 4 categories and
21 services; the catalogue settled at 20, and the file was never updated.

It has been superseded twice over. The source of truth is
**`web/src/data/servicesCatalogue.js`** — the code the site actually renders,
seeds from and prices with. The readable form is generated from it (T2-10):

| File | What it holds |
|---|---|
| [`catalogue/services-and-categories.md`](catalogue/services-and-categories.md) | Every category and offering, both currencies, deliverables, cross-references |
| [`catalogue/services-and-categories.es.md`](catalogue/services-and-categories.es.md) | The same, in Spanish |
| [`catalogue/packages-and-pricing-plans.md`](catalogue/packages-and-pricing-plans.md) | The nine monthly packages and their feature matrices |
| [`catalogue/engagement-process-content.md`](catalogue/engagement-process-content.md) | The six-step engagement process |

Regenerate with `cd web && npm run catalog:generate`. Never hand-edit the
generated files: CI runs `npm run catalog:check`, which re-runs the generator
and fails when the committed copy differs from a fresh run.

The original content is in the git history — `git log --follow` this path.
