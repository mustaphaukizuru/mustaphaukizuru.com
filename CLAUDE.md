# CLAUDE.md — mustaphaukizuru.com

Personal-brand + SaaS platform. Monorepo: Express API (`src/`) + React SPA (`web/`).

## Stack
- Backend: Node ≥ 18, Express 4 (CommonJS), Prisma 6 on MySQL (Hostinger), Nodemailer SMTP, node-cron, Winston, optional Sentry.
- Frontend: React 19 + Vite 7 + Tailwind v4, Framer Motion (all animation), Lucide (all icons), react-i18next (en/es), React Router.
- Payments: MercadoPago (LATAM) + PayPal (international). **No Stripe — never reintroduce it.**

## Commands
```bash
npm run dev            # API with nodemon (PORT from .env, default 5000)
npm test               # jest (roots: src/, test/)
npm run lint:structure # duplicate-file guard
cd web && npm run dev  # Vite SPA on :5173
cd web && npm run lint # eslint
cd web && npm run build:seo   # vite build → ../public + sitemap (or `npm run build`)
npm run seed:email     # upsert email templates from prisma/seed-email-templates.js
```

## Database — always `db push`, never `migrate`
```bash
npx prisma db push && npx prisma generate
```
Hostinger MySQL cannot create the shadow DB `migrate dev` needs. There is no migrations history; the schema file is the source of truth. Import the client from `src/lib/prisma.js` only (never `new PrismaClient()`).

## Deploy — Hostinger + Passenger (not PM2)
- `npm run deploy` → `scripts/deploy.sh`: pull, `npm ci`, build SPA into `public/`, `prisma generate`, `db push`, restart, smoke test.
- Restart = `mkdir -p tmp && touch tmp/restart.txt` (Passenger). PM2/nohup is only a fallback for non-Passenger hosts.
- `scripts/hostinger-recover.sh {status|log|restart|recover|reinstall}` for broken `node_modules` / stale Prisma client.
- `public/` build output (`assets/`, `index.html`, `sw.js`, `workbox-*.js`) is gitignored and rebuilt on the server. Source assets under `public/` (images, fonts, cv, documents, flags, favicons, `.htaccess`, error pages) are tracked.

## Business rules (do not "fix" these)
- Checkout requires login with a **claimed** account (guest → claim flow first).
- Coupons are **single-use per customer**; refunds are **full refunds only** (no partials).
- Newsletter is **double opt-in**: `POST /newsletter/subscribe` → status `pending` + confirm email → `GET /newsletter/confirm/:token` → `subscribed`. Campaign audiences only include `subscribed`; sends are queued and drained by `src/jobs/campaignSenderJob.js`.
- Booking Meet links come only from Google Calendar; no Jitsi fallback.

## Where things live
- Routes mount in `src/routes/index.js` (`/api/v1/*`, legacy `/api/*` with deprecation header). Controllers wrap `asyncHandler`; services hold logic.
- Cron jobs: `src/jobs/*.js`, registered in `src/jobs/scheduler.js` via `guarded()`; `DISABLE_CRON=1` silences them.
- Email templates: DB rows seeded from `prisma/seed-email-templates.js` (en + es); layout in `src/services/emailLayoutService.js`.
- Design tokens (Brand v3): `web/src/index.css` (`@theme`) + `web/src/styles/tokens.css`. No hex literals in components. Innovation Gradient only on conversion CTAs.
- i18n: `web/src/i18n/locales/{en,es}/*.json`, namespaces in `web/src/i18n/resources.js`.
- SEO: `web/src/seo/pageSeo*.js`, server-side OG injection in `src/middleware/ogInjector.js`.
- Env templates: `.env.example` (API), `web/.env.example` (Vite, `VITE_*` only).

## Testing conventions
- Jest, node env, files in `test/*.test.js`. Mock Prisma with `jest.mock("../src/lib/prisma", () => ({ model: { fn: jest.fn() } }))` and the logger with plain `jest.fn()`s; never hit a real DB.
- Route-guard tests assert every admin router uses `protect`; add new admin routers to that list.
- Validation is inline — do not add Zod/Joi/Yup.

## Branch / commit conventions
- Default branch `master`; work on `feat/...`, `fix/...`, `chore/...` branches and PR into master.
- Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`, `perf:`, `style:`.
- Never commit `.env*` (except `*.example`), `uploads/`, `.claude/`, or build output.
