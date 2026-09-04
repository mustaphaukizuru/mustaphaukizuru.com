# Runbook · rotating a secret

**Item:** T1-12 · **Written:** 2026-09-04 · **Applies to:** production on Hostinger (Passenger), and `staging` once it exists.

Every secret lives in the host `.env` under `hbuilds/config/` (the shared file `src/config/env.js` falls back to, so a fresh deploy clone still finds it). Nothing here is in git. `src/config/env.js` validates the required ones at boot and calls `process.exit(1)` on a missing or too-short value, which is the tripwire this runbook depends on: a typo does not half-start the app, it refuses to start. So after **every** restart below, the first thing to run is:

```bash
bash scripts/hostinger-recover.sh status     # node_modules + app loads
curl -s https://mustaphaukizuru.com/api/v1/health   # status, database, prismaGenerate
```

If the app does not come back: `bash scripts/hostinger-recover.sh log` shows Passenger's stderr, which will name the variable.

**The restart, every time:** `mkdir -p tmp && touch tmp/restart.txt`. Passenger picks it up on the next request; the first request after a restart is slow.

**Order matters.** Rotate one secret at a time, verify, then move on. Two at once means an ambiguous failure.

---

## 1 · `JWT_SECRET`

**Blast radius:** every signed-in session dies immediately, on every device. This is the intended effect of the rotation, and the only way to invalidate every outstanding token at once (`revokeUserSessions` in `src/services/authService.js` does it per user by bumping `tokensValidFrom`; rotating the secret does it globally).

**Announce first** if customers are mid-checkout. An order already created survives; the session does not.

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"   # 128 chars
# edit hbuilds/config/.env  →  JWT_SECRET=<new>
mkdir -p tmp && touch tmp/restart.txt
```

**Verify:** `curl -s .../api/v1/health` is 200; sign in on the site (the old cookie is rejected, the login sets a new one); an old `mu_session` cookie now answers 401 `AUTH_INVALID`.

**Minimum length is 64 characters** — `env.js` exits below that.

---

## 2 · `ANALYTICS_HASH_SALT`

**Blast radius:** same-day session stitching in `PageView` breaks — visits before and after the rotation look like different sessions for the rest of that day. `DailyMetric` rollups (the numbers on `/admin/analytics` beyond today) are unaffected because they are already aggregated. No customer-visible effect.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # 64 chars
# edit hbuilds/config/.env  →  ANALYTICS_HASH_SALT=<new>
mkdir -p tmp && touch tmp/restart.txt
```

**Verify:** the app boots (it refuses to without the variable, minimum 32 characters); load any public page and confirm a new `PageView` row appears in `/admin/analytics`.

---

## 3 · `MP_WEBHOOK_SECRET` (Mercado Pago)

**Order is the opposite of the others: provider first, host second.** The signature is computed by Mercado Pago and verified by us, so for the window between the two edits, deliveries fail signature verification and answer 401 — and Mercado Pago retries for 24 hours, so nothing is lost as long as the window is minutes.

1. Mercado Pago dashboard → your application → Webhooks → regenerate the secret. Copy it.
2. Edit `hbuilds/config/.env` → `MP_WEBHOOK_SECRET=<new>`, then restart.
3. In the dashboard, send a test notification (or wait for a real payment).

**Verify:** a `PaymentWebhook` row for the new delivery exists with `processed: true`. A 401 in the access log for that request means the two values still disagree. Never leave the secret unset in production: `verifyMercadoPagoSignature` fails closed there (it only skips outside production).

---

## 4 · `PAYPAL_WEBHOOK_ID` and the PayPal client secret

`PAYPAL_WEBHOOK_ID` is an identifier, not a secret, but it is what `verifyPaypalWebhookSignature` posts to PayPal's verify endpoint; a wrong value rejects every delivery. `PAYPAL_CLIENT_SECRET` is a real credential.

1. PayPal developer dashboard → your app → rotate the client secret, or → Webhooks → note the webhook id.
2. Edit both values on the host, restart.
3. PayPal's dashboard has a "send test" for webhooks; use it.

**Verify:** `curl -H "X-Health-Token: $HEALTH_TOKEN" .../api/v1/health/deep` reports `paypal: ok` (that check performs a real token request, so it proves the client id and secret), and a test webhook leaves a `PaymentWebhook` row.

---

## 5 · SMTP password

**Blast radius:** all outbound mail. Queued `EmailLog` rows stay queued and `emailRetryJob` drains them once the credential works, so a short window costs delay, not messages.

1. Change the mailbox password in hPanel → Emails.
2. Edit `SMTP_PASS` on the host, restart.

**Verify:** `.../api/v1/health/deep` reports `smtp: ok` (it calls `transporter.verify()`), then trigger one real send — the newsletter confirmation to your own address is the cheapest — and confirm an `EmailLog` row with `status: sent`.

---

## 6 · Google OAuth client secret / refresh token

**Blast radius:** "Sign in with Google" and Google Calendar booking links. Existing bookings keep their Meet links; new ones fall back to manual entry, which the booking flow already handles.

1. Google Cloud console → Credentials → rotate the client secret.
2. Edit `GOOGLE_CLIENT_SECRET` on the host; if the refresh token was invalidated, re-run `npm run google:bootstrap` from the dev machine and copy the new `GOOGLE_OAUTH_REFRESH_TOKEN`.
3. Restart, then `npm run google:verify`.

**Verify:** the boot log does not print the "misshapen refresh token" warning from `src/config/env.js`, and a test booking produces a Meet link.

---

## 7 · `HEALTH_TOKEN`

**Blast radius:** the hourly deep probe in `.github/workflows/uptime.yml` starts failing until both sides match. Nothing customer-facing.

Rotate in **both** places, GitHub first:

1. GitHub → repo → Settings → Secrets and variables → Actions → `HEALTH_TOKEN`.
2. Edit `HEALTH_TOKEN` on the host, restart.
3. Actions → Uptime → "Run workflow" and watch the deep step pass.

**Verify:** the manual run is green; `curl .../api/v1/health/deep` without the header is 401 `HEALTH_TOKEN_REQUIRED`.

---

## Later additions

These do not exist yet; the rotation note is written here when the item lands so the runbook never lags the code.

- **`SECRET_HANDOFF_KEY`** (T5-13): AES-256-GCM key for view-once credential handoff. Rotating it makes every unviewed secret unreadable — acceptable, but tell the client before rotating rather than after.
- **WhatsApp Cloud API** (`WA_ACCESS_TOKEN`, `WA_APP_SECRET`, `WA_VERIFY_TOKEN`, T5-22): rotate in Meta Business Manager first, host second, exactly like Mercado Pago; the webhook verifies `X-Hub-Signature-256` with `WA_APP_SECRET`.
- **`CFDI_API_KEY`** (T5-10): the PAC credential. Sandbox first on staging; a wrong key must not block the payment path, which is why stamping is asynchronous.

## If a secret leaked

1. Rotate it by the section above — do not wait for a maintenance window.
2. If it was `JWT_SECRET`, the rotation is itself the remediation (every token dies).
3. If it was a gateway credential, check the provider dashboard for activity you do not recognise, and `/admin/refunds` and `/admin/audit` for local writes.
4. Purge the value from wherever it leaked (a log, a screenshot, a chat) and note the incident in `docs/`. The value is in `hbuilds/config/.env` and in nothing that is tracked in git — confirm with `git log -S '<fragment>'` before assuming otherwise.
