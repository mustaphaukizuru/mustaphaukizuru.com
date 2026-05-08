# Structural cleanup — `controllers/controllers/` + `middleware/middleware/`

**Date:** May 6, 2026
**Status:** ✅ Already resolved — no action needed.

## Background

The project instructions (CLAUDE custom-instructions block) flag a "Known
Structural Bug" warning that duplicate nested directories exist:

```
src/controllers/controllers/  ← duplicate, must be removed
src/middleware/middleware/    ← duplicate, must be removed
```

These were a Windows + OneDrive sync artefact from earlier in the project's
life.

## Findings

Audit ran against both working trees on May 6, 2026:

| Path | `controllers/controllers/` | `middleware/middleware/` |
|------|-----|-----|
| `D:\mustaphaukizuru.com\mustaphaukizuru.com\src\` | absent | absent |
| `C:\…\OneDrive\Documents\GitHub\mustaphaukizuru.com\src\` | absent | absent |

Additional checks — all clean:

- **No imports** in `src/**/*.js` or `web/src/**/*.{js,jsx}` reference
  the nested paths.
- **No `.bak` / `.old` / `*-copy.*` files** under `src/` or `web/src/`.
- **No empty directories** under `src/` or `web/src/`.
- **No filenames with whitespace.**

## Stale references cleaned up in this pass

- `web/src/data/blogPosts/saasJourney.js` — the SaaS-journey blog post
  listed the cleanup as still on the runway; updated to remove that
  entry and add a Phase 13 i18n bullet in its place.

## Recommendation

The "Known Structural Bug" warning in the project custom-instructions
block can now be retired. The `CLEANUP_REPORT_2026-05-06.md` already
noted the same finding ("the previously documented duplicate dirs are
already cleaned"), so this is just a follow-up confirmation and a fix
to the only place that still mentioned the cleanup as pending.

---

**Files touched in this cleanup pass:**

```
web/src/data/blogPosts/saasJourney.js   — removed stale runway item
docs/STRUCTURAL_CLEANUP_NOTE.md          — this file
```
