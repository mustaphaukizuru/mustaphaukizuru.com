# 0001 · The SPA bundle is committed, not built on the server

**Date:** 2026-09-04 · **Status:** accepted · **Item:** T1-7

## Context

Vite writes the SPA into the repo-root `public/` (`assets/`, `index.html`, `sw.js`, `workbox-*.js`). Two documents disagreed about that directory. `CLAUDE.md` said it was gitignored and rebuilt on the server by `scripts/deploy.sh`. `.gitignore` said it was tracked, and explained why: production deploys through the Hostinger hPanel Git button, which clones `master` into a fresh `hbuilds/versions/<uuid>/` and runs `npm install` and `npm start`. That path never runs `deploy.sh` and never builds. When the bundle was ignored, the clone had no `public/index.html` and every request answered 500 (outage of 2026-08-25).

## Decision

The bundle is tracked. Whoever changes `web/src` rebuilds with `cd web && npm run build:seo` and commits the regenerated `public/` in the same change. `deploy.sh` deploys the committed bundle and only rebuilds on the host when asked (`DEPLOY_BUILD_SPA=1`). CI runs `scripts/check-bundle-fresh.sh`, which fails a pull request whose last frontend-source commit is newer than its last bundle commit.

The alternative, making the hPanel path build (a `postinstall` running `cd web && npm ci && npm run build:seo` on the host), was not taken: Hostinger's install budget and the host's ability to reach registries during install are both unproven, and a build that fails at install is the same outage with more steps.

## Consequences

- `public/` diffs are large and noisy; review the `web/src` change, not the bundle.
- The build must be reproducible enough that two developers do not fight over hashes; today one person builds.
- A frontend change is not live until its bundle is committed. Every frontend item in the refinement tiers says so.
- Only `/public/__prerender/` and `public/maintenance.flag` stay ignored. Everything else under `public/` (images, fonts, cv, documents, flags, favicons, `.htaccess`, error pages) is source, as before.
