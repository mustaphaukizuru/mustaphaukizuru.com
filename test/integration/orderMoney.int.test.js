/**
 * Integration · the money path end to end over HTTP:
 *
 *   POST /orders (signed-in) → POST /paypal/capture (mocked gateway result)
 *   → order paid + UserDownload entitlement
 *   → admin POST /admin/orders/:id/refund → refunded + entitlements revoked
 *   → replay a Mercado Pago "refunded" webhook with a valid HMAC → order
 *     stays refunded, nothing is double-processed.
 *
 * Plus the coupon race: two concurrent orders on a usageLimit:1 coupon.
 */
const crypto  = require("crypto")
const request = require("supertest")
const { buildApp } = require("../helpers/appFactory")

let ctx
beforeAll(() => { ctx = buildApp() })

/** Poll the fake until `pred()` is true (fire-and-forget side effects). */
async function eventually(pred, { tries = 50 } = {}) {
  for (let i = 0; i < tries; i += 1) {
    if (pred()) return true
    await new Promise((r) => setImmediate(r))
  }
  return pred()
}

function mpSignature({ dataId, requestId, secret, ts = Date.now() }) {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`
  const v1 = crypto.createHmac("sha256", secret).update(manifest).digest("hex")
  return `ts=${ts},v1=${v1}`
}

function mpPaymentFetch(payment) {
  return async (url) => {
    if (String(url).includes("/v1/payments/")) return { ok: true, status: 200, json: async () => payment, text: async () => JSON.stringify(payment) }
    return { ok: false, status: 404, json: async () => ({}), text: async () => "not found" }
  }
}

describe("order → paid → refund → webhook replay", () => {
  let buyer, admin, product, orderId, captureId

  beforeAll(() => {
    buyer   = ctx.seedUser({ fullName: "Buyer Person", email: "buyer@example.com", passwordHash: "$2a$10$x" })
    admin   = ctx.seedUser({ fullName: "Admin", email: "admin@example.com", role: "admin", passwordHash: "$2a$10$x" })
    product = ctx.prisma.seed("product", { title: "Starter Kit", slug: "starter-kit", price: 250, isActive: true })
    ctx.prisma.seed("productFile", { productId: product.id, fileName: "kit.zip", filePath: "/x/kit.zip", isPrimary: true, version: "1.0", fileSize: 1024 })
  })

  test("signed-in buyer creates an order (pending, priced server-side)", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${ctx.signToken(buyer.id)}`)
      .send({ customerName: "ignored-name", customerEmail: "buyer@example.com", items: [{ productId: product.id, quantity: 2, price: 1 }] })

    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({ status: "pending", totalAmount: 500, subtotalAmount: 500, userId: buyer.id, isNewUser: false })
    expect(res.body.data.items).toHaveLength(1)
    expect(res.body.data.items[0]).toMatchObject({ unitPrice: 250, quantity: 2, lineTotal: 500 })
    orderId = res.body.data.id
    expect(ctx.mocks.emailService.sendTemplateEmail).toHaveBeenCalledWith(expect.objectContaining({ templateKey: "order.placed" }))
  })

  test("PayPal create-order is refused for a different member", async () => {
    const stranger = ctx.seedUser()
    const res = await request(ctx.app)
      .post(`/api/v1/paypal/create-order/${orderId}`)
      .set("Authorization", `Bearer ${ctx.signToken(stranger.id)}`)
    expect(res.status).toBe(403)
  })

  test("PayPal capture with an amount mismatch is rejected (422) and the order stays pending", async () => {
    ctx.mocks.paypalService.capturePaypalOrder.mockResolvedValueOnce({
      id: "PP-BAD", status: "COMPLETED",
      purchase_units: [{ reference_id: orderId, payments: { captures: [{ id: "CAP-BAD", amount: { value: "1.00", currency_code: "MXN" } }] } }],
    })
    const res = await request(ctx.app)
      .post("/api/v1/paypal/capture/PP-BAD")
      .set("Authorization", `Bearer ${ctx.signToken(buyer.id)}`)
    expect(res.status).toBe(422)
    expect(res.body.code).toBe("AMOUNT_MISMATCH")
    expect(ctx.prisma.rows("order").find((o) => o.id === orderId).status).toBe("pending")
    expect(ctx.prisma.rows("payment")).toHaveLength(0)
  })

  test("PayPal capture marks the order paid and grants the download entitlement", async () => {
    captureId = "CAP-0001"
    ctx.mocks.paypalService.capturePaypalOrder.mockResolvedValueOnce({
      id: `PP-${orderId}`, status: "COMPLETED",
      purchase_units: [{ reference_id: orderId, payments: { captures: [{ id: captureId, amount: { value: "500.00", currency_code: "MXN" } }] } }],
    })
    const res = await request(ctx.app)
      .post(`/api/v1/paypal/capture/PP-${orderId}`)
      .set("Authorization", `Bearer ${ctx.signToken(buyer.id)}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ orderId, captureId, status: "COMPLETED" })

    const order = ctx.prisma.rows("order").find((o) => o.id === orderId)
    expect(order.status).toBe("paid")
    expect(order.paidAt).toBeInstanceOf(Date)

    const payment = ctx.prisma.rows("payment").find((p) => p.orderId === orderId)
    expect(payment).toMatchObject({ paymentGateway: "paypal", gatewayTransactionId: captureId, paymentStatus: "paid", amount: 500, userId: buyer.id })

    // fulfilment runs fire-and-forget after the response
    expect(await eventually(() => ctx.prisma.rows("userDownload").some((d) => d.orderId === orderId))).toBe(true)
    const entitlement = ctx.prisma.rows("userDownload").find((d) => d.orderId === orderId)
    expect(entitlement).toMatchObject({ userId: buyer.id, productId: product.id, downloadAccessStatus: "active" })
    expect(ctx.mocks.invoiceService.ensureInvoice).toHaveBeenCalledWith(orderId)
    expect(await eventually(() => ctx.mocks.emailService.sendTemplateEmail.mock.calls.some(([a]) => a.templateKey === "order.confirmed"))).toBe(true)
  })

  test("replaying the same PayPal capture is idempotent — no second payment row, no second entitlement", async () => {
    ctx.mocks.paypalService.capturePaypalOrder.mockResolvedValueOnce({
      id: `PP-${orderId}`, status: "COMPLETED", _idempotent: true,
      purchase_units: [{ reference_id: orderId, payments: { captures: [{ id: captureId, amount: { value: "500.00", currency_code: "MXN" } }] } }],
    })
    const res = await request(ctx.app)
      .post(`/api/v1/paypal/capture/PP-${orderId}`)
      .set("Authorization", `Bearer ${ctx.signToken(buyer.id)}`)
    expect(res.status).toBe(200)
    expect(res.body.data.idempotent).toBe(true)
    await new Promise((r) => setImmediate(r))
    expect(ctx.prisma.rows("payment").filter((p) => p.orderId === orderId)).toHaveLength(1)
    expect(ctx.prisma.rows("userDownload").filter((d) => d.orderId === orderId)).toHaveLength(1)
  })

  test("the buyer can read the enriched order with its download list", async () => {
    const res = await request(ctx.app)
      .get(`/api/v1/orders/${orderId}`)
      .set("Authorization", `Bearer ${ctx.signToken(buyer.id)}`)
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe("paid")
    expect(res.body.data.payment).toMatchObject({ method: "paypal", status: "paid", transactionId: captureId })
    expect(res.body.data.downloads).toHaveLength(1)
    expect(res.body.data.downloads[0]).toMatchObject({ fileName: "kit.zip", entitlementStatus: "active" })
  })

  test("a non-admin cannot issue a refund", async () => {
    const res = await request(ctx.app)
      .post(`/api/v1/admin/orders/${orderId}/refund`)
      .set("Authorization", `Bearer ${ctx.signToken(buyer.id)}`)
      .send({})
    expect(res.status).toBe(403)
  })

  test("partial refund payloads are rejected with 400 INVALID_AMOUNT", async () => {
    const res = await request(ctx.app)
      .post(`/api/v1/admin/orders/${orderId}/refund`)
      .set("Authorization", `Bearer ${ctx.signToken(admin.id)}`)
      .send({ amount: 100 })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe("INVALID_AMOUNT")
    expect(ctx.prisma.rows("refund")).toHaveLength(0)
  })

  test("admin full refund → order refunded, payment refunded, entitlement revoked, audit row written", async () => {
    const res = await request(ctx.app)
      .post(`/api/v1/admin/orders/${orderId}/refund`)
      .set("Authorization", `Bearer ${ctx.signToken(admin.id)}`)
      .send({ reason: "Customer request" })

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ orderId, amount: 500, refundStatus: "succeeded", isFull: true, provider: "paypal", revokedDownloads: 1, providerRefundId: "PP-REFUND-1" })
    expect(ctx.mocks.paypalService.refundPaypalCapture).toHaveBeenCalledWith(captureId, expect.objectContaining({ amount: 500, currency: "MXN", note: "Customer request" }))

    expect(ctx.prisma.rows("order").find((o) => o.id === orderId).status).toBe("refunded")
    expect(ctx.prisma.rows("payment").find((p) => p.orderId === orderId).paymentStatus).toBe("refunded")
    expect(ctx.prisma.rows("userDownload").find((d) => d.orderId === orderId).downloadAccessStatus).toBe("revoked")
    expect(ctx.prisma.rows("refund")).toHaveLength(1)
    expect(ctx.prisma.rows("adminAuditLog")).toEqual([expect.objectContaining({ adminUserId: admin.id, action: "order.refund.full", targetId: orderId })])
    expect(await eventually(() => ctx.mocks.mailer.sendOrderRefundedEmail.mock.calls.length > 0)).toBe(true)
  })

  test("a second refund is refused with 409 INVALID_STATE", async () => {
    const res = await request(ctx.app)
      .post(`/api/v1/admin/orders/${orderId}/refund`)
      .set("Authorization", `Bearer ${ctx.signToken(admin.id)}`)
      .send({})
    expect(res.status).toBe(409)
    expect(res.body.code).toBe("INVALID_STATE")
    expect(ctx.prisma.rows("refund")).toHaveLength(1)
  })

  test("Mercado Pago webhook with a bad signature → 401 and nothing changes", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/mercadopago/webhook")
      .set("x-signature", "ts=1,v1=deadbeef")
      .set("x-request-id", "req-bad-sig")
      .send({ type: "payment", action: "payment.updated", data: { id: "MP-PAY-1" } })
    expect(res.status).toBe(401)
    expect(ctx.mocks.fetch).not.toHaveBeenCalled()
    expect(ctx.prisma.rows("paymentWebhook").find((w) => w.gatewayEventId === "req-bad-sig").processed).toBe(false)
  })

  test("replayed Mercado Pago 'refunded' webhook (valid HMAC) leaves the order refunded", async () => {
    ctx.mocks.fetch.mockImplementation(mpPaymentFetch({
      id: "MP-PAY-1", status: "refunded", external_reference: orderId, transaction_amount: 500, currency_id: "MXN",
    }))
    const requestId = "req-refund-replay-1"
    const headers = { "x-signature": mpSignature({ dataId: "MP-PAY-1", requestId, secret: ctx.TEST_MP_WEBHOOK_SECRET }), "x-request-id": requestId }

    const res = await request(ctx.app)
      .post("/api/v1/mercadopago/webhook")
      .set(headers)
      .send({ type: "payment", action: "payment.updated", data: { id: "MP-PAY-1" } })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ received: true })
    expect(ctx.mocks.fetch).toHaveBeenCalledWith(expect.stringContaining("/v1/payments/MP-PAY-1"), expect.anything())
    expect(ctx.prisma.rows("order").find((o) => o.id === orderId).status).toBe("refunded")
    expect(ctx.prisma.rows("userDownload").find((d) => d.orderId === orderId).downloadAccessStatus).toBe("revoked")
    expect(ctx.prisma.rows("paymentWebhook").find((w) => w.gatewayEventId === requestId).processed).toBe(true)
    // the original PayPal payment is untouched
    expect(ctx.prisma.rows("payment").find((p) => p.gatewayTransactionId === captureId).paymentStatus).toBe("refunded")
    expect(ctx.prisma.rows("refund")).toHaveLength(1)

    // exact same delivery again → deduped on x-request-id
    const dup = await request(ctx.app).post("/api/v1/mercadopago/webhook").set(headers).send({ type: "payment", data: { id: "MP-PAY-1" } })
    expect(dup.status).toBe(200)
    expect(dup.body).toEqual({ received: true, duplicate: true })
    expect(ctx.prisma.rows("order").find((o) => o.id === orderId).status).toBe("refunded")
  })

  test("MP signature outside the 5-minute replay window is rejected", async () => {
    const requestId = "req-stale"
    const res = await request(ctx.app)
      .post("/api/v1/mercadopago/webhook")
      .set("x-signature", mpSignature({ dataId: "MP-PAY-1", requestId, secret: ctx.TEST_MP_WEBHOOK_SECRET, ts: Date.now() - 10 * 60 * 1000 }))
      .set("x-request-id", requestId)
      .send({ type: "payment", data: { id: "MP-PAY-1" } })
    expect(res.status).toBe(401)
  })

  // Regression guard: getOrderStatus used `prisma` without requiring it, so
  // every call was a ReferenceError → 500. The checkout success page polls
  // this after a Mercado Pago redirect, so buyers were stuck on "confirming
  // payment" until the poll timed out.
  test("GET /api/v1/orders/:id/status returns the public status", async () => {
    const res = await request(ctx.app).get(`/api/v1/orders/${orderId}/status`)
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ id: orderId, status: "refunded", hasAccount: true, canViewOrder: false })
  })
})

describe("coupon race", () => {
  test("two concurrent orders on a usageLimit:1 coupon → one 201, one 409 COUPON_RACE", async () => {
    const buyerA  = ctx.seedUser({ email: "race-a@example.com", passwordHash: "x" })
    const buyerB  = ctx.seedUser({ email: "race-b@example.com", passwordHash: "x" })
    const product = ctx.prisma.seed("product", { title: "Race Kit", slug: "race-kit", price: 100 })
    const coupon  = ctx.prisma.seed("coupon", { code: "ONCE", discountType: "fixed", discountValue: 10, usageLimit: 1, usedCount: 0 })

    // Barrier: hold both coupon reads until BOTH have been issued, so each
    // request sees usedCount=0 and the optimistic-lock updateMany decides.
    const couponModel = ctx.prisma._delegate("coupon")
    const realFindUnique = couponModel.findUnique
    let arrived = 0
    let release
    const gate = new Promise((r) => { release = r })
    const gated = {
      ...couponModel,
      async findUnique(args) {
        arrived += 1
        if (arrived >= 2) release()
        await gate
        return realFindUnique.call(couponModel, args)
      },
    }
    const originalDelegate = ctx.prisma._delegate.bind(ctx.prisma)
    ctx.prisma._delegate = (model) => (model === "coupon" ? gated : originalDelegate(model))

    const post = (user) => request(ctx.app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${ctx.signToken(user.id)}`)
      .send({ customerEmail: user.email, items: [{ productId: product.id, quantity: 1 }], couponCode: "once" })

    let a, b
    try {
      ;[a, b] = await Promise.all([post(buyerA), post(buyerB)])
    } finally {
      ctx.prisma._delegate = originalDelegate
    }

    const statuses = [a.status, b.status].sort()
    expect(statuses).toEqual([201, 409])
    const winner = a.status === 201 ? a : b
    const loser  = a.status === 201 ? b : a
    expect(winner.body.data).toMatchObject({ discountAmount: 10, totalAmount: 90, couponId: coupon.id })
    expect(loser.body.code).toBe("COUPON_RACE")

    const stored = ctx.prisma.rows("coupon").find((c) => c.id === coupon.id)
    expect(stored.usedCount).toBe(1)
    expect(ctx.prisma.rows("couponUsage").filter((u) => u.couponId === coupon.id)).toHaveLength(1)
  })

  test("once exhausted, the coupon is rejected up-front with 400 COUPON_INVALID", async () => {
    const buyer   = ctx.seedUser({ email: "race-c@example.com", passwordHash: "x" })
    const product = ctx.prisma.seed("product", { title: "Race Kit 2", slug: "race-kit-2", price: 100 })
    const res = await request(ctx.app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${ctx.signToken(buyer.id)}`)
      .send({ customerEmail: buyer.email, items: [{ productId: product.id, quantity: 1 }], couponCode: "ONCE" })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe("COUPON_INVALID")
    expect(res.body.message).toMatch(/usage limit/i)
  })
})
