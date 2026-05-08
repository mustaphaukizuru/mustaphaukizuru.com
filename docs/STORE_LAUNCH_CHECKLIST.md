# Store Launch Readiness · audit + fixes + operator checklist

**Date:** May 6, 2026  
**Scope:** End-to-end audit of the cart → checkout → payment → order →
download flow, focused on what would break a real customer's first
purchase. Patches applied for everything code-fixable without a live
sandbox; operator-side smoke tests listed at the bottom.

## Headline finding

**Coupons were silently broken.** A customer entering a coupon in the
cart UI saw a discount applied to the on-screen total, but the actual
order created via `POST /api/orders` ignored the coupon entirely. The
order persisted at full price and the payment gateway charged full
price. This was true for every coupon ever issued — discount-on-screen,
charge-at-full.

Fixed.

## Issues found and fixed

| # | Severity | Location | Issue | Fix |
|---|---|---|---|---|
| 1 | **Critical (revenue)** | `orderService.createOrder` | Coupon never applied — frontend's `couponCode` ignored, order created at full price | Server-side `validateCoupon` re-run, `discountAmount` + `couponId` persisted, `CouponUsage` row created in single transaction with the order |
| 2 | **Critical (DoS)** | `orderRoutes.js · POST /` | Only the global 100/15min/IP limiter applied. Guest checkout could be weaponised — 100 fake accounts + 100 spam emails per IP per 15 min | Added `paymentRateLimiter` (10/hour/user, falls back to /IP for guests) |
| 3 | High | `CheckoutPage.jsx` | Did not forward `couponCode` to the backend even when the user applied one | Now reads `appliedCoupon.code` from cart state and passes it to `createOrder` |
| 4 | Medium | `orderController.createOrder` | Email format validation missing — accepted any non-empty string | RFC-5322 pragmatic regex check before user lookup |
| 5 | Medium | `orderService.createOrder` | No upper bound on `quantity` — `quantity: 999999` would produce an absurd `lineTotal` | `MAX_QUANTITY_PER_ITEM = 50` ceiling |
| 6 | Low | `downloadController` | `Content-Disposition` filename uses `encodeURIComponent` (not RFC 5987) — non-ASCII filenames render URL-encoded in older browsers | Documented; out of scope (works on all current browsers) |
| 7 | Low | `fulfillOrder` | Defensive guest-order branch is dead code now that `createOrder` always creates a User via `findOrCreateUserForCheckout` | Left as-is — defensive |

## Files changed

```
src/services/orderService.js        — server-side coupon validation,
                                      atomic CouponUsage transaction,
                                      MAX_QUANTITY_PER_ITEM bound
src/controllers/orderController.js  — email regex, COUPON_INVALID 400
                                      mapping, couponCode passthrough
src/routes/orderRoutes.js           — paymentRateLimiter on POST /
web/src/pages/CheckoutPage.jsx      — forward couponCode in createOrder
                                      payload
docs/STORE_LAUNCH_CHECKLIST.md      — this file
```

## What was already solid

The audit confirmed the rest of the checkout flow is well-built:

- **Schema-level idempotency** on `Payment(paymentGateway, gatewayTxId)`
  and `PaymentWebhook(paymentGateway, gatewayEventId)` prevents double-charges
  on webhook retries.
- **Path traversal protection** on `/api/downloads/:fileId` via
  `path.resolve(DOWNLOAD_DIR, …) && startsWith(DOWNLOAD_DIR)`.
- **Per-entitlement + per-file download caps** enforced via
  `UserDownload.downloadLimit` and `ProductFile.maxDownloadsPerUser`.
- **Download credit only consumed on successful flush** —
  `res.on("finish")` not `res.on("close")` — so dropped streams don't
  burn a customer's download count.
- **Soft-auth guest checkout** — `attachUserIfPresent` populates
  `req.user` if a token is present; otherwise `findOrCreateUserForCheckout`
  creates a passwordless User and emails a one-click claim link.
- **Webhook routes mounted before global limiter** —
  `/api/paypal/webhook` and `/api/mercadopago/webhook` exempt from the
  100/15min cap so payment retries never get rate-limited.
- **MercadoPago + PayPal hardening** from the prior phase covers
  amount-mismatch detection, signature freshness, deterministic refund
  idempotency keys, and the `req` ReferenceError that was silently
  killing PayPal order-confirmation emails.
- **Order numbers** generated with collision-retry up to 10 attempts
  via `createUniqueOrderNumber`.
- **JSON BigInt serialization** — `BigInt.prototype.toJSON` set in
  `app.js` so file-size fields don't crash response serialization.

## Operator-side smoke tests · run before public launch

These need a real Hostinger deployment + sandbox payment credentials:

### Cart → Order → Payment

1. **Coupon end-to-end** — apply a valid coupon code, complete a sandbox
   MercadoPago checkout, confirm:
   - The MP preference is created with the discounted amount.
   - The Order row has the correct `discountAmount`, `couponId`, `totalAmount`.
   - A `CouponUsage` row exists with the order id and discount amount.
   - The `Coupon.usedCount` increments by 1.
2. **Coupon limit enforcement** — set a coupon with `maxUsesPerUser: 1`,
   redeem it, try to redeem again with the same email/account → backend
   should respond `400 COUPON_INVALID` "You have already used this coupon".
3. **Coupon expiry** — set `expiresAt` to a past date, attempt checkout →
   400 with "This coupon has expired".
4. **Rate limit** — POST 11 orders within an hour from the same IP (no auth) →
   the 11th should return 429.
5. **Email validation** — POST with `customerEmail: "not-an-email"` → 400.
6. **Quantity bound** — POST with `quantity: 100` → 400 "Quantity for X
   exceeds the maximum of 50".
7. **Guest checkout end-to-end** — purchase as guest with a fresh email,
   verify:
   - Order row created with userId set (auto-created User).
   - Claim email arrives with the password-set link.
   - Clicking the link sets the password and redirects to dashboard.
   - The order shows up under `/dashboard/orders`.

### Payment → Fulfillment

8. **Fulfillment runs once** — confirm `UserDownload` rows are created,
   invoice PDF is generated, `ActivityLog` row appears. Trigger the
   webhook again manually — confirm no duplicate UserDownload rows
   (P2002 swallow).
9. **Order confirmation email locale** — sign in with a Spanish-locale
   profile, complete a PayPal capture, confirm the email arrives in
   Spanish (this was previously silently broken — see payment hardening
   report).

### Download Delivery

10. **Entitlement gate** — fetch `/api/downloads/:fileId` for a product
    you didn't purchase → 403.
11. **Path traversal** — request a fileId whose `filePath` contains
    `../../etc/passwd` (manually craft a ProductFile row in admin) →
    400 INVALID_PATH.
12. **Download cap** — set `UserDownload.downloadLimit: 2`, download
    twice successfully, third attempt → 429 LIMIT_EXCEEDED.
13. **Mid-stream disconnect** — start download, kill the connection
    before flush. Confirm `UserDownload.downloadCount` did NOT
    increment (the `res.on("finish")` guard).
14. **Mobile Safari checkout** — full purchase flow on iOS Safari with
    real PayPal sandbox to validate the PayPal Buttons SDK renders
    cleanly in WebKit.

### Refund Path

15. **Admin refund button** — issue a refund from the admin order detail
    page. Confirm:
    - Refund row created.
    - Order status updates to `refunded`.
    - Customer receives the refund-confirmation email.
    - `UserDownload` rows for that order are deactivated.
16. **PayPal dashboard refund** — issue a refund directly from the
    PayPal sandbox dashboard. Confirm the `PAYMENT.CAPTURE.REFUNDED`
    webhook fires and our local Refund row is upserted (this fix
    landed in the payment hardening phase).

## Performance smoke checks

17. **Bundle size** — `npm run build` and check the visualizer report.
    Hero bundle should be under 200 KB compressed.
18. **Lighthouse** — run on the deployed `/`, `/store`, `/services`,
    `/about`. Target: Performance ≥ 85, Accessibility ≥ 95, SEO ≥ 95.
19. **Cold-start TTFB** — first request after Hostinger inactivity
    period; should be under 1.5s.

## Backward compatibility

- Every new optional parameter (`couponCode`) is backward-compatible.
- Customers who don't apply a coupon hit identical code paths as before.
- Existing orders + entitlements unchanged.
- No DB migration needed (`Order.couponId`, `Order.discountAmount`,
  `CouponUsage` were already in the schema).

## Verification

- 504 / 504 source files parse cleanly via Babel.
- All four touched files validated independently before the sweep.
- Path-traversal, entitlement, rate-limit, and idempotency layers
  unchanged from before.

---

**Bottom line:** The store is now actually launchable. The single most
important fix was server-side coupon validation — the previous behaviour
would have generated angry support tickets from every coupon-using
customer the moment the store went public. The rate limit closes a
spam-/DoS-vector that would have lit up the email reputation. Sixteen
operator-side smoke tests are listed for you to run on a real
deployment before flipping the public launch switch.
