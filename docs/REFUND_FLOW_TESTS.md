# Refund Flow — Sandbox Test Plan (M15)

End-to-end test recipes for the Option A refund implementation. Run these
against the **sandbox / test-mode** credentials of PayPal and MercadoPago
before pointing the flow at production.

> ⚠ **Never** run these scripts against live merchant accounts. Real money
> moves and real customers are notified.

---

## 1 · Prerequisites

### Environment

```bash
# .env (sandbox values only)
NODE_ENV=development
DATABASE_URL=mysql://...        # local or Hostinger dev DB
JWT_SECRET=<dev-secret>

# PayPal sandbox
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
PAYPAL_CLIENT_ID=<sandbox-client-id>
PAYPAL_CLIENT_SECRET=<sandbox-secret>
PAYPAL_WEBHOOK_ID=<sandbox-webhook-id>     # leave unset to skip verification

# MercadoPago test mode
MP_ACCESS_TOKEN=TEST-<test-access-token>
MP_WEBHOOK_SECRET=<test-webhook-secret>    # leave unset to skip verification

# Frontend
FRONTEND_URL=http://localhost:5173
API_URL=http://localhost:5000

# SMTP — point at Mailtrap or similar so refund emails don't reach real inboxes
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=<mailtrap-user>
SMTP_PASS=<mailtrap-pass>
EMAIL_FROM="Mustapha Ukizuru <hello@mustaphaukizuru.com>"
```

### Sandbox accounts

- **PayPal** — create a sandbox business + sandbox personal buyer at
  https://developer.paypal.com → Apps & Credentials → Sandbox Accounts.
- **MercadoPago** — use a TEST account from
  https://www.mercadopago.com.mx/developers/panel/test-users with a test
  payer card (e.g. `5031 7557 3453 0604`, CVV `123`, exp `11/30`,
  name `APRO` to auto-approve).

### Helper variables

```bash
export API="http://localhost:5000/api/v1"
export ADMIN_TOKEN="<JWT for an admin user — copy from /api/v1/auth/login>"
export USER_TOKEN="<JWT for the buyer user>"
export ORDER_ID="<order id from a paid sandbox order>"
```

---

## 2 · Test 1 · PayPal full refund (happy path)

**Setup**

1. Sign in as a regular user, add a digital product to cart, check out via
   PayPal sandbox. Pay with a sandbox personal buyer.
2. Confirm order transitions to `paid` and a `UserDownload` row is created.

**Eligibility check**

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API/admin/orders/$ORDER_ID/refund-eligibility" | jq
```

Expect:
```json
{
  "success": true,
  "data": {
    "eligible": true,
    "withinWindow": true,
    "alreadyRefunded": 0,
    "refundableAmount": <total>,
    "reason": null,
    "items": [{ "eligible": true, "downloadCount": 0, "reason": null }]
  }
}
```

**Issue full refund**

```bash
curl -s -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Sandbox full-refund test"}' \
  "$API/admin/orders/$ORDER_ID/refund" | jq
```

Expect `success: true`, `data.refundStatus: "succeeded"`, `data.isFull: true`,
`data.provider: "paypal"`, `data.revokedDownloads >= 1`.

**Verify side effects**

```sql
-- Order flipped to refunded
SELECT id, status FROM Order WHERE id = '<ORDER_ID>';

-- Refund row exists
SELECT id, amount, refundStatus, processedAt FROM Refund WHERE orderId = '<ORDER_ID>';

-- Payment status flipped
SELECT id, paymentStatus FROM Payment WHERE orderId = '<ORDER_ID>';

-- UserDownload revoked
SELECT id, downloadAccessStatus FROM UserDownload WHERE orderId = '<ORDER_ID>';

-- AdminAuditLog row written
SELECT action, afterJson FROM AdminAuditLog
  WHERE targetType = 'Order' AND targetId = '<ORDER_ID>'
  ORDER BY createdAt DESC LIMIT 1;
```

Also check Mailtrap for the "Refund processed" email and the in-app
notification under `/dashboard` for the buyer.

**Verify access is actually revoked**

As the buyer, attempt a download:

```bash
curl -s -H "Authorization: Bearer $USER_TOKEN" \
  "$API/downloads/<productId>" -o /tmp/test.pdf -w "%{http_code}\n"
```

Expect HTTP 403 (or whatever your `downloadController` returns when access
is revoked — confirm against current implementation).

---

## 3 · Test 2 · MercadoPago full refund

Identical to Test 1 but check out via MercadoPago Checkout Pro. Use the
test card with payer name `APRO` for auto-approval.

The only response shape difference: `data.provider: "mercadopago"`.

---

## 4 · Test 3 · Partial refund

**Setup**

Create an order with at least 2 product items (e.g. two different digital
products in the same checkout).

**Issue partial refund of one item**

```bash
# Pull the orderItemIds first
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API/admin/orders/$ORDER_ID" | jq '.data.items[] | {id, title, lineTotal}'

export ITEM_ID="<orderItemId of the item to refund>"
export PARTIAL_AMOUNT="<lineTotal of that item>"

curl -s -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
        \"amount\": $PARTIAL_AMOUNT,
        \"orderItemIds\": [\"$ITEM_ID\"],
        \"reason\": \"Partial — defective second file only\"
      }" \
  "$API/admin/orders/$ORDER_ID/refund" | jq
```

Expect `data.isFull: false`, `data.revokedDownloads === 1` (only the targeted
item's UserDownload is revoked).

**Verify**

```sql
-- Order STAYS paid (partial refund)
SELECT id, status FROM Order WHERE id = '<ORDER_ID>';

-- Refund row records the partial amount
SELECT amount, reason, refundStatus FROM Refund WHERE orderId = '<ORDER_ID>';

-- Only the targeted UserDownload is revoked; the other stays active
SELECT orderItemId, downloadAccessStatus FROM UserDownload WHERE orderId = '<ORDER_ID>';
```

**Try to over-refund**

```bash
# Attempt a second refund for more than the remaining balance
curl -s -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"amount\": 99999}" \
  "$API/admin/orders/$ORDER_ID/refund" | jq
```

Expect HTTP 400, `code: "INVALID_AMOUNT"`,
message: `"Refund amount 99999 exceeds refundable balance ..."`.

---

## 5 · Test 4 · Option A enforcement (downloaded item blocked)

**Setup**

1. Place a new paid order.
2. As the buyer, hit the download endpoint at least once. Confirm
   `UserDownload.downloadCount > 0` and `lastDownloadedAt` is set.

**Eligibility check**

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API/admin/orders/$ORDER_ID/refund-eligibility" | jq '.data.items'
```

Expect: each downloaded item shows `eligible: false`,
`reason: "Already downloaded (1 time)"` (or similar).

**Issue refund without override**

```bash
curl -s -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Should be blocked"}' \
  "$API/admin/orders/$ORDER_ID/refund" | jq
```

Expect HTTP 409, `code: "INELIGIBLE_DOWNLOADED"`, `details.blockedItems`
listing the downloaded items. **No DB writes, no provider call, no money
moves.**

**Issue refund WITH override**

```bash
curl -s -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Customer service override — duplicate purchase","force":true}' \
  "$API/admin/orders/$ORDER_ID/refund" | jq
```

Expect `success: true`. **Then verify the audit row captured the override:**

```sql
SELECT afterJson FROM AdminAuditLog
  WHERE targetType = 'Order' AND targetId = '<ORDER_ID>'
  ORDER BY createdAt DESC LIMIT 1;
```

The JSON should contain `"force": true` and `"blockedItemsBypassed": [...]`
with the offending items. This is your chargeback evidence.

---

## 6 · Test 5 · Member visibility

**Member fetches their own refund history**

```bash
curl -s -H "Authorization: Bearer $USER_TOKEN" \
  "$API/member/orders/$ORDER_ID/refunds" | jq
```

Expect the array of Refund records (without admin-only fields like provider
transaction id beyond what the member needs).

**Member tries to access another user's order — should be forbidden**

```bash
curl -s -H "Authorization: Bearer $USER_TOKEN" \
  "$API/member/orders/<OTHER_USER_ORDER_ID>/refunds" -w "\nHTTP %{http_code}\n"
```

Expect HTTP 403, `code: "FORBIDDEN"`.

---

## 7 · Test 6 · Authentication & rate limiting

**Unauthenticated request**

```bash
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"reason":"unauth"}' \
  "$API/admin/orders/$ORDER_ID/refund" -w "\nHTTP %{http_code}\n"
```

Expect HTTP 401.

**Non-admin authenticated request**

```bash
curl -s -X POST \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"forbidden"}' \
  "$API/admin/orders/$ORDER_ID/refund" -w "\nHTTP %{http_code}\n"
```

Expect HTTP 403, `code: "FORBIDDEN"`.

**Rate limit (10/hour/admin)** — fire 11 refund attempts in a tight loop
against any blocked endpoint:

```bash
for i in $(seq 1 11); do
  curl -s -X POST \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"amount":-1}' \
    "$API/admin/orders/$ORDER_ID/refund" -w "%{http_code}\n" -o /dev/null
done
```

> NOTE: The dev environment skips rate-limiting from `127.0.0.1` (see
> `rateLimiter.js` — `skip: (req) => IS_DEV && isLocalhost(req)`). Test
> against a non-local IP or set `NODE_ENV=production` for this check.

The 11th call should return HTTP 429.

---

## 8 · Test 7 · Frontend smoke

1. Sign in as admin → `/admin/orders/<id>` for a paid order.
2. Click **Issue refund**. Modal should:
   - Show refundable balance vs already-refunded breakdown.
   - Disable submit if no items are selected in partial mode.
   - Show the amber **"X item(s) already downloaded"** warning when
     applicable, plus the override checkbox.
3. Submit a full refund → toast confirms, history card shows the new entry,
   order header status flips to `refunded`.
4. As the buyer, refresh `/dashboard/orders` — the row should display the
   rose **Refunded** badge with tooltip.
5. Public visitors can read the new policy at `/refund` (Option A wording,
   PROFECO Spanish summary).

---

## 9 · Cleanup checklist before production

- [ ] All sandbox secrets removed from `.env.production`
- [ ] Mailtrap SMTP swapped for the real Hostinger SMTP
- [ ] Live PayPal `PAYPAL_BASE_URL` set to `https://api-m.paypal.com`
- [ ] Live MercadoPago `MP_ACCESS_TOKEN` (no `TEST-` prefix)
- [ ] Webhooks re-pointed at production URLs in PayPal + MP dashboards
- [ ] At least one admin account confirmed with `role = 'admin'` in DB
- [ ] Refund policy page reviewed by counsel (PROFECO compliance)
- [ ] Brief support team on the "force override" semantics + audit trail
- [ ] Dashboard alert configured on `AdminAuditLog WHERE action LIKE 'order.refund%'`
      to catch unusual volume

---

## 10 · Known limitations (track for follow-up)

1. **Provider idempotency key uses `Date.now()`** — two refund requests
   issued within the same millisecond would each get a unique key and
   could theoretically both succeed at the gateway. Mitigated today by the
   pre-flight aggregate check + the rate limiter, but a clean fix is to
   create the `Refund` row in `processing` state first and reuse its `id`
   as the idempotency key. Schema-only change (no migration needed —
   `refundStatus` is a free-form string).
2. **Legacy `/api/paypal/refund` and `/api/mercadopago/refund` endpoints
   bypass the Option A gate.** They remain mounted for back-compat and
   are admin-only. Plan to either deprecate them or proxy through the new
   `processOrderRefund()` orchestrator after the front-end is fully
   migrated.
3. **No automated tests yet.** This document is the manual runbook. Adding
   Jest + Supertest coverage for `refundService.processOrderRefund()` is
   the next logical step (mock the provider HTTP calls, drive the rest
   against a SQLite test DB).
