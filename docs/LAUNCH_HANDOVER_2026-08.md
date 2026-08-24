# Launch handover · branch `feat/roadmap-build`

Everything from the 42-step roadmap is implemented and committed **locally**.
Nothing has been pushed. This document lists what only you can do — the steps
that need the production database, real credentials, or your own words.

---

## 1. Before anything: the database migration is NOT automatic

Seven string columns became MySQL `ENUM`s. `prisma db push` will refuse the
`ALTER` (strict mode) or silently blank the value (non-strict) if any existing
row holds a value outside the new set.

```bash
# 1. dry run — exit 0 means safe, exit 2 lists offending rows
node scripts/backfill-enums.js

# 2. only if step 1 reported rows
node scripts/backfill-enums.js --apply

# 3. then push (data-loss flag is expected: column type changes)
npx prisma db push --accept-data-loss
npx prisma generate
```

Columns converted: `User.role`, `ContactMessage.status`,
`NewsletterSubscriber.status`, `EmailCampaignRecipient.status`,
`DiagnosticSubmission.audience`, `DiagnosticSubmission.tier`, `EmailLog.status`.

Everything else in the schema is additive (`deletedAt` on Product/Service/
BlogPost, `DownloadLog.productFileId`, `ClientProject.consultationId`,
`EmailLog.attempts/nextAttemptAt/payload`) and is safe to push.

## 2. Seeds to run after the push

```bash
node prisma/seed/services-seed.js     # the 4 service categories — REQUIRED,
                                      # /services/:slug and booking need them
node prisma/seed/portfolio-seed.js    # back-fills the case-study blocks
npm run seed:email                    # newsletter.confirm template (en/es)
```

## 3. One-off security migration

```bash
node scripts/invalidate-plaintext-passwords.js          # dry run
node scripts/invalidate-plaintext-passwords.js --apply  # clears non-bcrypt rows
```
Any account it clears must use "forgot password". The plaintext-password login
fallback is gone, so those rows can no longer sign in either way.

## 4. Placeholder copy you must replace

These render with `data-placeholder` markers so they are easy to find:

| Where | What |
|---|---|
| `web/src/data/homeData.js` → `testimonials` | 3 testimonials with fake names/companies. Replace and set `placeholder: false`. |
| `prisma/seed/portfolio-seed.js` → `outcomes` | 7 of 9 case-study metrics are illustrative. Put real numbers in Admin → Portfolio → Case study. |
| `web/src/i18n/locales/{en,es}/product.json` → `license.*` | Licence and updates policy wording — legal text, your call. |

## 5. Environment variables

`.env.example` and `web/.env.example` are now accurate. New/changed:

- Session auth uses cookies. If the API and SPA are ever served from different
  origins, `sameSite: "lax"` will not send the cookie — they must stay
  same-origin (they are today: Express serves the SPA).
- `PUBLIC_SITE_URL`, `BACKEND_URL`, `API_BASE_URL` are used by OG injection,
  newsletter confirm links and unsubscribe links — set them in production.

## 6. Deploy

`scripts/deploy.sh` now restarts via Passenger (`touch tmp/restart.txt`) when it
detects it, falling back to PM2/nohup. It builds before restarting, and
`public/assets` is no longer tracked in git — the build on the server produces
it. Verify the first deploy carefully.

`scripts/hostinger-recover.sh` replaces the seven ad-hoc root scripts:
`status | log | restart | recover | reinstall`.

## 7. Session-auth rollout note

The session JWT is now an httpOnly cookie (`mu_session`) plus a CSRF token
(`mu_csrf`). For one release the API **also** still accepts
`Authorization: Bearer` and still returns the token in login responses, so any
already-loaded browser tab or external client keeps working.

Drop both (the header fallback in `src/middleware/authMiddleware.js` and the
body/fragment token in `authController`) **≥ 30 days after deploy**. Until then
the XSS-hardening is only partial for clients that still use the old path.

## 8. Known debts (documented, not fixed)

- **9 colour pairs below 4.5:1 contrast** — all pre-existing, listed in
  `docs/DESIGN_SYSTEM.md`. `azure` on white (4.10) is the most visible.
  Fixing them is a design decision, so it was left to you.
- **Coverage gate is 30% lines** on `src/` — set to the measured value so it
  ratchets rather than lies. Raise it as you add tests.
- `web/src/components/ui/legacy.jsx` still has one hand-rolled skeleton used by
  ~14 admin pages; migrating them to the unified shimmer is a tidy follow-up.
- MercadoPago + PayPal remain the only gateways. Stripe is still deliberately
  absent.

## 9. What to verify manually before going live

The test suite covers the money and booking paths at the HTTP level, but these
need a human with real credentials:

1. Sandbox purchase end-to-end on **both** gateways → download works, receipt
   PDF opens, order appears in the dashboard.
2. Refund one sandbox order → entitlement revoked, download refused.
3. Book a consultation → Google Meet link created, reminder email fires.
4. Newsletter: subscribe → confirm link → campaign send → unsubscribe link.
5. Sign in on a phone and a desktop; sign out on one and confirm the other is
   unaffected, then confirm "sign out everywhere" (password change) kills both.
