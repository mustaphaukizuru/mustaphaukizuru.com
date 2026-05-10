# QA Fix Plan · 2026-05-09
### Source: "Error and task found.pdf" · 24 issues · enhanced & triaged

---

## § 0 · How this document is organized

The 24 raw findings are reorganized into **9 work tracks** by root cause and surface area. Several reported symptoms share a single bug — fixing the bug closes multiple findings simultaneously. Each track lists:

- **Findings closed** — the original numbered items it resolves
- **Root cause hypothesis** — the technical theory of why this is happening
- **Acceptance criteria** — how we know it's fixed
- **Effort** — Small (≤ 30 min) · Medium (30–90 min) · Large (≥ 90 min)
- **Priority** — P0 (revenue blocker) · P1 (UX blocker) · P2 (polish)

Total estimated effort: **~22 hours** of focused work across the 9 tracks.

---

## § 1 · Track A · Image resolver — single bug, three symptoms (P0)

| Finding | Surface |
|---|---|
| #4 | Cart + checkout: cover image missing on small product card |
| #5 | `dashboard/products`: cover image missing |
| Inferred | Likely also affects DashboardOrderDetailPage |

**Root cause hypothesis.** The Product → cover-image relationship is being shaped one way in the public store API but a different way in the cart / checkout / dashboard projection. Either:
- A. The cart-line-item resolver picks `product.imageUrl` when the actual field is `product.images[0].url`
- B. The dashboard query doesn't `include: { images: true }` so the image array is empty
- C. The frontend renders `product.image` (singular) but server returns `images[]` (plural)

**Acceptance.** Product cover image renders consistently across: store card, product detail, cart, checkout, order summary, dashboard products, dashboard order detail.

**Effort.** Medium — one shared `<ProductCoverImage product={...} fallback="..." />` component fixes all surfaces.

---

## § 2 · Track B · Routing & 404s (P0 — checkout-adjacent)

| Finding | Surface |
|---|---|
| #7 | `dashboard/orders/:id` returns 404 (Page Not Found) |
| #9 | Home hero "Featured Product" card → `/store/digital-transformation-starter-toolkit` returns "Product not found" |
| #20 | Admin `service-orders/:id` returns 404 (Page Not Found) |

**Root cause hypothesis.**
- #7: The order detail route is registered but the URL builder uses a different path (e.g., `/dashboard/orders/${id}` vs `/dashboard/order/${id}`)
- #9: Home hero is hardcoded to a slug that doesn't exist in the live database. Should fetch the actual current featured product.
- #20: Same pattern as #7 for service orders

**Acceptance.** Every "View" link from a list page lands on an existing detail route. The home hero "Featured Product" card always points at a real, currently-featured product.

**Effort.** Small — three router/link fixes + one Home query change.

---

## § 3 · Track C · Auth flow (P0 — login is gateway)

| Finding | Surface |
|---|---|
| #2 | Sign In button on LoginPage doesn't proceed after credentials submitted |

**Root cause hypothesis.** Either:
- A. Submit handler is not bound to button (button outside `<form>` or missing `type="submit"`)
- B. `e.preventDefault()` missing → form GET-submits the page and reloads
- C. API call succeeds but the JWT-storage step throws silently → no navigation
- D. CORS preflight fails on POST `/api/auth/login` (allowlist drift)

**Acceptance.** User submits valid credentials → JWT persisted → redirected to `/dashboard` (or `/admin` for admin role). Wrong credentials → inline error message, stays on login. Empty fields → field-level validation. Network error → toast + retry.

**Effort.** Small — read `LoginPage.jsx` + `authService.js`, identify which of A–D applies, fix.

---

## § 4 · Track D · Download flow asymmetry (P0 — revenue)

| Finding | Surface |
|---|---|
| #6 | `dashboard/products` download button → "Failed to fetch" error |
| #6 | `dashboard/downloads` download button → works correctly |
| #23 | After payment confirmation, client must see product + downloadable file ASAP |

**Root cause hypothesis.** Two different download endpoints / two different fetch implementations. The dashboard/downloads page calls the centralized `lib/api.js` (which injects JWT and handles blob streaming); dashboard/products page uses raw `fetch()` without JWT injection.

**Acceptance.** Both download buttons hit the same authenticated endpoint and produce the same successful download. Order confirmation email immediately includes a download link with a signed token (no login required from email link, expires in 7 days).

**Effort.** Medium — refactor dashboard/products to use the proven download flow from dashboard/downloads.

---

## § 5 · Track E · Product detail page polish (P1)

| Finding | Surface |
|---|---|
| #1 | "What's Included" tab shows nothing when clicked |
| #3 | Remove or replace "30-day refund" badge in trust strip |

**Root cause hypothesis.**
- #1: Tab is rendering an empty state because either (a) `whatsIncluded` field on product is null, (b) the conditional logic shows the empty section silently, or (c) the data is stored but the JSX uses the wrong key
- #3: Hardcoded `"30-day refund"` string in the trust-row component. Brand has no documented 30-day refund policy → either remove or replace with truthful claim ("Lifetime updates" is a stronger alternative if products carry version updates)

**Acceptance.** "What's Included" tab shows the actual file list when product has files; falls back to "ZIP archive contents listed inside" when not. The "30-day refund" badge is replaced with brand-aligned alternative.

**Effort.** Small.

---

## § 6 · Track F · About page content + Credentials (P1)

| Finding | Surface |
|---|---|
| #12 | View My CVs button → currently one CV; needs all 3 (Full-Stack Engineer · IT Manager · ICT Coordinator/STEM Instructor) |
| #13 | Experience timeline → replace with detailed 6-role version (matches Creator Profile v2.1 § 04) |
| #14 | Credentials → certifications: PDF certs show `certificate.renderError` |

**Root cause hypothesis.**
- #12: Single CV link in `AboutHero.jsx`. Replace with a 3-CV picker (modal or inline list).
- #13: Outdated experience array. Replace with the canonical 6-role data already present in `prisma/seed-bio.js` (committed earlier today).
- #14: PDF.js viewer can't render the certificate file. Either the file path is wrong, the file is missing, or PDF.js worker isn't loading. Translation key `certificate.renderError` is appearing because the `<i18n />` fallback fired.

**Acceptance.**
- #12: Three CV download buttons, each labeled with the track name
- #13: All 6 roles render with title, company, location, dates, lead summary, and quantified bullets
- #14: PDF certificates render inline; on failure, show the verified badge + "Open in new tab" button (already present per screenshot)

**Effort.** Medium-Large — #14 needs PDF.js debugging. #13 is mostly content propagation since the data is already in seed-bio.

---

## § 7 · Track G · i18n + currency (P1 — credibility)

| Finding | Surface |
|---|---|
| #10 | Mexican peso sign inconsistent: shows `$129.00 MXN` in some places, `MX$17.00` in others, plain `$17.00` in cart |
| #11 | EN/ES language toggle uses text only — needs flag icons |

**Root cause hypothesis.**
- #10: No central currency formatter. Different components use different formatters (Intl.NumberFormat with various locales, or hand-rolled string concat). Need `formatPrice(amount, currency='MXN')` utility used everywhere.
- #11: `LanguageSwitcher.jsx` renders `EN | ES` text. Brand identity is multilingual; flag icons (🇬🇧/🇺🇸 for EN, 🇲🇽 for ES) match the bilingual posture.

**Acceptance.**
- #10: Every price across the platform displays as `MX$ 129.00` (with thin space, MXN context implied) OR `$129.00 MXN` (chip-style) — pick one and propagate.
- #11: Language toggle shows flag + 2-letter code (`🇺🇸 EN` / `🇲🇽 ES`); flags rendered as inline SVG (not emoji — emoji rendering is OS-dependent and brand-incompatible).

**Effort.** Medium — central formatter + sweep ~20 components.

---

## § 8 · Track H · Service hero + storefront CTAs (P1)

| Finding | Surface |
|---|---|
| #15 | Replace "Download catalog" button → "Download your diagnosis check list" in service hero |
| #16 | Pricing (Choose your plan) — needs review |
| #17 | Changing price + add downloadable document — needs review |
| #18 | Search buttons — wire functionality |
| #19 | Storehero "Shop now" + "Browse categories" buttons must function |

**Root cause hypothesis.**
- #15: Button copy + asset swap. Trivial.
- #16, #17: Pricing UI not implemented or stale. Needs design review before code.
- #18: Storehero search field has no submit handler.
- #19: CTA buttons are decorative; missing `onClick` → router navigation.

**Acceptance.**
- #15: Button reads "Download your diagnosis checklist" and downloads a real PDF
- #19: "Shop now" → `/store`. "Browse categories" → `/store?category=all` or category modal
- #18: Search submits to `/store?q=<term>` and filters server-side

**Effort.** Small for #15, #18, #19. Medium for #16, #17 (pricing redesign needs scope discussion).

---

## § 9 · Track I · Order/Payment downstream (P0 — revenue)

| Finding | Surface |
|---|---|
| #8 | Payment-success email must include PDF invoice attachment |
| #21 | Consultation booking confirmed by admin → no video call link sent in confirmation email; admin "Confirm" action incomplete |
| #22 | Service order confirmed → member must see full project progress (member dashboard project page) |
| #23 | Product payment confirmed → client must see product + download immediately |
| #20 (admin) | Admin "Start" button on service orders does nothing |

**Root cause hypothesis.** The post-payment / post-confirmation workflows are partially wired:
- Payment webhooks correctly mark orders paid
- Order-paid email is sent (likely via `mailer.js` `sendPaidOrderEmail`)
- But the email doesn't attach the invoice PDF (pdfkit is in package.json but not invoked in the mail flow)
- Consultation confirmation hits the database but doesn't trigger the email-with-meeting-link helper
- Member dashboard project page exists but has no service-order → project linkage when no project record exists

**Acceptance.**
- #8: `Order.paid` event → render PDF via pdfkit → attach to Nodemailer mail
- #21: Admin clicks "Confirm" on Consultation → meeting link generated (Google Meet API or static URL) → consultation row updated → email sent with meeting link
- #22: When ServiceOrder transitions to "in-progress", a ClientProject row is auto-created with default milestones; member dashboard renders it
- #23: Same as #8 plus immediate redirect-to-download path on CheckoutSuccess
- #20: Admin "Start" button transitions ServiceOrder status `confirmed → in_progress` and creates ClientProject

**Effort.** Large — these are the highest-leverage backend flows on the platform.

---

## § 10 · Track J · Mobile responsiveness audit (P1)

| Finding | Surface |
|---|---|
| #24.1 | Hamburger icon flaky — sometimes invisible, sometimes stuck open |
| #24.2 | Home hero badges break layout on mobile |
| #24.3 | Product detail page loses horizontal padding on some mobile devices |
| #24.4 | Checkout pages not responsive |
| #24.5 | Search overlay needs mobile redesign + close button on both mobile and desktop |
| #24.6 | Full-platform mobile responsiveness sweep |

**Root cause hypothesis.** Multiple causes likely:
- Hamburger uses state-locked `<MobileNav>` that doesn't reset on route change → "stuck"
- Hero badges use `flex-row` without `flex-wrap` + responsive text sizes
- Product detail has overflow-x somewhere causing horizontal scroll bug
- Checkout grid uses `grid-cols-2` without `lg:` prefix
- Search overlay binds Escape but lacks visible close button (a11y + UX failure)

**Acceptance.** Every page passes Lighthouse mobile audit and renders cleanly at 360×640 (small phone), 414×896 (large phone), 768×1024 (tablet portrait), 1280+ (desktop). Hamburger never gets stuck. Search has visible × close button.

**Effort.** Large — full sweep of layouts. Should be done as its own focused session.

---

## § 11 · Execution order (recommended)

1. **Quick Wins · ~3 hrs · This session:** #3 + #11 + #15 + #19 + #9 + #18 + #13 (content from existing seed)
2. **Auth + Image fixes · ~3 hrs · Next session:** Track A + Track C
3. **Routing fixes · ~1 hr · Next session:** Track B
4. **Download/payment downstream · ~6 hrs · 1 session:** Track D + Track I (#8 + #20 + #21 + #22 + #23)
5. **Currency formatter sweep · ~2 hrs · 1 session:** Track G #10
6. **Product detail polish · ~1.5 hr · 1 session:** Track E #1, #3 (verify), #14 PDF debug
7. **Pricing redesign · scope TBD:** Track H #16, #17 — needs design pass
8. **Mobile sweep · ~6 hrs · dedicated session:** Track J

Total: ~22 hours across 5–6 sessions.

---

## § 12 · Out of scope for QA-fix work (raise separately)

- Pricing tier redesign (#16, #17) — needs design + pricing-strategy decision before code
- Full mobile responsiveness sweep (#24.6) — best done with Chrome DevTools device-emulation walkthrough, not blind editing

---

*Generated 2026-05-09 · QA fix plan*
