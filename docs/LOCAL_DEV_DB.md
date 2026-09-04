# Local development database + demo data

`.env` points at the **local** MySQL set up below — development is local by default,
so you build and verify here and deploy to production deliberately. That is also why
`scripts/guard-prod-db.js` can block `db:push` and every `seed:*` script unless
`DATABASE_URL` resolves to a local host.

This document sets that host up and fills it with a launch-year of data, so the admin
dashboards, charts, order tables and member portal render with realistic volume
instead of empty states. The production URL lives in `.env.production` and on the
commented `# PRODUCTION_DATABASE_URL=` line in `.env`; §6 covers switching to it.

---

## 1 · Start a local MySQL

```bash
docker compose -f docker-compose.dev.yml up -d
```

Port **3307** so it does not fight an existing MySQL on 3306. Data lives in the
named volume `muk-dev-mysql`; `docker compose -f docker-compose.dev.yml down -v`
throws it away.

No Docker? Any local MySQL 8 works — create a database and a user, then adjust
the URL below.

## 2 · Point `.env` at it

```env
DATABASE_URL="mysql://muk:muk@127.0.0.1:3307/muk_dev"
```

Keep the production URL somewhere safe (a commented line, or `.env.production`)
— the guard is host-based, so switching back is just switching this line.

If you would rather not edit `.env` at all, every command below also works with
the URL passed inline, which leaves the file untouched:

```bash
DATABASE_URL="mysql://muk:muk@127.0.0.1:3307/muk_dev" npm run db:push
```

`dotenv` does not overwrite variables already present in the environment, so the
inline value wins.

## 3 · Create the schema

```bash
npm run db:push
```

The guard now passes because the host is `127.0.0.1`. This is `prisma db push`,
never `migrate` — there is no migrations history and the schema file is the
source of truth.

## 4 · Seed

```bash
npm run seed:content   # public site: products, services, portfolio, blog,
                       # bio, client logos, plans, email templates
npm run seed:demo      # transactional volume: customers, orders, payments,
                       # invoices, refunds, consultations, projects, tickets,
                       # reviews, subscribers, analytics
```

Run `seed:content` first — `seed:demo` builds its orders out of the products
and services that seed creates, and refuses to run if the catalogue is empty.

### What `seed:demo` writes

| Area | Volume |
|---|---|
| Customers (with profiles) | 40 |
| Orders across 12 months | 120 — 88 paid, 6 refunded, 10 pending, 8 failed, 8 cancelled |
| Payments / invoices / refunds | 120 payments (one per order); 94 invoices (paid + refunded); 6 full refunds |
| Coupons + usages | 4 codes, including one expired |
| Carts | 12 abandoned, 5 active |
| Consultations | 25, past and upcoming |
| Client projects | 8, with 44 milestones, 32 comments and 26 file records |
| Support tickets | 15, with message threads |
| Reviews / testimonials | 36, sector- and language-matched, 6 featured; every one pinned to a real paid order item |
| Newsletter subscribers | 200, mixed `subscribed` / `pending` / `unsubscribed` |
| Contact messages | 30 |
| Self-audit submissions | 18 |
| Analytics | 90 days — 16,730 page views, 4,678 events, 90 daily rollups |

Sign in as any seeded customer with the password **`DemoPass!2026`**.

Four properties are worth knowing, because they are what make the data useful
rather than merely present:

- **Deterministic.** A seeded PRNG, never `Math.random`. Two machines produce
  identical data, so "the chart looks wrong on mine" is a real difference.
  Change `DEMO_SEED` in the script to reroll everything.
- **Internally consistent.** The daily analytics rollup is aggregated from the
  same orders that appear in the order list, and the funnel widths are derived
  (`add_to_cart` > `begin_checkout` > `purchases`). Numbers invented
  independently per table would hide exactly the reconciliation bugs the
  dashboards exist to surface.
- **Rule-abiding.** Refunds are full only, coupons respect their minimum-order
  and per-user limits, reviews are pinned to a real `OrderItem` so they are
  genuine verified purchases, and newsletter rows include `pending` ones that
  campaign audiences must exclude. Seeded data that broke these would make
  working validation look broken.
- **Reversible.** `npm run seed:demo -- --purge` removes it. A plain
  `npm run seed:demo` purges first, so re-running never doubles the dataset.

## 5 · Run the app against it

```bash
npm run dev:demo             # API on :5001, local demo DB, cron off
cd web && npm run dev:demo   # SPA on :5174, pointed at :5001
```

Then open **http://localhost:5174**.

### Why the demo stack still exists

`npm run dev` on :5000 now reads a `.env` that already points at this local
database, so the default stack shows the seeded catalogue and the dashboards fill
in. The `dev:demo` pair is no longer required for that — it survives as a *second*
stack you can run beside the first, which is useful when you want to keep :5000 on
one dataset (or temporarily on production, for a read) while still having the demo
data open on :5174.

| | SPA | API | Database | Products |
|---|---|---|---|---|
| default stack | :5173 | :5000 | local `muk_dev` on :3307 | 9 |
| demo stack | :5174 | :5001 | local `muk_dev` on :3307 | 9 |

Both can run at once. `web/.env.demo` (gitignored) overrides only
`VITE_API_BASE_URL`; every other `VITE_*` value still comes from `web/.env`, and
your :5173 server is untouched.

If you would rather use :5173, stop your own API and restart it against the
local database instead — then the demo pair is unnecessary:

```bash
DATABASE_URL="mysql://muk:muk@127.0.0.1:3307/muk_dev" DISABLE_CRON=1 npm run dev
```

### Two settings that are load-bearing

- **`CLIENT_URL`, not `FRONTEND_URL`,** feeds the CORS allow-list
  (`src/config/env.js` → `src/app.js`). Set the wrong one and the API answers
  every request with 200 and **no `Access-Control-Allow-Origin` header**: curl
  looks perfect and the browser blocks everything. `scripts/dev-demo.js` sets
  both.
- **`DISABLE_CRON=1`.** The scheduler drives abandoned-cart mail, invoice
  dunning and campaign sending. Pointed at the demo dataset it would try to mail
  200 `@demo.test` subscribers and every abandoned cart. `.test` is unroutable
  so nothing escapes, but each attempt still burns an SMTP timeout.

`scripts/dev-demo.js` refuses a non-local `DATABASE_URL` for the same reason
`seed:demo` does — this port is where you go to look at invented revenue, and
pointing it at production would show it beside the real thing.

Sign in at `/admin` as **`admin@demo.test`** / **`DemoPass!2026`** — the seed
creates that account only if no admin exists yet, so on a database that already
has a real admin it reuses that one and consultations and projects are assigned
to the account you actually sign in with.

### Limits

- **`ProjectFile` rows are metadata only.** No bytes are written under
  `storage/`, so downloading a project file from the portal will 404. That is
  expected — the seed does not scatter junk outside the database.
- **Consultations use `meetingProvider: "manual"` with no link.** Meet links
  come only from Google Calendar; faking a Meet URL would misrepresent a real
  integration.
- **`DailyMetric` purge is window-based.** That table has no spare column to
  mark and one row per date by constraint, so `--purge` clears the last 90
  days. On a local database that is the whole table anyway.
- **Product covers are generated art, not photography.** See "Product cover
  art" below. They are real, on-brand and committed; they are not photographs
  of a physical thing, because these products do not have one.
- **Revenue looks small in places.** Six of the nine seeded products are priced
  MX$10–18 (`prisma/seed/products-seed.js`), so product-only months roll up to a
  few hundred pesos while months containing a plan sale roll up to tens of
  thousands. That is the catalogue's pricing, faithfully reflected — not a seed
  artefact. The four zero-priced services are excluded from checkout entirely,
  because a `basePrice` of 0 means "request a quote", not "free".

### Testimonials

The seed writes **36 invented testimonials, 6 of them featured**, and they
reach the home page the way a real one would: `Home.jsx` renders whatever
`GET /api/v1/reviews/featured` returns (approved + admin-featured reviews).
Nothing is hardcoded into the SPA — `web/src/data/homeData.js` says so
explicitly, and there are no placeholder entries there to replace. Because the
seed cannot run against a non-local database, none of these can reach the live
site.

They are written for the market rather than filled with generic praise:

- **Language follows the client.** Mexico and LATAM personas write in Spanish,
  the UK / IE / US / CA / DE / TR / RW accounts in English. A testimonial in
  the wrong language is the first thing that reads as fabricated. Accents are
  real (`decisión`, `capacitación`, `años`) — unaccented Spanish is the second
  thing that reads as fabricated.
- **Content follows the sector.** `SECTOR_BY_COMPANY` maps each of the 40
  personas to school / professional / retail / industry / tech / ngo, so a
  school director talks about enrolment and supervision visits, a despacho
  about CFDI and client documents, a taller about inventory and quotes.
- **No quote is ever reused.** When a sector-and-language pool runs dry the
  candidate is skipped rather than given a repeat; there are far more
  reviewable order items than the 36 reviews needed, so skipping is free.
- **Not uniformly glowing.** The rating deck is 20 × 5★, 11 × 4★, 4 × 3★ and
  1 × 2★, and several quotes carry a genuine caveat ("the reporting still feels
  basic", "the first month's learning curve was steeper than we expected").
  Uniform five-star rapture is not credible.
- **The featured six are curated, not sampled** — one client per sector, all
  five-star and approved, with two English slots guaranteed so the marquee is
  not all one sector or all one language. `featuredOrder` is written explicitly
  because `reviewService` sorts by it ascending.

Curation happens in a second pass over the finished review set. Deciding it
inline cannot honour the language quota: reserving the last slots for English
blocks Spanish candidates, and if no qualifying English review turns up
afterwards the slots just stay empty — that attempt produced 4 of 6.

`assertSectorsCoverPeople()` runs before any destructive work and throws if a
company in `PEOPLE` has no entry in `SECTOR_BY_COMPANY`. Without it a rename in
one and not the other silently falls back to `professional` and hands a school
a bookkeeping testimonial. It runs ahead of the purge deliberately, so a
fixture error cannot delete the previous dataset and *then* fail.

> These are **imaginary**. They are development fixtures for seeing the site
> under load, not social proof. Publishing invented quotes as genuine customer
> testimony is a different thing entirely — see
> `docs/LAUNCH_HANDOVER_2026-08.md` §4, which records that the earlier invented
> testimonials were deliberately filtered out rather than published. Feature a
> real review through Admin → Reviews when you have one.

### Product cover art

The storefront used to render every product with a placeholder icon:
`ProductImage` was empty and no product art existed anywhere in the repo.

```bash
cd web && npm run covers:build      # render 9 covers (1200×1200 PNG, ≤200 kB)
npm run seed:product-images         # attach them to Product rows
```

`seed:content` runs the attach step for you; only `covers:build` is separate,
because rendering images is a build concern and not a database one.

**Canva was tried first and rejected on evidence.** It produced a competent
*Instagram post*: 4:5 portrait, title pinned to the top edge, imagery along the
bottom, marketing CTA copy, and Canva's placeholder handle `@reallygreatsite`
baked into the export. The product Gallery renders `aspect-square`, so the
square crop removed the title entirely. The mismatch is structural rather than
a prompting failure — a social-post generator composes for a 4:5 feed, while a
cover has to survive being cropped three different ways:

| surface | frame |
|---|---|
| product detail Gallery | `aspect-square` |
| Related / grid cards | `aspect-[4/3]` |
| StoreHero featured | `aspect-[5/3]` |

`web/scripts/generate-product-covers.mjs` renders one **square master** per
product instead, reusing the existing OG pipeline (`web/scripts/og/*`): the same
bundled Sora fonts, the same sharp rasteriser, the same 200 kB budget. That
buys the real Brand v3 tokens rather than an approximation, no third-party
licence attached to a commercial storefront, and art that regenerates
identically on any machine. Each product gets its own glyph — checklist, flask,
browser, layers, server rack — so a nine-card grid does not read as one tile
repeated.

Everything that must survive the widest crop (eyebrow, title, rule) sits inside
`y 380–860`; the brand mark and domain line sit outside it deliberately, being
decoration.

**Two write locations, both required.** `web/public` is the source directory
Vite serves in dev, and `vite build` copies it to `../public` with
`emptyOutDir: true`. Writing only to the repo-root `public/` — the first
attempt here — makes the dev server return the SPA fallback instead of the
image, and the next build deletes the files. The root copy is committed anyway
because production serves it through Express, which is also how the SPA
resolves the URL in dev (`http://localhost:5001/images/products/...`). Both
copies are written, matching how every other image in the project is stored.

`seed:product-images` never overwrites a primary image it did not create, so
replacing generated art with a real photograph through Admin → Products
survives a re-seed.

### Things this seed has to get right, and why

These are not stylistic choices — each one was a bug caught by running the real
admin services against the data, and each would have made working code look
broken:

- **The funnel's first step is a PageView, not an event.**
  `analyticsService.getFunnel` defines step one as a pageview whose path starts
  `/store/` (the store index deliberately excluded, so the step means intent).
  Emitting `view_item` events does nothing for it. The seed therefore gives
  every "viewer" session a real product-detail pageview, built from the actual
  product slugs. Getting this wrong renders a **169% step conversion rate**.
- **Funnel stages are counted in distinct sessions**, so they must be nested
  subsets — purchase ⊆ checkout ⊆ cart ⊆ view — not independent random draws.
- **The whole time axis is UTC.** Anchoring days on local midnight while
  bucketing them by UTC date drops orders near the window edge out of every
  rollup, and the revenue chart then disagrees with the order table by one
  order.
- **`DownloadLog` is what the dashboard's downloads tile counts**, not
  `UserDownload.downloadCount`. Entitlements without log rows read as zero
  downloads.
- **`Product.rating` / `reviewCount` are denormalised**, so both seeding and
  purging resync them. Purge without it leaves products advertising "4.25 from
  4 reviews" with zero reviews in the table.

## Verified

Run end to end against a real MySQL 8.4 on 2026-08-29:

- `db:push` → 73 tables; `seed:content` → 9 products, 11 services, 3 portfolio
  items, 10 blog posts, 68 email templates; `seed:demo` → the table above.
- **24 database-level invariants hold**, including exact reconciliation between
  `DailyMetric.revenue`, the `purchase` analytics events, and the orders in the
  same window (all three agree to the cent), sequential per-year invoice
  numbering, full-refund-only, and no host double-booking.
- Re-running `seed:demo` reproduces byte-identical counts (purge-first plus a
  seeded PRNG), and `--purge` returns all 27 transactional tables to zero while
  leaving every content row intact.
- API booted against the dataset: **20 admin endpoints return real payloads**,
  the funnel is monotone with all rates ≤ 100% at 7/30/90 days, and the
  12-month revenue endpoint reports AOV MX$2,175 with a 6.45% refund rate.
- `npm test` — 1060 tests, 77 suites, all passing.

## 6 · Switching to production

`.env` now ships pointing at the **local** database, so this section is about the
other direction: putting the production `DATABASE_URL` back when you deliberately
need to read or seed the live site. The commented `# PRODUCTION_DATABASE_URL=` line
in `.env` holds it. Swap it in, run what you need, then swap it back — and remember
the guard treats every unrecognised host as production.

---

## Why `seed:demo` has no `ALLOW_PROD_DB` override

Every other guarded script has one, because there are legitimate reasons to
push a schema or seed email templates to production. There is no legitimate
reason to write invented customers, invented revenue and invented reviews into
a live database:

- Fabricated reviews on a public site are fake social proof, not test data.
  `docs/LAUNCH_HANDOVER_2026-08.md` §4 records that the three invented
  testimonials were deliberately filtered out rather than published, for the
  same reason.
- Invented revenue silently corrupts the analytics the business reads, and
  `DailyMetric` rows in particular are hard to tell apart from real ones after
  the fact.

So `demo-seed.js` re-checks the host in-process — running
`node prisma/seed/demo-seed.js` directly cannot skip the guard either. If you
genuinely need populated dashboards on a staging deployment, point that
deployment's `DATABASE_URL` at a database you are willing to throw away and
run it there.
