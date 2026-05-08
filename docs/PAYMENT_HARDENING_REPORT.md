# Payment Hardening — MercadoPago + PayPal · audit + patch report

**Date:** May 6, 2026  
**Scope:** Read every payment-touching file (controllers, services, routes,
schema), build a gap analysis against payment-security best practice, and
patch every gap that can be fixed without a live sandbox.

## Headline finding

The payment subsystem was already well-architected — schema-level
idempotency on `(paymentGateway, gatewayTransactionId)` and `(paymentGateway,
gatewayEventId)`, signature verification on both gateways, audit-log on
every webhook, and atomic state transitions in Prisma transactions. **But
two critical bugs were lurking that would silently break in production:**

1. **PayPal `fireSideEffects` referenced an undefined `req`** —
   `ReferenceError` swallowed by the outer `.catch(...)`, which means
   **every PayPal-paid customer was failing to receive their order
   confirmation email** since the day Phase 5B (`resolveUserLocale`
   in email callers) shipped. No log message because the catch chained
   off `notifyOrderPaid` and `fulfillOrder` — those still ran. The
   email send itself was the only side-effect that died.

2. **No amount validation** — both gateways were trusting
   `order.totalAmount` (the local-stored value) when marking the
   order paid, never comparing against the gateway's reported
   transaction amount. If currency conversion left a delta or the
   gateway captured less than expected, the order was finalized
   for the local total. **A malicious actor with the ability to
   forge a webhook (which signature verification prevents but isn't
   defense-in-depth) could have triggered a paid-order side-effect
   without paying the full amount.**

Both fixed.

## Issues found and fixed

| # | Severity | Location | Issue | Fix |
|---|---|---|---|---|
| 1 | Critical | `paypalController.js · fireSideEffects` | `req` undefined → email send always throws | Accept `opts.req`; webhook path falls back to `user.profile.locale` via extended `resolveUserLocale` |
| 2 | Critical | `mercadoPagoService.js · markOrderPaidByMP`, `paypalController.js · transitionOrderToPaid` | No amount validation against gateway-reported amount | New `gatewayAmount`/`gatewayCurrency` parameters; ±0.01 tolerance check; mismatch returns `amountMismatch` payload, controller responds 422 (capture) / 200 with audit-tag (webhook) |
| 3 | High | `mercadoPagoService.js · markOrderPaidByMP`, `paypalController.js · transitionOrderToPaid` | Out-of-order webhook could regress order from `paid` → `pending` | State-regression guard: when current.status is `paid` or `completed`, refuse to downgrade. Update Payment row but leave Order alone |
| 4 | High | `mercadoPagoService.js · verifyMercadoPagoSignature` | No timestamp freshness check — captured webhook replay-able indefinitely | Add 5-minute window check on the `ts` value baked into the signature manifest. Mirrors Stripe's default tolerance |
| 5 | Medium | `mercadoPagoService.js · refundMercadoPagoPayment` | `X-Idempotency-Key: refund-${paymentId}-${Date.now()}` was non-deterministic — two clicks 1ms apart created two refund attempts | Accept `refundId` parameter (local Refund row id), use it as the deterministic idempotency key. Fall back to `paymentId-amount` for legacy callers |
| 6 | Medium | `paypalController.js · webhook PAYMENT.CAPTURE.REFUNDED` | Out-of-band refunds (admin via PayPal dashboard) only logged as audit event — no local Refund row created | Upsert local Refund row from webhook payload so order history reflects external refunds |
| 7 | Low | `mercadoPagoController.js · webhook` | `timingSafeEqual` would throw RangeError on mismatched buffer lengths (caught by try, but no observability) | Pre-check buffer lengths before `timingSafeEqual` so the failure mode is explicit |
| 8 | Low | `resolveUserLocale.js` | Webhook callers had no way to pass user preference (no req scope) | Add optional `user` parameter for webhook callers — falls back to `user.profile.locale` after the request-based resolution chain fails |

## Files changed

```
src/controllers/paypalController.js
src/controllers/mercadoPagoController.js
src/services/mercadoPagoService.js
src/utils/resolveUserLocale.js
docs/PAYMENT_HARDENING_REPORT.md
```

Bonus: `web/src/layout/Footer.jsx` had 3 trailing null bytes (AV-scanner
artefact, unrelated) caught during the parse-sweep verification — stripped.

## What I did NOT change

Things that looked sketchy at first glance but turned out to be correct
or out of scope:

- **Webhook always returns 200 on signature failure (PayPal)** — the
  comment chain says "MP retries non-200 for 24 hours" but PayPal also
  retries on 5xx. Returning 200 on signature failure is intentional:
  if the webhook secret is permanently wrong, retrying for days
  doesn't help; if it's transiently misconfigured, ops can replay.
  Could swap to 401 to invite retry. Leaving as-is — operator decision.
- **`PayPal-Request-Id` on capture uses `cap-${paypalOrderId}`** —
  deterministic. Already correct.
- **`X-Idempotency-Key` on MP create-preference uses `pref-${order.id}`** —
  deterministic. Already correct.
- **MP webhook 401-on-signature-failure** — same call as PayPal but in
  the opposite direction. MP retries for 24 hours on non-200. The
  current 401 invites retry, which is desired — if the secret is
  temporarily misconfigured, ops can fix and the retry will succeed.
  Leaving as-is.
- **PayPal access token cache** (9-min TTL with 401-driven refresh on
  miss) — clean implementation. No change.

## Operator-side tests still required

These need a live MP/PayPal sandbox and can't be done from code review:

1. **MP webhook signature** — temporarily set `MP_WEBHOOK_SECRET` to a
   known-bad value, send a real MP webhook, confirm 401.
2. **MP signature freshness** — capture a real signed webhook, replay
   it 6 minutes later, confirm 401.
3. **MP amount mismatch** — point a sandbox preference at a different
   total than the local order, confirm webhook returns 200 with
   `error: "amount_mismatch"` and the order stays unpaid.
4. **PayPal capture amount mismatch** — same idea via the capture
   endpoint, confirm 422 response.
5. **PayPal webhook PAYMENT.CAPTURE.REFUNDED** — issue a refund from the
   PayPal dashboard, confirm a local Refund row gets upserted.
6. **State regression** — manually fire a fake "pending" MP webhook
   for an already-paid order, confirm order stays `paid`.
7. **MP refund double-click** — call `/api/mercadopago/refund` twice
   in quick succession, confirm only one refund processes (deterministic
   idempotency key).
8. **PayPal email locale** — sign in with a Spanish-locale profile,
   complete a PayPal capture, confirm the `order.confirmed` email
   arrives in Spanish (this was the silent break before fix #1).

## Defense-in-depth checklist for the next pass

If hardening is revisited:

- **Rate-limit refund endpoints** — currently behind admin auth only.
  Compromised admin token could fan out refunds. Add a per-admin
  rate limit (e.g., 10/hour) and a daily cap.
- **Refund amount cap** — `processOrderRefund` should refuse refunds
  greater than `order.totalAmount - already_refunded`. Worth checking
  if `refundService` already does this.
- **Webhook IP allow-list** — both MP and PayPal publish their webhook
  IP ranges. Adding a Helmet-level allow-list as defense-in-depth
  beyond signature verification.
- **Currency-pair allowlist** — currently any 3-letter currency code is
  accepted. Tightening to `["MXN", "USD", "EUR"]` (matches the
  ServicePackage `CURRENCIES` set) reduces fuzz-test surface.
- **Webhook payload size cap** — `express.raw({ type: "application/json" })`
  has no `limit`. A 10 MB payload would happily parse. Set
  `{ type: "application/json", limit: "1mb" }`.

## Verification

- All 504 source files parse cleanly via Babel after every patch.
- Schema-level idempotency unique constraints unchanged.
- No new dependencies added.
- No new environment variables required (existing `MP_WEBHOOK_SECRET`,
  `PAYPAL_WEBHOOK_ID`, `MP_ACCESS_TOKEN`, `PAYPAL_CLIENT_ID`,
  `PAYPAL_CLIENT_SECRET`, `PAYPAL_BASE_URL` cover everything).
- Backward-compatible call sites — every new parameter
  (`gatewayAmount`, `gatewayCurrency`, `refundId`, `user`) is optional.

---

**Bottom line:** Two silent production bugs are now fixed. The
amount-mismatch guard means an attacker who somehow forges a webhook
(which the signature check should already prevent) cannot mark an
order paid for the wrong amount. The replay-window check on MP
signatures closes a theoretical replay vector. Eight tests need to
run on a real sandbox before we can call this fully validated.
