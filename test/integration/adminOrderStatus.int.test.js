/**
 * Integration · T0-3 · PATCH /api/v1/admin/orders/:id/status over HTTP.
 *
 *   refunded → paid is 409; paid → refunded is 400 USE_REFUND_ENDPOINT;
 *   pending → paid creates the UserDownload rows and one AdminAuditLog row
 *   before the response; a second pending → paid is 409.
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

describe("admin order status transitions", () => {
  let buyer, admin, product, orderId

  const patch = (id, status, who = admin) => request(ctx.app)
    .patch(`/api/v1/admin/orders/${id}/status`)
    .set("Authorization", `Bearer ${ctx.signToken(who.id)}`)
    .send({ status })

  beforeAll(async () => {
    buyer   = ctx.seedUser({ fullName: "Status Buyer", email: "status-buyer@example.com", passwordHash: "$2a$10$x" })
    admin   = ctx.seedUser({ fullName: "Status Admin", email: "status-admin@example.com", role: "admin", passwordHash: "$2a$10$x" })
    product = ctx.prisma.seed("product", { title: "Status Kit", slug: "status-kit", price: 150, isActive: true })
    ctx.prisma.seed("productFile", { productId: product.id, fileName: "kit.zip", filePath: "/x/kit.zip", isPrimary: true, version: "1.0", fileSize: 1 })

    const created = await request(ctx.app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${ctx.signToken(buyer.id)}`)
      .send({ customerEmail: buyer.email, items: [{ productId: product.id, quantity: 1 }] })
    expect(created.status).toBe(201)
    orderId = created.body.data.id
  })

  const orderRow = () => ctx.prisma.rows("order").find((o) => o.id === orderId)
  const auditRows = () => ctx.prisma.rows("adminAuditLog").filter((l) => l.targetId === orderId)

  test("a member cannot change order status", async () => {
    expect((await patch(orderId, "paid", buyer)).status).toBe(403)
    expect(orderRow().status).toBe("pending")
  })

  test("an unknown status is 400 INVALID_STATUS, not a 500", async () => {
    const res = await patch(orderId, "shipped")
    expect(res.status).toBe(400)
    expect(res.body.code).toBe("INVALID_STATUS")
  })

  test("the order page is told which moves are allowed", async () => {
    const res = await request(ctx.app)
      .get(`/api/v1/admin/orders/${orderId}`)
      .set("Authorization", `Bearer ${ctx.signToken(admin.id)}`)
    expect(res.status).toBe(200)
    expect(res.body.data.allowedTransitions).toEqual(["paid", "failed", "cancelled"])
  })

  test("pending → paid: entitlements and the audit row exist before the response returns", async () => {
    const res = await patch(orderId, "paid")
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ status: "paid", allowedTransitions: [] })

    // No polling: fulfilment is awaited inside the service.
    const entitlements = ctx.prisma.rows("userDownload").filter((d) => d.orderId === orderId)
    expect(entitlements).toHaveLength(1)
    expect(entitlements[0]).toMatchObject({ userId: buyer.id, productId: product.id, downloadAccessStatus: "active" })
    expect(orderRow().paidAt).toBeInstanceOf(Date)
    expect(ctx.mocks.invoiceService.ensureInvoice).toHaveBeenCalledWith(orderId)

    expect(auditRows()).toEqual([expect.objectContaining({
      adminUserId: admin.id, action: "order.status.set", targetType: "Order",
      beforeJson: { status: "pending", paidAt: null },
      afterJson:  expect.objectContaining({ status: "paid" }),
    })])
    expect(await eventually(() => ctx.mocks.mailer.sendDownloadReadyEmail.mock.calls.length > 0)).toBe(true)
  })

  test("a second pending → paid on the same order is 409 INVALID_TRANSITION", async () => {
    const res = await patch(orderId, "paid")
    expect(res.status).toBe(409)
    expect(res.body.code).toBe("INVALID_TRANSITION")
    expect(res.body.error.details).toMatchObject({ from: "paid", to: "paid", allowed: [] })
    expect(auditRows()).toHaveLength(1)
  })

  test("paid → refunded is 400 USE_REFUND_ENDPOINT and sends no refund email", async () => {
    const res = await patch(orderId, "refunded")
    expect(res.status).toBe(400)
    expect(res.body.code).toBe("USE_REFUND_ENDPOINT")
    expect(orderRow().status).toBe("paid")
    expect(ctx.mocks.mailer.sendOrderRefundedEmail).not.toHaveBeenCalled()
  })

  test("paid → cancelled is 409: paid orders leave only through a refund", async () => {
    const res = await patch(orderId, "cancelled")
    expect(res.status).toBe(409)
    expect(orderRow().status).toBe("paid")
  })

  test("refunded → paid is 409 and does not resurrect the order", async () => {
    // A hand-marked order has no gateway payment to refund, so this one is
    // paid through the (mocked) PayPal capture like a real purchase.
    const created = await request(ctx.app)
      .post("/api/v1/orders")
      .set("Authorization", `Bearer ${ctx.signToken(buyer.id)}`)
      .send({ customerEmail: buyer.email, items: [{ productId: product.id, quantity: 1 }] })
    const id2 = created.body.data.id
    ctx.mocks.paypalService.capturePaypalOrder.mockResolvedValueOnce({
      id: `PP-${id2}`, status: "COMPLETED",
      purchase_units: [{ reference_id: id2, payments: { captures: [{ id: "CAP-STATUS", amount: { value: "150.00", currency_code: "MXN" } }] } }],
    })
    expect((await request(ctx.app).post(`/api/v1/paypal/capture/PP-${id2}`).set("Authorization", `Bearer ${ctx.signToken(buyer.id)}`)).status).toBe(200)
    expect(await eventually(() => ctx.prisma.rows("userDownload").some((d) => d.orderId === id2))).toBe(true)

    const refund = await request(ctx.app)
      .post(`/api/v1/admin/orders/${id2}/refund`)
      .set("Authorization", `Bearer ${ctx.signToken(admin.id)}`)
      .send({})
    expect(refund.status).toBe(200)
    const row = () => ctx.prisma.rows("order").find((o) => o.id === id2)
    expect(row().status).toBe("refunded")

    const res = await patch(id2, "paid")
    expect(res.status).toBe(409)
    expect(res.body.code).toBe("INVALID_TRANSITION")
    expect(row().status).toBe("refunded")
    expect(ctx.prisma.rows("userDownload").find((d) => d.orderId === id2).downloadAccessStatus).toBe("revoked")
  })
})
