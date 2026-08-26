// ─────────────────────────────────────────────────────────────────────────────
// T3 · Tiered licensing
//
//   1. mintLicenseKey — LIC-XXXXX-XXXXX-XXXXX-XXXXX, HMAC keyed, deterministic.
//   2. cartService.addItem — licenseTier validated against active licences,
//      price snapshot = licence price, same product + different tier = new line.
//   3. orderService.createOrder — line priced from the licence, licenseTier
//      copied, licenseKey minted by a second write inside the transaction,
//      invalid tier → 400 LICENSE_TIER_INVALID.
//   4. adminProductService — licences sanitised (tier whitelist, dedupe,
//      price) and replaced as a set on update.
//   5. productService.serializeProduct — exposes active licences only.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => {
  const tx = {
    order:       { create: jest.fn() },
    orderItem:   { update: jest.fn() },
    coupon:      { updateMany: jest.fn() },
    couponUsage: { create: jest.fn() },
  }
  return {
    cart:           { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    cartItem:       { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
    product:        { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    productLicense: { findFirst: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
    productFeature: { deleteMany: jest.fn(), createMany: jest.fn() },
    service:        { findUnique: jest.fn() },
    order:          { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn() },
    $transaction:   jest.fn(async (arg) => (typeof arg === "function" ? arg(tx) : Promise.all(arg))),
    __tx: tx,
  }
})
jest.mock("../src/services/couponService", () => ({ validateCoupon: jest.fn(), calculateDiscount: jest.fn() }))
jest.mock("../src/utils/logger", () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() }))
jest.mock("../src/middleware/uploadProductFile", () => ({ PRODUCT_FILE_DIR: "/tmp/files" }))
jest.mock("../src/middleware/uploadProductImage", () => ({ PRODUCT_IMAGE_DIR: "/tmp/images" }))

const prisma = require("../src/lib/prisma")
const { mintLicenseKey } = require("../src/utils/licenseKey")

const SECRET = "x".repeat(64)

beforeEach(() => {
  jest.clearAllMocks()
  process.env.JWT_SECRET = SECRET
  delete process.env.LICENSE_KEY_SECRET
})

/* ── 1. key format ──────────────────────────────────────────────────────── */
describe("mintLicenseKey", () => {
  test("LIC- + 4 groups of 5 hex chars, deterministic, secret-bound", () => {
    const a = mintLicenseKey("oi_1")
    expect(a).toMatch(/^LIC-[0-9A-F]{5}-[0-9A-F]{5}-[0-9A-F]{5}-[0-9A-F]{5}$/)
    expect(mintLicenseKey("oi_1")).toBe(a)
    expect(mintLicenseKey("oi_2")).not.toBe(a)
    expect(mintLicenseKey("oi_1", "other-secret")).not.toBe(a)
    expect(a.length).toBe(4 + 20 + 3)
  })

  test("LICENSE_KEY_SECRET takes precedence over JWT_SECRET", () => {
    const viaJwt = mintLicenseKey("oi_1")
    process.env.LICENSE_KEY_SECRET = "dedicated"
    expect(mintLicenseKey("oi_1")).not.toBe(viaJwt)
    expect(mintLicenseKey("oi_1")).toBe(mintLicenseKey("oi_1", "dedicated"))
  })

  test("throws without any secret", () => {
    delete process.env.JWT_SECRET
    expect(() => mintLicenseKey("oi_1")).toThrow(/SECRET/)
  })
})

/* ── 2. cart ────────────────────────────────────────────────────────────── */
describe("cartService.addItem with licenseTier", () => {
  const { addItem } = require("../src/services/cartService")
  const CART = { id: "cart1", userId: "u1", status: "active", items: [] }

  beforeEach(() => {
    prisma.cart.findFirst.mockResolvedValue(CART)
    prisma.cart.findUnique.mockResolvedValue(CART)
    prisma.cart.update.mockResolvedValue(CART)
    prisma.product.findUnique.mockResolvedValue({ id: "p1", title: "Kit", price: "100.00", isActive: true })
    prisma.cartItem.findFirst.mockResolvedValue(null)
    prisma.cartItem.create.mockResolvedValue({})
  })

  test("snapshots the licence price and stores the tier", async () => {
    prisma.productLicense.findFirst.mockResolvedValue({ tier: "commercial", price: "250.00" })
    await addItem("u1", { productId: "p1", quantity: 1, licenseTier: "Commercial" })
    expect(prisma.productLicense.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { productId: "p1", tier: "commercial", isActive: true },
    }))
    expect(prisma.cartItem.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ productId: "p1", licenseTier: "commercial" }),
    }))
    expect(prisma.cartItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ priceSnapshot: "250.00", licenseTier: "commercial", quantity: 1 }),
    })
  })

  test("no tier → base price, licenseTier null, no licence lookup", async () => {
    await addItem("u1", { productId: "p1", quantity: 2 })
    expect(prisma.productLicense.findFirst).not.toHaveBeenCalled()
    expect(prisma.cartItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ priceSnapshot: "100.00", licenseTier: null, quantity: 2 }),
    })
  })

  test("unknown / inactive tier → 400 LICENSE_TIER_INVALID", async () => {
    prisma.productLicense.findFirst.mockResolvedValue(null)
    await expect(addItem("u1", { productId: "p1", licenseTier: "enterprise" }))
      .rejects.toMatchObject({ statusCode: 400, code: "LICENSE_TIER_INVALID" })
    expect(prisma.cartItem.create).not.toHaveBeenCalled()
  })

  test("licenseTier on a service → 400", async () => {
    prisma.service.findUnique.mockResolvedValue({ id: "s1", title: "Audit", basePrice: "10", status: "active" })
    await expect(addItem("u1", { serviceId: "s1", licenseTier: "personal" }))
      .rejects.toMatchObject({ statusCode: 400, code: "VALIDATION_ERROR" })
  })
})

/* ── 3. order ───────────────────────────────────────────────────────────── */
describe("orderService.createOrder with licence tiers", () => {
  const { createOrder } = require("../src/services/orderService")
  const PRODUCT = {
    id: "p1", title: "Kit", price: "100.00", isActive: true, images: [], files: [],
    licenses: [
      { id: "l1", tier: "personal",   price: "100.00", isActive: true },
      { id: "l2", tier: "commercial", price: "250.00", isActive: true },
    ],
  }
  const payload = { customerName: "Ana", customerEmail: "ana@example.com", userId: "u1" }

  beforeEach(() => {
    prisma.product.findMany.mockResolvedValue([PRODUCT])
    prisma.__tx.order.create.mockImplementation(async ({ data }) => ({
      id: "o1",
      ...data,
      items: data.items.create.map((it, i) => ({ id: `oi_${i + 1}`, ...it, product: PRODUCT })),
      createdAt: new Date(),
    }))
    prisma.__tx.orderItem.update.mockResolvedValue({})
  })

  test("prices from the licence, copies the tier and mints the key inside the tx", async () => {
    const order = await createOrder({ ...payload, items: [{ productId: "p1", quantity: 2, licenseTier: "commercial" }] })

    // licences were requested from Prisma because a tier was asked for
    expect(prisma.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({ licenses: { where: { isActive: true } } }),
    }))

    const created = prisma.__tx.order.create.mock.calls[0][0].data
    expect(created.items.create[0]).toMatchObject({ unitPrice: 250, lineTotal: 500, licenseTier: "commercial" })
    expect(created.subtotalAmount).toBe(500)

    const expectedKey = mintLicenseKey("oi_1")
    expect(prisma.__tx.orderItem.update).toHaveBeenCalledTimes(1)
    expect(prisma.__tx.orderItem.update).toHaveBeenCalledWith({ where: { id: "oi_1" }, data: { licenseKey: expectedKey } })
    expect(order.items[0].licenseKey).toBe(expectedKey)
    expect(order.items[0].licenseTier).toBe("commercial")
    expect(order.totalAmount).toBe(500)
  })

  test("no tier → base price, no key minted, licences not fetched", async () => {
    const order = await createOrder({ ...payload, items: [{ productId: "p1", quantity: 1 }] })
    const include = prisma.product.findMany.mock.calls[0][0].include
    expect(include.licenses).toBeUndefined()
    expect(prisma.__tx.orderItem.update).not.toHaveBeenCalled()
    expect(order.items[0].licenseTier).toBeNull()
    expect(order.items[0].licenseKey).toBeUndefined()
    expect(order.totalAmount).toBe(100)
  })

  test("client cannot buy an inactive/unknown tier", async () => {
    prisma.product.findMany.mockResolvedValue([{
      ...PRODUCT,
      licenses: [{ id: "l3", tier: "enterprise", price: "1.00", isActive: false }],
    }])
    await expect(createOrder({ ...payload, items: [{ productId: "p1", quantity: 1, licenseTier: "enterprise" }] }))
      .rejects.toMatchObject({ statusCode: 400, code: "LICENSE_TIER_INVALID" })
    expect(prisma.__tx.order.create).not.toHaveBeenCalled()
  })
})

/* ── 4. admin ───────────────────────────────────────────────────────────── */
describe("adminProductService licences", () => {
  const { createAdminProduct, updateAdminProduct } = require("../src/services/adminProductService")
  const base = { title: "Kit", slug: "kit", description: "d", price: 100, category: "Templates", isActive: true }

  test("create: sanitises tiers and nests them in the create", async () => {
    prisma.product.create.mockResolvedValue({ id: "p1" })
    await createAdminProduct({
      ...base,
      licenses: [
        { tier: "Commercial", name: "", price: "250", seats: "3" },
        { tier: "personal", name: "Solo", price: 100, currency: "usd", seats: "" },
      ],
    })
    const data = prisma.product.create.mock.calls[0][0].data
    expect(data.licenses.create).toEqual([
      expect.objectContaining({ tier: "commercial", name: "Commercial license", price: 250, seats: 3, currency: "MXN", isActive: true, sortOrder: 0 }),
      expect.objectContaining({ tier: "personal", name: "Solo", price: 100, seats: null, currency: "USD", sortOrder: 1 }),
    ])
  })

  test("update: replaces the set; omitted field leaves rows alone", async () => {
    prisma.product.update.mockResolvedValue({ id: "p1" })
    await updateAdminProduct("p1", { ...base, licenses: [{ tier: "enterprise", price: 999, seats: 50 }] })
    expect(prisma.productLicense.deleteMany).toHaveBeenCalledWith({ where: { productId: "p1" } })
    expect(prisma.productLicense.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ productId: "p1", tier: "enterprise", price: 999, seats: 50 })],
    })

    jest.clearAllMocks()
    prisma.product.update.mockResolvedValue({ id: "p1" })
    await updateAdminProduct("p1", { ...base })
    expect(prisma.productLicense.deleteMany).not.toHaveBeenCalled()
    expect(prisma.productLicense.createMany).not.toHaveBeenCalled()
  })

  test("rejects unknown tier, duplicate tier and bad price", async () => {
    await expect(createAdminProduct({ ...base, licenses: [{ tier: "gold", price: 1 }] }))
      .rejects.toMatchObject({ statusCode: 400 })
    await expect(createAdminProduct({ ...base, licenses: [{ tier: "personal", price: 1 }, { tier: "personal", price: 2 }] }))
      .rejects.toMatchObject({ statusCode: 400 })
    await expect(createAdminProduct({ ...base, licenses: [{ tier: "personal", price: -1 }] }))
      .rejects.toMatchObject({ statusCode: 400 })
    expect(prisma.product.create).not.toHaveBeenCalled()
  })
})

/* ── 5. public serializer ───────────────────────────────────────────────── */
describe("productService.serializeProduct licences", () => {
  const { serializeProduct } = require("../src/services/productService")

  test("exposes active licences sorted by sortOrder with numeric prices", () => {
    const out = serializeProduct({
      id: "p1", title: "Kit", price: "100.00", currency: "MXN",
      licenses: [
        { id: "l2", tier: "commercial", name: "Team", price: "250.00", currency: "MXN", seats: 5, isActive: true, sortOrder: 1 },
        { id: "l1", tier: "personal",   name: "Solo", price: "100.00", currency: "MXN", seats: null, isActive: true, sortOrder: 0 },
        { id: "l3", tier: "enterprise", name: "Corp", price: "999.00", currency: "MXN", seats: 50, isActive: false, sortOrder: 2 },
      ],
    })
    expect(out.licenses.map((l) => l.tier)).toEqual(["personal", "commercial"])
    expect(out.licenses[1]).toMatchObject({ price: 250, seats: 5, currency: "MXN" })
    expect(typeof out.licenses[1].priceFormatted).toBe("string")
  })

  test("no licences → empty array", () => {
    expect(serializeProduct({ id: "p1", title: "Kit", price: "1" }).licenses).toEqual([])
  })
})
