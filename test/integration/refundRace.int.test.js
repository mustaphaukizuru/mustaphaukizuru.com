/**
 * Integration · T0-2. Two refund requests for the same paid order arriving
 * together — a double-click, or two admins on the same order page — must
 * reach the gateway exactly once.
 *
 * Before this, every guard in processOrderRefund was a read, so both
 * requests saw `paid`, both called the provider (each with a Date.now()
 * idempotency key), and both wrote a Refund row. Now a `processing` Refund
 * row is claimed before the provider call, keyed on refund_gateway_uq with a
 * deterministic per-payment key; the loser's insert fails with P2002 and is
 * answered 409 CONFLICT without touching the gateway.
 *
 * The fake Prisma yields to the event loop on every operation, so the two
 * requests genuinely interleave.
 */
const request = require("supertest")
const { buildApp } = require("../helpers/appFactory")

let ctx
beforeAll(() => { ctx = buildApp() })

async function eventually(pred, { tries = 50 } = {}) {
  for (let i = 0; i < tries; i += 1) {
    if (pred()) return true
    await new Promise((r) => setImmediate(r))
  }
  return pred()
}

describe("concurrent admin refunds on one order", () => {
  let buyer, admin, product, orderId

  beforeAll(async () => {
    buyer   = ctx.seedUser({ fullName: "Race Buyer", email: "race-buyer@example.com", passwordHash: "$2a$10$x" })
    admin   = ctx.seedUser({ fullName: "Race Admin", email: "race-admin@example.com", role: "admin", passwordHash: "$2a$10$x" })
    product = ctx.prisma.seed("product", { title: "Race Kit", slug: "race-refund-kit", price: 400, isActive: true })
    ctx.prisma.seed("productFile", { productId: product.id, fileName: "kit.zip", filePath: "/x/kit.zip", isPrimary: true, version: "1.0", fileSize: 1 })

    const created = await request(ctx.app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${ctx.signToken(buyer.id)}`)
      .send({ customerEmail: buyer.email, items: [{ productId: product.id, quantity: 1 }] })
    expect(created.status).toBe(201)
    orderId = created.body.data.id

    ctx.mocks.paypalService.capturePaypalOrder.mockResolvedValueOnce({
      id: `PP-${orderId}`, status: "COMPLETED",
      purchase_units: [{ reference_id: orderId, payments: { captures: [{ id: "CAP-RACE", amount: { value: "400.00", currency_code: "MXN" } }] } }],
    })
    const captured = await request(ctx.app)
      .post(`/api/v1/paypal/capture/PP-${orderId}`)
      .set("Authorization", `Bearer ${ctx.signToken(buyer.id)}`)
    expect(captured.status).toBe(200)
    expect(await eventually(() => ctx.prisma.rows("userDownload").some((d) => d.orderId === orderId))).toBe(true)
  })

  test("one refund succeeds, the other is 409 CONFLICT, and the gateway is called once with the claim id", async () => {
    // Hold the provider call open until BOTH requests have passed the
    // read-only guards, so the claim is what decides — not request timing.
    let release
    const gate = new Promise((r) => { release = r })
    ctx.mocks.paypalService.refundPaypalCapture.mockImplementation(async () => {
      await gate
      return { id: "PP-REFUND-RACE", status: "COMPLETED" }
    })
    const post = () => request(ctx.app)
      .post(`/api/v1/admin/orders/${orderId}/refund`)
      .set("Authorization", `Bearer ${ctx.signToken(admin.id)}`)
      .send({ reason: "race" })

    const pending = Promise.all([post(), post()])
    // Let both requests run up to the gateway (or the claim failure).
    for (let i = 0; i < 100; i += 1) await new Promise((r) => setImmediate(r))
    release()
    const [a, b] = await pending

    expect([a.status, b.status].sort()).toEqual([200, 409])
    const loser = a.status === 409 ? a : b
    expect(loser.body.code).toBe("CONFLICT")

    expect(ctx.mocks.paypalService.refundPaypalCapture).toHaveBeenCalledTimes(1)
    const refunds = ctx.prisma.rows("refund").filter((r) => r.orderId === orderId)
    expect(refunds).toHaveLength(1)
    expect(refunds[0]).toMatchObject({ refundStatus: "succeeded", gatewayRefundId: "PP-REFUND-RACE", amount: 400 })
    expect(ctx.mocks.paypalService.refundPaypalCapture).toHaveBeenCalledWith("CAP-RACE", expect.objectContaining({ refundId: refunds[0].id }))

    expect(ctx.prisma.rows("order").find((o) => o.id === orderId).status).toBe("refunded")
    expect(ctx.prisma.rows("userDownload").find((d) => d.orderId === orderId).downloadAccessStatus).toBe("revoked")
    expect(ctx.prisma.rows("adminAuditLog").filter((l) => l.targetId === orderId)).toHaveLength(1)
  })

  test("a provider failure releases the claim so the next attempt can proceed", async () => {
    const buyer2 = ctx.seedUser({ email: "race-buyer-2@example.com", passwordHash: "x" })
    const created = await request(ctx.app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${ctx.signToken(buyer2.id)}`)
      .send({ customerEmail: buyer2.email, items: [{ productId: product.id, quantity: 1 }] })
    const id2 = created.body.data.id
    ctx.mocks.paypalService.capturePaypalOrder.mockResolvedValueOnce({
      id: `PP-${id2}`, status: "COMPLETED",
      purchase_units: [{ reference_id: id2, payments: { captures: [{ id: "CAP-RACE-2", amount: { value: "400.00", currency_code: "MXN" } }] } }],
    })
    expect((await request(ctx.app).post(`/api/v1/paypal/capture/PP-${id2}`).set("Authorization", `Bearer ${ctx.signToken(buyer2.id)}`)).status).toBe(200)

    const post = () => request(ctx.app)
      .post(`/api/v1/admin/orders/${id2}/refund`)
      .set("Authorization", `Bearer ${ctx.signToken(admin.id)}`)
      .send({})

    ctx.mocks.paypalService.refundPaypalCapture.mockRejectedValueOnce(new Error("PayPal: refund failed (503): try later"))
    const failed = await post()
    expect(failed.status).toBe(502)
    expect(failed.body.code).toBe("GATEWAY_ERROR")
    const rows = () => ctx.prisma.rows("refund").filter((r) => r.orderId === id2)
    expect(rows()).toEqual([expect.objectContaining({ refundStatus: "failed", gatewayRefundId: null })])
    expect(ctx.prisma.rows("order").find((o) => o.id === id2).status).toBe("paid")

    ctx.mocks.paypalService.refundPaypalCapture.mockResolvedValueOnce({ id: "PP-REFUND-RETRY", status: "COMPLETED" })
    const retry = await post()
    expect(retry.status).toBe(200)
    expect(rows().map((r) => r.refundStatus).sort()).toEqual(["failed", "succeeded"])
    expect(ctx.prisma.rows("order").find((o) => o.id === id2).status).toBe("refunded")
  })
})
