# Launch handover · branch `feat/roadmap-build`

All 42 roadmap steps are implemented and committed **locally** (nothing pushed).
The database migration, seeds and smoke tests have now been **run against the
live Hostinger database** — see §1. What remains is listed in §4 and §5.

---

## 1. Done — migration, seeds and live verification

Executed on 2026-08-24 against `u605945793_ukidatum` (srv1300.hstgr.io):

| Step | Result |
|---|---|
| `scripts/check-db-drift.js` | No drift — nothing would be dropped |
| `scripts/backfill-enums.js` (dry run) | All 7 enum columns clean |
| `scripts/backup-db-json.js` | 1664 rows / 72 tables → `storage/backups/` |
| `prisma db push --accept-data-loss` | In sync; all data intact after the enum casts |
| `prisma/seed/services-seed.js` | 8 published services (the 4 funnel categories + 4 legacy) |
| `prisma/seed/portfolio-seed.js` | 3 portfolio items with case-study blocks |
| `npm run seed:email` | 25 EN + 25 ES templates, incl. `newsletter.confirm` |
| `scripts/invalidate-plaintext-passwords.js` | 0 non-bcrypt rows — nothing to do |

Live smoke tests against the migrated DB, all passing:

- `/api/v1/admin/bio/*` and `/api/v1/admin/analytics/*` → **401** (the two
  Critical audit findings, verified closed on real data)
- Unknown SPA route → 404 · known route → 200
- OG injection returns the real title for blog / services / projects
- Blog list sends `Cache-Control: public, max-age=60, stale-while-revalidate=300`
- Newsletter double opt-in end to end: subscribe → `pending` → confirm link →
  `subscribed` (token rotated) → unsubscribe → `unsubscribed`

Three real bugs were found by this testing and fixed (commit `71e3e22`):
the OG lookup timeout was shorter than the DB round-trip so **every shared
link showed the generic card**; dead detail URLs returned 200 (soft-404); and
the legacy `POST /newsletter` alias never sent its confirmation email, leaving
those subscribers stranded in `pending`.

> Re-run the backup before any future `db push`:
> `node scripts/backup-db-json.js` (works without mysqldump).

## 2. Deploy

`scripts/deploy.sh` restarts via Passenger (`touch tmp/restart.txt`) when it
detects it, else PM2/nohup. It builds before restarting, and `public/assets` is
no longer tracked in git — the server build produces it. Watch the first deploy.

`scripts/hostinger-recover.sh` replaces the seven ad-hoc root scripts:
`status | log | restart | recover | reinstall`.

## 3. Session-auth rollout

Sessions are now an httpOnly `mu_session` cookie plus a `mu_csrf` double-submit
token. For one release the API **also** accepts `Authorization: Bearer` and
still returns the token in login responses, so already-open tabs and any
external client keep working.

Drop both together (the header fallback in `src/middleware/authMiddleware.js`
and the body/fragment token in `authController`) **≥ 30 days after deploy**.
Until then the XSS hardening is only partial for clients on the old path.

## 4. Content that still needs you

| Where | What | State |
|---|---|---|
| `web/src/data/homeData.js` | **Testimonials** | The three entries are invented examples and are now **filtered out** — the section stays hidden rather than publishing social proof nobody gave. Add a real quote/name/role/company to `home.json` (en + es) and delete `placeholder: true` to publish it. |
| Admin → Portfolio → Case study | **Outcome metrics** | Six of nine figures are estimates. They render with an asterisk and the note "illustrative targets, not audited results", so they are honest as-is — replace them with measured numbers when you have them. |
| `web/src/i18n/locales/{en,es}/product.json` → `license.*` | **Licence & updates terms** | Sensible default terms (single-buyer licence, one site per licence, lifetime updates for the purchased major version). This is legal text — read it and adjust before selling. |

## 5. What still needs a human with credentials

The suite covers the money and booking paths at the HTTP level with a fake
database, and the flows above were exercised against the real one. These need
real sandbox credentials and a browser:

1. Sandbox purchase on **both** gateways → download works, receipt PDF opens,
   order appears in the dashboard.
2. Refund a sandbox order → entitlement revoked, download refused.
3. Book a consultation → Google Meet link created, reminder email fires.
4. Send a real campaign to a test subscriber → confirm the List-Unsubscribe
   header and the unsubscribe link both work from a real mail client.
5. Sign in on a phone and a desktop; sign out on one and confirm the other is
   unaffected; then change the password and confirm both sessions die.

## 6. Known debts (documented, not hidden)

Resolved since the first draft of this document:

- ~~9 colour pairs below 4.5:1~~ — **fixed**, at the usage site rather than by
  retuning brand anchors. A `lint:contrast` gate (74 pairs) now blocks
  regressions. Two deliberate exceptions are in §7.
- ~~Coverage gate at 30%~~ — now **44% lines / 41% statements**, 560 tests.
  `availabilityService` went 4% → 100% lines, `cartService` → 100%,
  `twoFactorService` → 98%. The old gate was silently failing.
- ~~Hand-rolled skeleton in `ui/legacy.jsx`~~ — **fixed**, delegates to the
  canonical shimmer (16 importers verified unchanged).
- ~~Two newsletter subscribe paths~~ — **consolidated**; the legacy
  `POST /newsletter` now delegates to the one implementation. An
  unauthenticated unsubscribe-by-email handler was deleted (it let anyone
  unsubscribe any address and doubled as a subscriber-list oracle).

Still open:

- **Performance / prerendering** — see §7. This is the largest remaining item.
- **Four bugs the new tests exposed are fixed**, but they are worth knowing
  about because they were all silently live: a cart discount survived items
  being removed (revenue leak), an expired coupon kept discounting, a TOTP code
  was replayable for ~90 s, and a DST fall-back day showed two identical
  "1:00 AM" slots.
- MercadoPago + PayPal remain the only gateways. Stripe is still deliberately
  absent.

## 7. Measured Lighthouse results (mobile, 2026-08-24)

Run with `npx @lhci/cli autorun --config=lighthouserc.mobile.json` (3 runs ×
7 URLs, simulated slow-4G + 4× CPU throttling). These are real numbers from
this branch, not estimates.

| URL | perf (median of 3) | a11y | best-pr | SEO |
|---|---|---|---|---|
| / | 40 | **100** | 100 | 100 |
| /about | 37 | **100** | 96 | **100** |
| /services | 59 | **100** | 100 | 100 |
| /store | 52 | **100** | 100 | 100 |
| /contact | see note² | **100** | 100 | 100 |
| /privacy | 68 | **100** | 100 | 100 |
| /terms | 69 | **100** | 100 | 100 |

LCP ranged 4.7–6.6 s and TBT 153–1211 ms. CLS is **0.000** on every page.
`/about` SEO was 92 before the "Learn More" link-text fix; it is 100 now.

⚠️ **Read the perf column with its context.** Those figures were collected
against the *old* configuration, which booted the real API and waited on the
remote Hostinger DB — so they include network latency that has nothing to do
with the frontend. Against the current `scripts/lighthouse-server.js` the same
pages score materially higher. Measured there, 3 runs each:

| URL | perf | LCP |
|---|---|---|
| /terms | **78** | 4.6 s |
| / | 72 | 5.1 s |
| /about | 53 | 5.5 s |

Treat the fixture-server numbers as the baseline to compare against in future;
the a11y / best-practices / SEO columns are unaffected by which server is used.

² **The flaky runs are fixed.** Individual runs used to return a performance
score of 0 (`/contact` scored 0, 64, 0) because the config booted the real
Express server, which queries the remote Hostinger DB at ~450 ms per call;
under 4× CPU throttling some loads timed out. `scripts/lighthouse-server.js`
now serves the same bundle with the same SPA/404 semantics and fixture API
responses, with cache headers mirroring `src/app.js`. Measurement is stable
and no longer partly measures your latency to Hostinger.

### Why performance is where it is — and what actually moves it

Prerendering the public routes was **built, measured, and reverted**. Headless
Chrome snapshots served as a paint-first overlay, A/B'd on the same server with
only the feature flag changing:

| route | perf | LCP | FCP |
|---|---|---|---|
| /terms | 75 → 75 | 4.7 → 4.8 s | 3.1 → 3.1 s |
| /about | 53 → 61 | 5.5 → 5.9 s | 3.3 → 3.3 s |
| / | 72 → 71 | 5.1 → 5.3 s | 3.3 → 3.3 s |

LCP got **worse** on all three and FCP did not move, so it did not justify
~600 lines, a puppeteer dependency, and a deploy step that downloads Chrome
onto a shared host. (The one perf gain, /about, has overlapping run ranges.)

The unchanged FCP is the diagnosis. Lighthouse names the cause directly:
**`assets/index-*.css` is render-blocking for 1055 ms** (est. saving 300 ms).
The browser already has the markup — it will not paint until that stylesheet
arrives. Putting content into the HTML cannot help while that is true.

Ranked options, with honest expected value:

1. ~~**Render-blocking CSS**~~ — **investigated and ruled out.** Lighthouse
   reports the stylesheet as render-blocking for 1055 ms with ~300 ms of
   theoretical savings, but the network trace shows every resource finishing
   by ~51 ms while FCP lands at **2959 ms**. The ~2.9 s gap is JS parse,
   execute and render — the CSS is not on the critical path, and an empty
   SPA shell has no above-the-fold content to inline anyway. Two related dead
   ends: unused-css-rules scores **1.00** (nothing to purge, so per-route
   splitting gains little), and tokenising repeated arbitrary shadows saves
   **zero bytes** because Tailwind emits one rule per *distinct* value, not
   per usage.

   Still worth doing for design reasons, not performance: there are **250
   distinct arbitrary shadow values** across 499 usages (one appears 69 times)
   where an elevation scale would have ~8. That is a design call.
2. **JS bootup** — the real cost, and now largely mined out. Home spends
   4.5 s in bootup and 10.9 s of main-thread work. The pattern behind every
   win in this pass: `manualChunks` in `web/vite.config.js` ends with
   `node_modules -> "vendor"`, which swept route-only and even
   dynamically-imported libraries into the global shell. Returning
   `undefined` BEFORE that catch-all hands placement back to Rollup.

   Fixed this way: react-icons (24 kB, 96% unused on /terms), zod
   (admin-only validation, ~52 kB), lenis (guarded by reduced-motion,
   17 kB) — plus the earlier framer LazyMotion and i18n one-locale splits.

   **/terms, fixture server, 3 runs each:**

   | | perf | LCP | unused JS |
   |---|---|---|---|
   | original | 75 | 4.7 s | 114 kB |
   | + react-icons | 78 | 4.6 s | 68 kB |
   | + zod | 78 | 4.5 s | 56 kB |
   | + lenis | 77 | 4.6 s | 53 kB |

   Unused JS is down 54%. Note lenis was perf-NEUTRAL — kept for
   correctness (never shipping a library to users whose settings prevent
   using it), not for score.

   To hunt the next one, use sourcemap attribution: build with
   `--sourcemap` to a scratch dir, then for each chunk read its `.map` and
   group `sources` by node_modules package to see what is actually inside.
   `vendor` is now 148 kB and is mostly framer motion-dom,
   react-helmet-async and sonner — all genuinely global.
3. **SSR framework** (largest win, largest change). Options 1 and 2 improve the
   numbers; only this changes the shape of the problem. It is a genuine
   re-platform (Next.js / Remix), not a patch — worth costing before choosing.

My recommendation: do (1), skip (2) beyond what is done, and treat (3) as a
business decision rather than a task. Note that CLS is already 0.000 and
accessibility is 100 — the two things that most affect real users and SEO are
in good shape.

**Accessibility went 86–97 → 100 across the board** and is a hard CI gate.

**Performance does not meet the 0.85 target and cannot without an
architectural change.** LCP is ~4.7 s even on `/terms`, a near-static page —
the cost is the SPA shell itself (download → parse → hydrate before anything
paints), not page content. The i18n split already removed 100 kB from that
critical path. Closing the remaining gap means **prerendering or SSR for the
public routes**, which the original audit also flagged.

So the gate is honest rather than aspirational: `categories:performance` is an
**error floor at 0.35** (catches regressions), the CWV timings are **warnings**
(keep the gap visible), and a11y/best-practices/SEO stay hard gates at 0.95.
Desktop budgets are marked WARN and unverified — nobody has run
`lighthouserc.json` on this branch.

Two things left deliberately, both design decisions:
- `--text-micro` is 10 px and is ~34 % of the text on /about. Lighthouse wants
  ≥ 12 px for mobile legibility. Raising it shifts layout site-wide, so it is
  yours to make.
- The terracotta accent on light-ground display headings is 1.9:1. Fixing it
  means picking a different accent hue for light heroes (see
  `docs/DESIGN_SYSTEM.md`).

## 8. Dependency vulnerabilities (2026-08-24)

`npm audit --omit=dev` went from **15 to 6**. Everything fixable without a
breaking change was applied (axios, form-data, multer, ip-address,
body-parser, morgan, qs), and **nodemailer was upgraded 8 → 9.0.5** — a major
bump, taken because it was a direct high-severity advisory; verified by the
full test suite, an app boot, and an emailService/mailer load check.

The remaining 6 were assessed for reachability rather than silenced:

| Package | Severity | Reachable here? |
|---|---|---|
| `deepmerge-ts` → `@prisma/config` → `prisma` | high | **No.** The flaw is stack exhaustion when merging recursive object graphs; it runs while Prisma loads its own config file at build time, which is ours and is not attacker-supplied. The fix is a Prisma major on a working MySQL layer. |
| `uuid` → `gaxios` / `node-cron` | moderate | **No.** Missing buffer bounds check in uuid v3/v5/v6 *when `buf` is provided*. Nothing in `src/` calls uuid directly, and neither googleapis nor node-cron passes caller-controlled buffers. Fix is a node-cron major that changes the `schedule` signature used by four live jobs. |

Note the nodemailer advisory that prompted the upgrade was also **not
exploitable as used** — it needs the message-level `raw` option, which this
codebase never passes. It was upgraded anyway because it is a direct
dependency and the upgrade proved safe.

Re-check with `npm audit --omit=dev` after any dependency change. Do not run
`npm audit fix --force` blindly: it would take Prisma and node-cron across
majors and break the DB layer and the scheduler.
