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

- **9 colour pairs below 4.5:1 contrast**, all pre-existing, listed in
  `docs/DESIGN_SYSTEM.md`. `azure` on white (4.10) is the most visible.
  Fixing them is a design decision, so it was left to you.
- **Coverage gate is 30% lines** — set to the measured value so it ratchets
  instead of lying. Raise it as you add tests.
- `web/src/components/ui/legacy.jsx` still has one hand-rolled skeleton used by
  ~14 admin pages; migrating them to the unified shimmer is a tidy follow-up.
- Two newsletter endpoints exist (`/newsletter/subscribe` and the legacy
  `/newsletter`). Both now enforce double opt-in; the legacy one can be
  retired once nothing calls it.
- MercadoPago + PayPal remain the only gateways. Stripe is still deliberately
  absent.
