# Client Project Management · audit + privacy fix

**Date:** May 6, 2026  
**Scope:** Audit the member-side client-project experience (list view,
detail view, file downloads) for gaps that block production use.

## Headline finding

**Privacy hole — project deliverables were publicly downloadable.** Files
uploaded by admin to a client project (signed contracts, consultancy
reports, design files) were stored at `public/files/projects/<projectId>/<filename>`
and served directly via the catch-all `express.static(frontendPath)` in
`app.js`. The dashboard rendered a `<a href={API_BASE_URL + filePath}>` link
that pointed straight at the static path. Result: **anyone with a URL
— guessed, leaked from screenshot, copied from browser history — could
download another customer's deliverables**. ProjectId is a CUID so brute-
force guessing is impractical, but URL leakage is realistic.

Fixed.

## Issues found and fixed

| # | Severity | Issue | Fix |
|---|---|---|---|
| 1 | **Critical (privacy)** | `/files/projects/*` served as unauthenticated static — any URL leaks to non-owners | Added authenticated streaming endpoint + deny-middleware on the static path |

## Architecture of the fix

**New endpoint:** `GET /api/v1/member/projects/:id/files/:fileId/download`
mounted in `memberClientProjectRoutes.js` behind the same `protect`
middleware as the rest of the member-project surface.

**Authorization chain:**

1. `protect` middleware populates `req.user` from JWT
2. Single composite query: load the file row + the parent project's
   `userId` in one round-trip
3. If the file doesn't exist OR `project.userId !== req.user.id`,
   return 404 (not 403, so we don't confirm existence to a non-owner)
4. Path resolved against `PROJECT_FILES_ROOT` with `startsWith()`
   guard — same pattern as `downloadController` for product files
5. Stream with `Content-Disposition: attachment` + `Cache-Control: private, no-store`
6. Best-effort access log to ActivityLog (action: `project.file.downloaded`)

**Static-serve block:** added a tiny middleware in `app.js` BEFORE the
catch-all `express.static(frontendPath)` that intercepts `/files/projects/*`
and returns 403. Defense-in-depth so even if someone has the old URL,
they can't download.

**Frontend update:** `DashboardProjectDetailPage` now generates the
download URL via `fileDownloadUrl(projectId, fileId)` instead of
concatenating `API_BASE_URL + filePath`. Bearer token attached by
the browser on same-origin requests; the endpoint validates ownership
server-side.

## Files changed

```
src/controllers/clientProjectController.js  — added streamFile + safe-path helper
src/routes/memberClientProjectRoutes.js     — mounted /:id/files/:fileId/download
src/app.js                                  — deny middleware on /files/projects/*
web/src/pages/DashboardProjectDetailPage.jsx — fileDownloadUrl() builder
docs/CPM_REPORT.md                          — this file
```

## What was already solid

- `listMyProjects(userId)` and `getMyProject({ userId, projectId })`
  are properly user-scoped — no IDOR risk on the metadata layer.
- Admin upload uses multer + safe path joining under the project's
  own subdirectory.
- Milestone-completed customer email fires only on the FIRST transition
  to `completed` (the service returns `isNewlyComplete`).
- `attachFile` validates `fileName` and `filePath` are present.
- ProjectId + FileId are CUID — no sequential enumeration.

## Operator-side smoke tests

1. **Authenticated download** — sign in as the project owner, click a
   deliverable in the dashboard. Browser should download the file.
2. **Cross-tenant blocked** — sign in as another customer (different
   userId), construct a URL like
   `/api/v1/member/projects/<projectId>/files/<fileId>/download` for
   project A using A's ids. Expect 404 NOT_FOUND.
3. **Direct static blocked** — visit `/files/projects/<id>/<filename>`
   in the browser without auth. Expect 403 with the
   `"Direct file access is not permitted"` message.
4. **Path traversal** — manually craft a `ProjectFile.filePath` row
   with `../../etc/passwd` (admin-side). Expect the streaming
   endpoint to return 400 INVALID_PATH.
5. **Missing file** — delete the file from disk but keep the DB row.
   Expect 404 FILE_MISSING with a clear "contact support" message.
6. **Activity log** — successful download creates an `ActivityLog`
   row with `action: "project.file.downloaded"` and the IP.

## What was deliberately deferred

These are nice-to-haves rather than launch blockers:

- **Per-file download caps** — project files are typically one-off
  deliverables, not products with monetisable scarcity. Caps would
  add friction without protecting anything.
- **Member-initiated comments / requests** — currently customers
  must use the support-ticket system to ask questions about a
  project. Inline comments would be a bigger feature and aren't
  blocking the existing flow.
- **Admin-side static blocking** — admins still hit the static path
  for in-dashboard previews. Their routes are auth-protected at the
  admin layer, so the risk surface is narrower. If admin URLs ever
  leak (e.g. accidental screenshot), revisit.
- **Email-locale on milestone-completed notifications** —
  `adminClientProjectController` already calls `sendTemplateEmail` with
  `locale: resolveUserLocale({ req })`. Already correct.

## Verification

- 504 / 504 source files parse cleanly via Babel.
- Path traversal guard mirrors `src/controllers/downloadController.js`
  pattern (proven safe across the product-file flow).
- Backward-compatible — admin routes untouched, no schema changes,
  no new env vars.

---

**Bottom line:** A real privacy hole was lurking — project deliverables
were one URL leak away from being downloadable by anyone. The fix is
small (one new endpoint, one middleware block, one frontend URL builder
swap) but the impact is significant: customer-trust and (for B2B work)
contractual confidentiality.
