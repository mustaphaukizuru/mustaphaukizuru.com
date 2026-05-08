# mustaphaukizuru.com

**Personal brand & SaaS platform for Mustapha Ukizuru** — Technology Consulting · Digital Products · STEM & School Solutions.

[Live site](https://mustaphaukizuru.com)

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js ≥ 18 · Express 4 |
| ORM / DB | Prisma 6 · MySQL on Hostinger |
| Frontend | React 19 · Vite 7 · Tailwind CSS v4 · Framer Motion · Lucide React |
| Auth | JWT + bcrypt + Google OAuth + optional 2FA (TOTP) |
| Payments | MercadoPago (LATAM) + PayPal (international) |
| Email | Nodemailer over SMTP |
| Logging | Winston with daily rotation · optional Sentry |

> **Stripe is intentionally not present.** Do not reintroduce it.

---

## Quickstart

```bash
git clone <repo-url> mustaphaukizuru.com
cd mustaphaukizuru.com

# Backend deps
npm install

# Frontend deps
cd web && npm install && cd ..

# Env files (copy + edit with DEV credentials only)
cp .env.example .env
cp web/.env.example web/.env
```

Fill `.env` with **development** values only:
- A separate dev MySQL database on Hostinger (never point dev at production)
- Sandbox MercadoPago credentials (`TEST-` prefix) — never live `APP_USR-` tokens
- Sandbox PayPal credentials (`api-m.sandbox.paypal.com`)
- Mailtrap or a secondary SMTP mailbox — never the live `hello@` mailbox
- A separate dev Telegram bot token from `@BotFather`

Apply schema and seed:

```bash
npx prisma db push
npx prisma generate
node prisma/seed/services-seed.js
node prisma/seed/portfolio-seed.js
node prisma/seed/email-templates-seed.js
```

> **Always `prisma db push`. Never `prisma migrate dev`** — Hostinger MySQL accounts cannot create the shadow database `migrate dev` requires.

Run:

```bash
# Terminal 1 — backend (port 5000)
npm start

# Terminal 2 — frontend (port 5173)
cd web && npm run dev
```

Visit `http://localhost:5173`.

---

## Production build

```bash
cd web && npm run build:seo && cd ..
NODE_ENV=production npm start
```

The Vite build emits to `../public/` (not `web/dist/`) so Express serves the SPA at `/` and the API at `/api/*` from the same origin. See `web/vite.config.js`.

For deploy steps (Hostinger SSH + PM2), see [`DEPLOY.md`](./DEPLOY.md).

---

## Repository layout

```
mustaphaukizuru.com/
├── src/                            # Express API
│   ├── server.js                   # Boot — Sentry → env → app → listen
│   ├── app.js                      # Helmet · CORS · CSP · rate limit · routes · SPA fallback
│   ├── config/env.js               # Env validation (fail-fast on missing required vars)
│   ├── controllers/                # HTTP I/O — wrapped in asyncHandler
│   ├── services/                   # Business logic — Prisma queries
│   ├── routes/                     # Express routers — dual-mounted /api + /api/v1
│   ├── middleware/                 # auth · rate-limit · upload · errorHandler
│   ├── lib/prisma.js               # Prisma singleton — never new PrismaClient elsewhere
│   └── utils/                      # asyncHandler · logger · mailer · validators
├── prisma/
│   ├── schema.prisma               # 53 models · 21 enums
│   └── seed/                       # Idempotent seed scripts
├── public/                         # SPA build output + static images/fonts/og
├── web/                            # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx                 # All lazy routes
│   │   ├── index.css               # Tailwind v4 + brand v3.0 @theme tokens + self-hosted fonts
│   │   ├── pages/                  # 50+ pages — public, auth, member, admin
│   │   ├── components/             # Shared primitives, layouts
│   │   ├── context/                # Auth, Cart context providers
│   │   ├── lib/api.js              # Centralized API client — never raw fetch
│   │   ├── seo/pageSeo.js          # Per-route SEO config consumed by Seo.jsx
│   │   └── services/               # Per-domain API clients
│   └── vite.config.js              # outDir=../public — builds into Express's static dir
├── scripts/
│   ├── deploy.sh                   # SSH + git pull + rebuild + pm2 reload
│   ├── backup-db.sh                # Nightly mysqldump + gzip + 30-day retention
│   ├── smoke-test.sh               # /api/health + /api/products live check
│   └── guard-duplicates.sh         # CI guard against the historical nested-dir bug
├── storage/                        # Runtime — logs, backups, uploads (all gitignored)
├── DEPLOY.md                       # Deploy runbook
├── SECURITY.md                     # Secret handling + vuln reporting
└── README.md                       # ← this file
```

---

## API surface

All routes are mounted **twice**:
- `/api/v1/<resource>` — canonical (use this)
- `/api/<resource>` — legacy alias with `Deprecation: true`, `Sunset: 2026-07-01`, and `Link: rel="successor-version"` headers

Webhooks (`/paypal/webhook`, `/mercadopago/webhook`) and `/api/health` are exempt from the deprecation headers since external services have those URLs hardcoded.

| Surface | Routes |
|---|---|
| **Public** | `/api/v1/products` · `/services` · `/portfolio` · `/auth` · `/coupons` · `/newsletter` · `/orders` · `/paypal` · `/mercadopago` · `/health` · `/contact` · `/downloads` |
| **Member** | `/api/v1/member/profile` · `/cart` · `/notifications` · `/support` · `/service-orders` · `/wishlist` · `/addresses` |
| **Admin** | `/api/v1/admin/dashboard` · `/products` · `/orders` · `/downloads` · `/payments` · `/categories` · `/coupons` · `/users` · `/support` · `/pages` · `/email-templates` · `/email-logs` · `/newsletter` · `/media` · `/services` · `/service-orders` · `/portfolio` · `/audit` |

Response shape:
```jsonc
// success
{ "success": true, "data": ..., "pagination": { /* optional */ } }
// error
{ "success": false, "error": { "code": "...", "message": "...", "details": [] } }
```

---

## Brand & design system

This repository implements **Brand v3.0** end-to-end. All colors come from CSS variables defined in `web/src/index.css` under `@theme`. **Never use hex literals in components.**

| Token | Hex | Role |
|---|---|---|
| `--color-violet` | `#5D3FD3` | Royal Violet — brand anchor |
| `--color-charcoal` | `#1A1B23` | Midnight Charcoal — text, headings |
| `--color-mist` | `#F8FAFC` | Cloud Mist — page canvas |
| `--color-azure` | `#0284C7` | Deep Azure — interactive |
| `--color-cyan` | `#7DD3FC` | Electric Cyan — accent |
| `--color-terracotta` | `#E9C46A` | Soft Terracotta — humanity (≤10% per surface) |

The **Innovation Gradient** `linear-gradient(135deg, #5D3FD3 0%, #0284C7 100%)` is **only** used on conversion CTAs (Buy · Checkout · Contact). One per viewport.

Fonts are **self-hosted** at `/public/fonts/`:
- `Sora-Variable.woff2` — display + body (weights 100–900)
- `JetBrainsMono-Variable.woff2` — code · prices · KPIs · timestamps (`font-variant-numeric: tabular-nums`)

Animations use Framer Motion only, with `prefers-reduced-motion` fallback. Icons come from Lucide React only.

---

## Database conventions

**Always:** `npx prisma db push && npx prisma generate`
**Never:** `npx prisma migrate dev`

Hostinger MySQL accounts cannot create the shadow database `migrate dev` requires. `db push` directly applies your schema changes without needing one.

After any schema change:
```bash
npx prisma db push
npx prisma generate
# restart the API
```

---

## Conventions

- **Backend:** CommonJS · controllers wrapped in `asyncHandler` · services hold business logic · Prisma client imported from `src/lib/prisma.js` (never `new PrismaClient()`).
- **Frontend:** ESM · React 19 hooks · Tailwind utility classes only · Framer Motion for all animations · Lucide React for all icons · React Router DOM for routing · all API calls through `web/src/lib/api.js`.
- **Styles:** brand v3.0 tokens via CSS variables — no hex literals in components.
- **Validation:** inline checks. **Do not introduce Zod, Joi, or Yup** — match existing style.
- **Commits:** Conventional Commits — `feat:` · `fix:` · `docs:` · `refactor:` · `chore:` · `test:` · `perf:` · `style:`.

---

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Boot Express + serve API + serve SPA from `/public/` |
| `npm run lint:structure` | CI guard — fails if duplicate nested `src/` dirs reappear |
| `npm run backup` | mysqldump → gzip → `storage/backups/`, prune > 30 days |
| `npm run smoke` | curl-based health + product API smoke test |
| `npm run deploy` | SSH-based deploy pipeline (Hostinger) |
| `cd web && npm run dev` | Vite dev server on `:5173` |
| `cd web && npm run build` | Vite production build to `../public/` |
| `cd web && npm run build:seo` | Build + regenerate `/sitemap.xml` |

---

## Security

See [`SECURITY.md`](./SECURITY.md) for:
- Secret handling rules (rotation cadence, dev/prod separation)
- Vulnerability reporting
- OWASP-aligned in-code safeguards (Helmet · CORS · rate limits · input sanitization · prepared statements via Prisma)

---

## License

Proprietary — © 2026 Mustapha Ukizuru. All rights reserved.

---

*Complexity, simplified.*
