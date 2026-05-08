# Launch Playbook · mustaphaukizuru.com

The single source of truth for taking the platform from local dev to live on Hostinger. Sequenced top-to-bottom — do not skip.

Companion documents (consult as referenced):
- `SMOKE_TESTS.md` — endpoint-level curl tests
- `SEO_BASELINE.md` — sitemap + JSON-LD verification
- `CORE_WEB_VITALS.md` — image optimization + Lighthouse runbook

---

## Phase 0 · One-time setup (do once, ever)

Verify your local machine has everything needed.

```powershell
# Required
node --version          # ≥ 18 LTS
npm --version           # ≥ 9
git --version           # any modern
mysql --version         # client only — DB is on Hostinger

# Recommended for the launch sequence
lighthouse --version    # npm install -g lighthouse
cwebp -version          # https://developers.google.com/speed/webp/download
```

If `lighthouse` or `cwebp` are missing, install before continuing — they're load-bearing for steps 6 and 8.

---

## Phase 1 · Local pre-flight (~30 min)

### 1.1 · Pull latest + clean install

```powershell
cd C:\Users\mruki\OneDrive\Documents\GitHub\mustaphaukizuru.com
git pull
rm -r -fo node_modules, web\node_modules
npm ci
cd web
npm ci
cd ..
```

### 1.2 · Apply schema changes

> Hostinger blocks `prisma migrate dev`. Always use `prisma db push`.

```powershell
npx prisma db push
npx prisma generate
```

If `db push` fails on the new Payment unique constraint, you have legacy duplicate Payment rows. Fix:

```sql
SELECT paymentGateway, gatewayTransactionId, COUNT(*) cnt
  FROM Payment GROUP BY 1, 2 HAVING cnt > 1;
-- Then manually merge or DELETE the older duplicates and retry db push.
```

### 1.3 · Seed the email templates (idempotent)

```powershell
npm run seed:email
```

Expect 11 templates: `auth.welcome`, `auth.password-reset`, `auth.account-claim`, `order.placed`, `order.confirmed`, `order.refunded`, `download.ready`, `contact.admin`, `contact.confirm`, `newsletter.confirm`, `support.reply`.

### 1.4 · Seed the bio (only if you've reset the DB)

```powershell
npm run seed:bio
```

Skip if your About page already shows the right experience/education.

### 1.5 · Verify env vars

`.env` must have these or the API will refuse to boot in production:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | MySQL connection string |
| `JWT_SECRET` | yes | ≥ 64 chars; regenerate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `CLIENT_URL` | yes | e.g. `https://mustaphaukizuru.com` |
| `FRONTEND_URL` | optional | defaults to `CLIENT_URL` |

**Payment credentials — booby-trap aware** (env.js will hard-fail in production if a gateway is half-configured):

| Variable | When required |
|---|---|
| `MP_ACCESS_TOKEN` | Set ONLY if MercadoPago checkout is enabled |
| `MP_WEBHOOK_SECRET` | **Required when** `MP_ACCESS_TOKEN` is set — without it, signature verification is skipped (payment forgery vulnerability) |
| `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET` | Set ONLY if PayPal checkout is enabled |
| `PAYPAL_WEBHOOK_ID` | **Required when** PayPal credentials are set |

Other:

| Variable | Purpose |
|---|---|
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Email delivery (Hostinger SMTP) |
| `CONTACT_ADMIN_EMAIL` or `SUPPORT_EMAIL` | Where contact-form notifications go |
| `SENTRY_DSN` | Optional but strongly recommended for production error tracking |

### 1.6 · Local API smoke test

```powershell
# Shell A — API
npm run dev

# Shell B — frontend (Vite dev server, hot-reload)
cd web
npm run dev
```

Walk the runbook in `SMOKE_TESTS.md` sections 1, 2, 3, 4, and 8. Minimum:
- [ ] `/admin/users` — suspend a test user, verify they get blocked from logging in
- [ ] `/admin/categories` — create + edit + delete a category
- [ ] `/admin/pages` — create + publish + delete a page
- [ ] `/admin/email-templates` — open a template, verify "Available Variables" hints render, send a test email to your own inbox

If any of these fail → fix locally before proceeding.

### 1.7 · Image optimization

```powershell
npm run optimize:images
# review what would convert, then:
npm run optimize:images -- --apply
```

Update affected `<img src>` tags to the `.webp` variants (or wrap critical images in `<picture>` with the original as fallback). **Delete the unused 1.1 MB headshot PNG**:

```powershell
git rm "web/public/images/profile/Ukizuru_Mustapha_Professional_Headshot.png"
```

### 1.8 · Janitor cron note

The orphan-order janitor (`scripts/cancel-stale-orders.js`) will be installed as a cron in Phase 4. No local action needed.

---

## Phase 2 · Production build + Lighthouse baseline (~20 min)

### 2.1 · Production build locally

```powershell
cd web
npm run build      # Vite outputs to ../public/
cd ..
npm start          # serves both API and SPA from http://localhost:5000
```

### 2.2 · Capture pre-launch Lighthouse baseline

This is your **before** snapshot. Save it.

```powershell
mkdir reports 2>$null
lighthouse http://localhost:5000/                  --output=html --output-path=./reports/01-home-desktop.html       --view --preset=desktop
lighthouse http://localhost:5000/                  --output=html --output-path=./reports/02-home-mobile.html        --view --form-factor=mobile
lighthouse http://localhost:5000/store             --output=html --output-path=./reports/03-store-desktop.html      --view --preset=desktop
lighthouse http://localhost:5000/services          --output=html --output-path=./reports/04-services-desktop.html   --view --preset=desktop
```

Record the four scores in a sticky note. Anything ≥ 90 is great, ≥ 75 is acceptable for mobile. If anything is < 50 → revisit `CORE_WEB_VITALS.md` punch list before launch.

### 2.3 · Sitemap sanity check

```powershell
curl http://localhost:5000/sitemap.xml | Select-String "<loc>" | Measure-Object -Line
```

Expect ≥ 10 URLs (10 static + however many active products + services + projects + CMS pages you have).

```powershell
curl http://localhost:5000/robots.txt
```

Expect the file to render with `Sitemap: https://mustaphaukizuru.com/sitemap.xml` line intact.

---

## Phase 3 · Hostinger deploy (~30 min)

### 3.1 · Commit + push

```powershell
git add .
git commit -m "feat: launch readiness — guest checkout, payment hardening, email DB templates, dynamic sitemap, orphan janitor"
git push origin main
```

### 3.2 · SSH to Hostinger + pull

```bash
ssh user@your-vps
cd ~/public_html      # or wherever the repo lives on Hostinger
git pull
npm ci
cd web && npm ci && cd ..
```

### 3.3 · Apply env-var changes

Edit your production `.env` to add the new required variables:

```bash
nano .env
# Add (or verify present):
#   MP_WEBHOOK_SECRET=...     (if MP_ACCESS_TOKEN is set)
#   PAYPAL_WEBHOOK_ID=...     (if PAYPAL_CLIENT_ID is set)
```

> If you're not yet ready to run a gateway, **unset** its access token / client id entirely. The env preflight will refuse to boot if a gateway is half-configured (token without webhook secret).

### 3.4 · Schema push + regenerate

```bash
npx prisma db push
npx prisma generate
```

### 3.5 · Seed email templates

```bash
npm run seed:email
```

### 3.6 · Build the SPA

```bash
cd web
npm run build      # outputs to ../public
cd ..
```

### 3.7 · Restart the API

Depends on your process manager:

```bash
# PM2
pm2 restart mustaphaukizuru
pm2 logs --lines 50    # watch boot — should see no ❌ Critical configuration errors

# systemd
sudo systemctl restart mustaphaukizuru
sudo journalctl -u mustaphaukizuru -n 50 --no-pager

# Hostinger Node app panel
# Click "Restart application" in the hPanel
```

**Watch the boot log carefully.** You should see:
- ✅ Server listening on port N
- (no ❌ lines)
- (warnings for any missing optional services are OK in production)

If you see `❌ Critical configuration error(s)` → the API will exit. Read the message, fix the env var, restart.

---

## Phase 4 · Post-deploy verification (~20 min)

Run these against the live URL — `https://mustaphaukizuru.com` everywhere.

### 4.1 · Health check

```bash
curl -i https://mustaphaukizuru.com/api/health
# Expect: HTTP 200 + JSON { ok: true, ... }
```

### 4.2 · Sitemap + robots

```bash
curl https://mustaphaukizuru.com/sitemap.xml | grep -c "<loc>"
# Expect: ≥ 10

curl https://mustaphaukizuru.com/robots.txt
# Expect: Disallow lines + Sitemap: line
```

### 4.3 · Critical pages render

Open in a browser, check no console errors:
- [ ] `/` Home
- [ ] `/store`
- [ ] `/store/<one-product-slug>`
- [ ] `/services`
- [ ] `/about`
- [ ] `/contact`
- [ ] `/login`
- [ ] `/admin/dashboard` (after login)

### 4.4 · Guest purchase end-to-end

In an **incognito window** (no cookies, no auth):

1. Add a product to cart
2. Go to `/checkout`
3. **Verify**: page loads, no redirect to `/login`
4. Fill in name + a NEW test email (e.g. `your-name+launch@gmail.com`)
5. Pick MercadoPago, complete payment via sandbox
6. Land on `/checkout/success/...`
7. **Verify email arrives** with subject `Order MU-XXXX confirmed — set your password to access your downloads`
8. Click the email link → set password → log in → see the order in `/dashboard/orders` → download the file

If any step fails → check `EmailLog` table for failed sends, check server logs for stack traces.

### 4.5 · Webhook idempotency check

From your dev machine, simulate a duplicate MP webhook:

```powershell
$REQ_ID = "post-launch-test-$(Get-Date -UFormat %s)"
$body = '{"action":"payment.updated","data":{"id":"99999999"}}'

# Fire twice
Invoke-RestMethod -Uri "https://mustaphaukizuru.com/api/mercadopago/webhook" -Method Post -ContentType "application/json" -Headers @{"x-request-id"=$REQ_ID; "x-signature"="ts=0,v1=ignored-in-dev"} -Body $body
Invoke-RestMethod -Uri "https://mustaphaukizuru.com/api/mercadopago/webhook" -Method Post -ContentType "application/json" -Headers @{"x-request-id"=$REQ_ID; "x-signature"="ts=0,v1=ignored-in-dev"} -Body $body
```

Second call should return `{"received":true,"duplicate":true}`. Check the DB has only one PaymentWebhook row for that `gatewayEventId`.

### 4.6 · Set up the orphan-order cron

```bash
crontab -e
```

Add (adjust the path to your install):

```cron
# Cancel orders stuck in pending > 24h, hourly
0 * * * * cd /home/USER/public_html && /usr/bin/node scripts/cancel-stale-orders.js >> logs/janitor.log 2>&1
```

Verify with `crontab -l`. Tail the log on the next hour mark:

```bash
tail -f logs/janitor.log
```

### 4.7 · Submit sitemap to search engines

- **Google Search Console**: https://search.google.com/search-console → property `mustaphaukizuru.com` → Sitemaps → submit `/sitemap.xml`
- **Bing Webmaster Tools**: https://www.bing.com/webmasters → submit `/sitemap.xml`

### 4.8 · Validate rich snippets + OG previews

- Rich Results Test (run on a product detail URL): https://search.google.com/test/rich-results
  - Expect: Product, BreadcrumbList, FAQPage detected
- Mobile-Friendly Test: https://search.google.com/test/mobile-friendly
- LinkedIn Post Inspector (paste your home URL): https://www.linkedin.com/post-inspector/
- Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/

### 4.9 · Re-run Lighthouse against live

```powershell
lighthouse https://mustaphaukizuru.com/                 --output=html --output-path=./reports/05-prod-home-desktop.html       --view --preset=desktop
lighthouse https://mustaphaukizuru.com/                 --output=html --output-path=./reports/06-prod-home-mobile.html        --view --form-factor=mobile
lighthouse https://mustaphaukizuru.com/store            --output=html --output-path=./reports/07-prod-store-desktop.html      --view --preset=desktop
```

Compare against your Phase 2.2 baseline. If production scores are lower than local → it's network latency from Hostinger's edge. Acceptable, but flag for later CDN consideration.

---

## Phase 5 · Rollback plan

If anything breaks badly within 30 minutes of deploy:

### 5.1 · Code rollback

```bash
# On Hostinger
git log --oneline -5            # find the previous good commit
git checkout <prev-commit>
cd web && npm run build && cd ..
pm2 restart mustaphaukizuru     # or your process manager
```

### 5.2 · Schema rollback

The new `Payment.payment_gateway_tx_uq` and `PaymentWebhook.webhook_event_uq` constraints + the new `gatewayEventId` column are **backward-compatible**. Old code can run against the new schema without issue. No schema rollback needed for routine code reverts.

### 5.3 · Email template rollback

If a new email template has a typo that's hurting customers:

1. Open `/admin/email-templates`
2. Edit the broken template's HTML/subject directly
3. Save
4. Done — changes are live immediately, no deploy needed

This is exactly why we migrated everything to DB templates.

### 5.4 · Disable a gateway in an emergency

If MP or PayPal starts misbehaving:

```bash
nano .env
# Comment out the gateway's access token / client id
# MP_ACCESS_TOKEN=...
pm2 restart mustaphaukizuru
```

The env preflight will detect the disabled gateway and skip its checkout option. Existing orders/refunds processed via that gateway still work because `Payment` rows reference `gatewayTransactionId` directly.

---

## Phase 6 · Post-launch monitoring (first 7 days)

### 6.1 · Daily checks (5 min)

- [ ] `pm2 logs --lines 200 | grep -E "ERROR|❌"` — any unexpected errors?
- [ ] `SELECT COUNT(*), status FROM \`Order\` WHERE createdAt > DATE_SUB(NOW(), INTERVAL 1 DAY) GROUP BY status;` — any stuck pending?
- [ ] `SELECT COUNT(*), status FROM EmailLog WHERE createdAt > DATE_SUB(NOW(), INTERVAL 1 DAY) GROUP BY status;` — any failed?
- [ ] Check Hostinger inbox + spam folder for `auth.welcome`, `order.placed`, `order.confirmed` emails (send yourself a test order if zero real orders that day)

### 6.2 · Weekly checks (15 min)

- [ ] PageSpeed Insights field data: https://pagespeed.web.dev/?url=https%3A%2F%2Fmustaphaukizuru.com%2F&form_factor=mobile
- [ ] Search Console → Coverage report — are pages getting indexed?
- [ ] `npm run janitor:orders -- --dry-run` to see what cron has been cleaning up
- [ ] Review `EmailLog` for any pattern of failures (e.g. one specific template never delivers → SMTP issue with that subject line, etc.)
- [ ] Review `AdminAuditLog` for unexpected admin activity

### 6.3 · Sentry / error tracking

If `SENTRY_DSN` is set, watch the Sentry dashboard for:
- New error patterns (volume spikes)
- Slow transactions (any endpoint > 2s p95)
- Failing background jobs

### 6.4 · Customer feedback signals

- Reply-to address on transactional emails routes to your inbox — read every reply. Many launch issues surface here first ("I didn't get my download")
- Support tickets via `/dashboard/support` — same channel
- Watch for cart abandonment patterns: do most people drop at the email step? The payment step? The terms checkbox?

---

## Phase 7 · What's NOT done (intentionally deferred)

These are documented for awareness — not blockers, but worth tackling once you have real-world signal:

| Item | Where it's documented | When to revisit |
|---|---|---|
| Image responsive `srcset` (3 sizes per project image) | `CORE_WEB_VITALS.md` § 4 | After first PageSpeed field data |
| Framer Motion code-splitting | `CORE_WEB_VITALS.md` § 6 | If TBT > 300ms on mobile |
| `loading="lazy"` audit on every `<img>` | `CORE_WEB_VITALS.md` § 8 | Same |
| Mailer.js consolidation (rare emails like consultation reminders, support tickets still hardcoded) | Project priority #5 | When admin asks to customize one |
| Client project management feature (milestones, files, timelines) | Project priority #8 | When first paying client asks for it |
| Two-factor auth for admin account | Already partially built | Before any team member is added |
| CDN in front of Hostinger (Cloudflare proxy) | Not yet planned | If global traffic exceeds Mexican baseline |

---

## Quick reference card

Pin this at the top of your terminal when launching:

```
LOCAL PRE-FLIGHT
  npx prisma db push && npx prisma generate
  npm run seed:email
  npm run dev                    # one shell
  cd web && npm run dev          # other shell
  → walk SMOKE_TESTS.md sections 1, 2, 3, 4, 8

LOCAL BUILD
  npm run optimize:images -- --apply
  cd web && npm run build && cd ..
  npm start
  lighthouse http://localhost:5000/ --preset=desktop --view

DEPLOY
  git push
  ssh hostinger
  cd ~/public_html
  git pull && npm ci && cd web && npm ci && cd ..
  npx prisma db push && npx prisma generate
  npm run seed:email
  cd web && npm run build && cd ..
  pm2 restart mustaphaukizuru && pm2 logs

POST-DEPLOY
  curl https://mustaphaukizuru.com/api/health
  Test guest purchase end-to-end in incognito
  Submit sitemap to GSC + Bing
  Add cron for npm run janitor:orders
```

---

## Files referenced

- `docs/SMOKE_TESTS.md`
- `docs/SEO_BASELINE.md`
- `docs/CORE_WEB_VITALS.md`
- `scripts/cancel-stale-orders.js`
- `scripts/optimize-images.sh`
- `prisma/seed-email-templates.js`
- `prisma/seed-bio.js`
- `src/config/env.js` (the gateway preflight lives here)
- `src/services/sitemapService.js`
