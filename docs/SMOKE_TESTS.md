# Smoke-Test Runbook · Admin CRUD + Payment Hardening

End-to-end checks for everything shipped in the last two batches:
- **Option B** — wired CRUD on AdminUsersPage / AdminCategoriesPage / AdminPagesPage / AdminEmailTemplatesPage
- **Payment hardening** — schema-level idempotency, refund persistence

Run these against a local dev server **before** deploying to Hostinger.

---

## 0 · Prerequisites

```bash
# In one shell — run the API
npm run dev

# In a second shell — build the SPA (or run Vite if you prefer)
cd web && npm run dev

# Apply the schema changes from this batch
npx prisma db push
npx prisma generate

# Restart the API after `db push`
```

Set the variables you'll reuse:

```bash
export API=http://localhost:5000
export TOKEN=<paste your admin JWT from localStorage.auth-token>
export AUTH="-H 'Authorization: Bearer $TOKEN'"
```

> **Tip** — open the browser console at `/admin/dashboard`, run `localStorage.getItem("auth-token")`, paste the value into `TOKEN`.

---

## 1 · Schema migration sanity check

After `db push`, confirm the new constraints landed:

```bash
mysql -u<user> -p<pw> <db> -e "
  SHOW INDEX FROM Payment        WHERE Key_name = 'payment_gateway_tx_uq';
  SHOW INDEX FROM PaymentWebhook WHERE Key_name = 'webhook_event_uq';
  SHOW COLUMNS FROM PaymentWebhook LIKE 'gatewayEventId';
"
```

Expect: 2 rows for `payment_gateway_tx_uq` (composite), 2 rows for `webhook_event_uq`, and one column `gatewayEventId varchar(191) YES`.

---

## 2 · Users — suspend / activate / role toggle

Find a non-admin test user:

```bash
curl -s "$API/api/v1/admin/users" -H "Authorization: Bearer $TOKEN" | jq '.data.users[] | select(.role=="member") | {id,email,status,role}' | head -20
export USER_ID=<paste id from above>
```

### 2a · Promote → demote

```bash
# Promote
curl -s -X PATCH "$API/api/v1/admin/users/$USER_ID/role" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"role":"admin"}' | jq

# Demote back
curl -s -X PATCH "$API/api/v1/admin/users/$USER_ID/role" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"role":"member"}' | jq
```

Expect `success: true` + `data.role` reflects the new role.

### 2b · Suspend → verify login is blocked → reactivate

```bash
# Suspend
curl -s -X PATCH "$API/api/v1/admin/users/$USER_ID/status" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"suspended"}' | jq

# That user's existing JWT should now be rejected
USER_TOKEN=<paste suspended user's token>
curl -s "$API/api/member/profile" -H "Authorization: Bearer $USER_TOKEN" | jq
# expect: { success: false, code: "AUTH_SUSPENDED", ... } with HTTP 403

# Reactivate
curl -s -X PATCH "$API/api/v1/admin/users/$USER_ID/status" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"active"}' | jq
```

### 2c · Self-action guard

Try to suspend your own admin account — expect HTTP 400 with `Self-action blocked` style message:

```bash
ME_ID=<your admin id>
curl -s -X PATCH "$API/api/v1/admin/users/$ME_ID/status" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"suspended"}' | jq
```

---

## 3 · Categories — full CRUD

```bash
# Create
CAT=$(curl -s -X POST "$API/api/v1/admin/categories" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Smoke-Test Category","description":"delete me","sortOrder":99}')
echo $CAT | jq
export CAT_ID=$(echo $CAT | jq -r '.data.id')

# Update
curl -s -X PATCH "$API/api/v1/admin/categories/$CAT_ID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"description":"updated by smoke test"}' | jq

# Verify in list
curl -s "$API/api/v1/admin/categories" -H "Authorization: Bearer $TOKEN" \
  | jq '.data[] | select(.id=="'"$CAT_ID"'")'

# Delete
curl -s -X DELETE "$API/api/v1/admin/categories/$CAT_ID" \
  -H "Authorization: Bearer $TOKEN" | jq

# Confirm gone
curl -s "$API/api/v1/admin/categories" -H "Authorization: Bearer $TOKEN" \
  | jq '.data[] | select(.id=="'"$CAT_ID"'")'
# expect: empty
```

### 3a · Duplicate-slug guard

```bash
# Create one
curl -s -X POST "$API/api/v1/admin/categories" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Dup Test","slug":"dup-test"}' | jq

# Create another with same slug — expect 400 VALIDATION_ERROR
curl -s -X POST "$API/api/v1/admin/categories" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Different Name","slug":"dup-test"}' | jq

# Cleanup
DUP_ID=$(curl -s "$API/api/v1/admin/categories" -H "Authorization: Bearer $TOKEN" \
  | jq -r '.data[] | select(.slug=="dup-test") | .id')
curl -s -X DELETE "$API/api/v1/admin/categories/$DUP_ID" -H "Authorization: Bearer $TOKEN" | jq
```

---

## 4 · Pages — CRUD with delete

```bash
# Create
PAGE=$(curl -s -X POST "$API/api/admin/pages" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Smoke Test Page","slug":"smoke-test","type":"content","content":"# Hello"}')
echo $PAGE | jq
export PAGE_ID=$(echo $PAGE | jq -r '.data.id')

# Publish
curl -s -X PATCH "$API/api/admin/pages/$PAGE_ID/publish" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"published"}' | jq

# Edit
curl -s -X PATCH "$API/api/admin/pages/$PAGE_ID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"content":"# Updated"}' | jq

# Delete
curl -s -X DELETE "$API/api/admin/pages/$PAGE_ID" -H "Authorization: Bearer $TOKEN" | jq
```

---

## 5 · Email templates — preview + test send

```bash
# List
curl -s "$API/api/admin/email-templates" -H "Authorization: Bearer $TOKEN" \
  | jq '.data[] | {id,key,isActive,subject}' | head -40
export TPL_ID=<pick a welcome template id>

# Send a test to yourself
curl -s -X POST "$API/api/admin/email-templates/$TPL_ID/test" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"to":"hello@mustaphaukizuru.com"}' | jq
# expect: success: true, message contains "Test email sent"
# verify: email actually arrives in your inbox
```

---

## 6 · Payment idempotency — duplicate webhook simulation

This validates the schema-level dedup we just added.

### 6a · Send the same MP webhook twice

```bash
# Build a fake MP IPN with a fixed x-request-id
REQ_ID="smoke-test-$(date +%s)"
curl -s -X POST "$API/api/mercadopago/webhook" \
  -H "Content-Type: application/json" \
  -H "x-request-id: $REQ_ID" \
  -H "x-signature: ts=0,v1=ignored-in-dev" \
  -d '{"action":"payment.updated","data":{"id":"99999999"}}' | jq

# Same headers, same body — second delivery
curl -s -X POST "$API/api/mercadopago/webhook" \
  -H "Content-Type: application/json" \
  -H "x-request-id: $REQ_ID" \
  -H "x-signature: ts=0,v1=ignored-in-dev" \
  -d '{"action":"payment.updated","data":{"id":"99999999"}}' | jq
# expect: { received: true, duplicate: true }

# Confirm only ONE row in PaymentWebhook
mysql -u<user> -p<pw> <db> -e "
  SELECT COUNT(*) FROM PaymentWebhook WHERE gatewayEventId = '$REQ_ID';
"
# expect: 1
```

### 6b · PayPal duplicate event

```bash
EVENT_ID="WH-SMOKE-$(date +%s)"
curl -s -X POST "$API/api/paypal/webhook" \
  -H "Content-Type: application/json" \
  -d '{"id":"'"$EVENT_ID"'","event_type":"PAYMENT.CAPTURE.COMPLETED","resource":{"id":"FAKE_CAPTURE_001","custom_id":"non-existent-order"}}' | jq

# Replay
curl -s -X POST "$API/api/paypal/webhook" \
  -H "Content-Type: application/json" \
  -d '{"id":"'"$EVENT_ID"'","event_type":"PAYMENT.CAPTURE.COMPLETED","resource":{"id":"FAKE_CAPTURE_001","custom_id":"non-existent-order"}}' | jq
# expect: { received: true, duplicate: true }
```

> **Note** — both will return `signature: failed` because we're not actually signing. That's fine; the audit row + dedup constraint still get exercised on the first call.

---

## 7 · Refund persistence (optional, requires a real test payment)

If you have a paid order in the dev DB, exercise the new refund flow:

```bash
PAYMENT_ID=<paste a real MP gateway txn id from Payment table>

curl -s -X POST "$API/api/mercadopago/refund" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"paymentId":"'"$PAYMENT_ID"'","amount":1.00,"reason":"smoke test partial"}' | jq

# Expect:
#   - Local Refund row inserted
#   - Payment.paymentStatus → "refunded"
#   - Order.status remains "paid" (partial refund)
mysql -u<user> -p<pw> <db> -e "
  SELECT r.id, r.amount, r.refundStatus, p.paymentStatus, o.status
  FROM Refund r
  JOIN Payment p ON p.id = r.paymentId
  JOIN \`Order\` o ON o.id = r.orderId
  WHERE p.gatewayTransactionId = '$PAYMENT_ID'
  ORDER BY r.createdAt DESC LIMIT 1;
"
```

For a full refund, omit `amount` — `Order.status` should flip to `refunded` too.

---

## 8 · UI sanity passes

Open in browser and click through each:

- `/admin/users` — Suspend → row pill turns rose, Activate → mint, Promote → violet, "You" badge on your own row
- `/admin/categories` — Add modal opens, Save creates a card, Edit pre-fills, Delete confirms with product-count copy
- `/admin/pages` — Publish toggle, Edit modal saves, Delete confirms with 404 warning
- `/admin/email-templates` — Edit modal opens, Preview shows iframe, Test sends actual email

For each: open the browser DevTools Console — you should see `[Users]`, `[Categories]`, `[Pages]` info logs in dev mode confirming what was loaded/saved.

---

## 9 · Pre-deploy checklist

- [ ] All steps above pass locally
- [ ] `npx prisma db push` against staging (or production maintenance window)
- [ ] `npx prisma generate` then restart Express server
- [ ] No errors in server logs during boot
- [ ] Smoke-test sections 1, 2, 3, 4 against live (skip 6/7 unless you have a sandbox payment)
- [ ] Tag the release: `git tag -a v0.X.Y -m "Option B + payment hardening"`
