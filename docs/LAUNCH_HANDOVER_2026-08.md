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
| `web/src/components/heroes/ServicesHero.jsx` | **Unverified performance claims** | The services hero states **"94% on-time delivery"** (with a "+5.2%" badge) and **"82+ engagements"**. I cannot verify either, so I left them rather than invent or delete. Confirm them, soften them, or remove them before selling — an unsupportable number beside a price is the kind of thing a buyer checks. The service COUNT on the same hero is now derived from the catalogue (21) and can no longer drift. |
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

- **Performance** — desktop is in good shape (**95-98 on all 7 routes**,
  FCP ~0.63 s, CLS 0.000, a11y/best-practices/SEO 100, and the desktop suite
  now runs with zero warnings). **Mobile is the open item**: 52-75, with FCP
  pinned at ~3.1 s on every route including near-static ones. That is React
  parse+execute under 4x CPU throttling — an architectural property of the SPA
  shell, not a bug. See §7 for what was tried and rejected, and read that
  before proposing a fix: prerendering and the `App.jsx` splash-gate change
  were both built, measured and reverted.
- **Actionable without re-platforming:** ~113 KB of image savings on `/about`
  (responsive sizes + WebP/AVIF) and 48 KB of unused JS there.
- **Four bugs the new tests exposed are fixed**, but they are worth knowing
  about because they were all silently live: a cart discount survived items
  being removed (revenue leak), an expired coupon kept discounting, a TOTP code
  was replayable for ~90 s, and a DST fall-back day showed two identical
  "1:00 AM" slots.
- MercadoPago + PayPal remain the only gateways. Stripe is still deliberately
  absent.

## 7. Measured Lighthouse results (2026-08-25)

> **Read the "rejected" subsection before proposing a performance fix.** Two
> plausible-sounding diagnoses have now been built, measured and thrown away
> on this project. Both looked obviously correct in advance. The measurement
> discipline that killed them — A/B on the same server, same build, change one
> thing, 3 runs per arm, compare spreads not single runs — is the useful
> artefact here, more than any individual number.

### Where the current numbers actually come from

The public routes score well on desktop. That is the result of two earlier
pieces of work, **not** of any front-end rewrite:

1. **A deterministic fixture server** (`scripts/lighthouse-server.js`). The old
   config booted the real Express app, which queries the remote Hostinger DB at
   ~450 ms per call. Under CPU throttling some loads timed out, producing
   performance scores of **0** and `NO_FCP` ("the page did not paint any
   content") results that looked like catastrophic front-end bugs and were
   actually measurement noise. Chasing those artefacts is what produced both
   of the dead ends below.
2. **Chunk splitting.** `manualChunks` in `web/vite.config.js` ends with
   `node_modules -> "vendor"`, which swept route-only and even
   dynamically-imported libraries into the global shell. Returning `undefined`
   **before** that catch-all hands placement back to Rollup. Fixed this way:
   react-icons (24 kB, 96 % unused on /terms), zod (admin-only, ~52 kB), lenis
   (reduced-motion-guarded, 17 kB), plus the earlier framer LazyMotion and
   i18n one-locale splits. Unused JS on /terms fell 114 kB -> 53 kB.

### Desktop — `lighthouserc.json`, 3 runs x 7 URLs, medians

| route | perf | a11y | best-pr | SEO | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|
| `/` | 95 | 100 | 100 | 100 | 0.66 s | 1.05 s | 18 ms | 0.000 |
| `/about` | 95 | 100 | 100 | 100 | 0.65 s | 0.97 s | 95 ms | 0.000 |
| `/contact` | 97 | 100 | 100 | 100 | 0.63 s | 0.91 s | 17 ms | 0.000 |
| `/privacy` | 97 | 100 | 100 | 100 | 0.61 s | 0.89 s | 0 ms | 0.000 |
| `/services` | 97 | 100 | 100 | 100 | 0.61 s | 0.89 s | 28 ms | 0.000 |
| `/store` | 97 | 100 | 100 | 100 | 0.63 s | 0.90 s | 4 ms | 0.000 |
| `/terms` | 98 | 100 | 100 | 100 | 0.61 s | 0.88 s | 0 ms | 0.000 |

This run produced **no assertion failures and no warnings at all**. Note
`/about` scores **95** here; in an earlier suite run with the splash gate
removed it scored **71** (TBT 430 ms vs 95 ms) — one more datum against that
change.

### Mobile — `lighthouserc.mobile.json`, 3 runs x 7 URLs, medians

| route | perf | a11y | best-pr | SEO | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|
| `/` | 52 | 100 | 100 | 100 | 3.24 s | 5.95 s | 688 ms | 0.000 |
| `/about` | 57 | 100 | 96 | 100 | 3.25 s | 5.80 s | 502 ms | 0.000 |
| `/contact` | 62 | 100 | 100 | 100 | 3.12 s | 4.95 s | 486 ms | 0.000 |
| `/privacy` | 66 | 100 | 100 | 100 | 3.14 s | 4.83 s | 362 ms | 0.000 |
| `/services` | 58 | 100 | 100 | 100 | 3.14 s | 4.83 s | 675 ms | 0.000 |
| `/store` | 64 | 100 | 100 | 100 | 3.13 s | 4.86 s | 436 ms | 0.000 |
| `/terms` | 75 | 100 | 100 | 100 | 3.06 s | 4.73 s | 152 ms | 0.000 |

No assertion errors on either form factor. Accessibility is **100 on every
route on both**, and CLS is **0.000 everywhere**.

> ⚠️ **Suite runs are pessimistic on a busy machine.** `/` measured **52** in
> the 7-URL mobile suite but **70** when collected alone on the same build and
> server. Seven URLs x 3 runs contend for CPU, and CPU contention is exactly
> what a throttled Lighthouse run is measuring. **Never compare a suite number
> against an isolated number** — that mistake is what made the home page look
> like it had regressed. Compare suite-to-suite, or isolated-to-isolated.

### Mobile is JS-bound, and that is the real remaining constraint

Mobile FCP sits at ~3.1 s on every route, including `/terms`, which is nearly
static. Under 4x CPU throttling the cost is React parse + execute before
anything of the app can render. Page *content* is not the driver — the SPA
shell is. That is a genuine architectural limit, and it is the honest argument
for SSR if you ever want mobile scores in the 90s. It is not a bug to fix.

Named, measured opportunities that do **not** require re-platforming:

| where | opportunity | savings |
|---|---|---|
| `/about` | `uses-responsive-images` | 70 KB |
| `/about` | `modern-image-formats` (WebP/AVIF) | 43 KB |
| `/about` | `unused-javascript` | 48 KB |

The two image items are ~113 KB together. They need an image-pipeline decision
(which formats, which breakpoints, whether to add a build step) rather than a
code tweak, so they are left for you rather than half-done.

### Rejected — do not re-litigate these

**1. Prerendering the public routes.** Built, measured, reverted. Headless
Chrome snapshots served as a paint-first overlay, A/B'd on the same server with
only the feature flag changing:

| route | perf | LCP | FCP |
|---|---|---|---|
| /terms | 75 to 75 | 4.7 to 4.8 s | 3.1 to 3.1 s |
| /about | 53 to 61 | 5.5 to 5.9 s | 3.3 to 3.3 s |
| / | 72 to 71 | 5.1 to 5.3 s | 3.3 to 3.3 s |

LCP got **worse** on all three and FCP did not move — not worth ~600 lines, a
puppeteer dependency, and a deploy step that downloads Chrome onto a shared
host.

**2. Removing the `opacity: 0` splash gate in `App.jsx`.** This one is
instructive, because the reasoning was clean and the conclusion was still
wrong. `App.jsx` wraps the routed app in
`opacity: appReady ? 1 : 0`, so the theory was that the browser had nothing
contentful to paint for the ~1.6 s the splash runs, explaining a ~3 s FCP.

A/B, same server, same build, only the wrapper changing, 3 runs per arm:

| | perf | FCP | LCP | TBT |
|---|---|---|---|---|
| **desktop `/about`** with gate | 95 (94/95/95) | 655 ms | **968 ms** | 99 ms |
| **desktop `/about`** gate removed | 95 (95/94/95) | 654 ms | 1119 ms | 109 ms |
| **mobile `/`** with gate | **70** (69/70/70) | 3185 ms | **5039 ms** | 209 ms |
| **mobile `/`** gate removed | 68 (68/69/67) | 3204 ms | 5254 ms | 246 ms |

FCP is **identical** (655 vs 654 ms desktop; 3185 vs 3204 ms mobile) and LCP is
**worse** with the gate removed, on both form factors. The change was reverted.

Why the theory failed: `LoadingScreen` is `fixed inset-0 z-[9999]` on an
**opaque** violet background with progress UI. That *is* contentful — the
splash itself is the first contentful paint. FCP was never waiting on the
routed app. Removing the gate only adds main-thread work rendering content
nobody can see, which is free on desktop and measurably costly at 4x throttle.

There is also no robustness argument for removing it: the splash is rendered
as `{!appReady && <LoadingScreen />}`, so if `onFinish` never fired the overlay
would stay mounted and cover the content regardless of its opacity.

**3. Render-blocking CSS.** Lighthouse reported the stylesheet as
render-blocking for 1055 ms with ~300 ms of theoretical savings, but the
network trace showed every resource finishing by ~51 ms. Two related dead ends:
`unused-css-rules` scores **1.00** (nothing to purge), and tokenising repeated
arbitrary shadows saves **zero bytes**, because Tailwind emits one rule per
*distinct* value, not per usage.

Still worth doing for design reasons, not performance: there are **250
distinct arbitrary shadow values** across 499 usages (one appears 69 times)
where an elevation scale would have ~8. That is a design call.

### How to investigate the next one

- Build with `--sourcemap` to a scratch dir, then for each chunk read its
  `.map` and group `sources` by node_modules package to see what is actually
  inside it. `vendor` is now 148 kB, mostly framer motion-dom,
  react-helmet-async and sonner — all genuinely global.
- A/B on the same server and build, change exactly one thing, 3 runs per arm,
  and compare **spreads**. Two of the three rejected items above survived a
  single-run comparison and died under this one.

### Gates

`categories:performance` is an **error floor at 0.35** with the CWV timings as
**warnings**; a11y / best-practices / SEO are hard gates at **0.95**. The floor
sits far below current scores deliberately: it catches regressions without
failing builds on run-to-run noise.

Two things left deliberately, both design decisions:

- `--text-micro` is 10 px and is ~34 % of the text on /about. Lighthouse wants
  >= 12 px for mobile legibility. Raising it shifts layout site-wide, so it is
  yours to make.
- ~~The terracotta accent on light-ground display headings is 1.9:1.~~
  **Stale — there is no such heading.** Verified 2026-08-25: every terracotta
  accent word inside a heading sits on a dark ground (StoreHero
  `bg-violet-deep`, the Footer, and the AboutPage CTA band are all
  `text-white` sections), which the declared terracotta-on-charcoal pair
  already covers. Nothing to fix. If a light-ground terracotta heading is ever
  added, use `terracotta-800` (#856212, 5.60:1 on white) and declare the pair
  — the gate checks declared pairs only, so it would not catch it otherwise.

### Contrast: the gate had a hole, now closed

A desktop run failed `color-contrast` on `text-mint-700/75` at 10.5 px —
**3.86:1** on white. `lint:contrast` passed it because that gate checks a table
of *declared* colour pairs and nobody had declared that one: a gate that only
sees what someone remembered to list.

Worse, **`lint:contrast` was never wired into CI at all** — the script and npm
entry existed but no job called it, which is why a two-second lint error
surfaced as a failure in the Lighthouse job instead. It now runs in the
frontend job alongside the design-token gate.

Eleven diluted tokens existed across nine files. They are fixed, and
`web/scripts/check-contrast.mjs` carries a second rule that needs no
declaration: an alpha on a `-600/-700/-800` **text** token is a defect by
pattern, since those darker steps exist precisely to clear AA. (Alpha on
`bg-*` / `ring-*` is fine and is not flagged.) Verified in both directions —
injecting `text-rose-600/75` makes the gate exit 1 and name the file.

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

## 9. Index review against real query shapes (D2, 2026-08-26)

The backlog asked for EXPLAIN on the hot queries rather than a schema
read. `scripts/explain-hot-queries.js` does that: it runs read-only
`EXPLAIN` on 19 query shapes taken from `src/` (contact inbox, campaign
audience, notifications, EmailLog dedupe and retry, abandoned carts, member
cart, payment KPIs, admin/member orders, store listing, related products,
funnel, reviews, consultations) and prints the access type, chosen key and
row estimate per table. It resolves `@@map` (Review → `product_reviews`)
and flags a full scan only on tables over 500 rows.

    node scripts/explain-hot-queries.js

Result on production, 2026-08-26: **0 full scans on tables over 500 rows.**
Every table except `PageView` (~1,675 rows) has fewer than 10 rows, and the
three tables that do scan (`ContactMessage`, `NewsletterSubscriber`,
`Payment`) are scanned because they are empty or nearly so — the optimizer
prefers a scan to a seek there, and an index would not be used. Adding
compound indexes now would be guessing; the shapes the data will eventually
need are already in the script, so re-run it when the tables have real
volume and add indexes for whatever it flags.

Verified in the same pass: the 72 Prisma models match the 72 production
tables exactly (no schema drift).
