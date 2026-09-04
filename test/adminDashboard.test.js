/**
 * src/services/adminDashboardService — the admin overview payload.
 *
 * These exist because the page and the service disagreed silently. The panel
 * read `p.title` / `p.quantity`; the service sends `name` / `sales`. Revenue
 * happened to share a name, so the card rendered a correct money figure beside
 * the literal string "Product" and "0 units" — a mismatch that looks like real
 * data and so survived review. The shape is now pinned here.
 *
 * Pinned:
 *   - topProducts entries expose `name` and `sales` (what the page reads)
 *   - service line items (null productId) never occupy a top-seller slot
 *   - activeCustomers counts DISTINCT paying customers, guests included
 *   - a product row whose lookup misses still renders a usable label
 */

jest.mock("../src/lib/prisma", () => ({
  user:        { count: jest.fn() },
  product:     { count: jest.fn(), findMany: jest.fn() },
  order:       { count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn(), aggregate: jest.fn() },
  orderItem:   { groupBy: jest.fn() },
  downloadLog: { count: jest.fn(), groupBy: jest.fn() },
}))

const prisma = require("../src/lib/prisma")
const { getAdminDashboardStats } = require("../src/services/adminDashboardService")

/**
 * The service issues one Promise.all in a fixed order, so the count mocks are
 * queued positionally: user, product, product(active), then the five order
 * counts, then downloadLog.
 */
function arrange({ topRaw = [], lookup = [], payingCustomers = [], recent = [] } = {}) {
  prisma.user.count.mockResolvedValueOnce(41)
  prisma.product.count.mockResolvedValueOnce(9).mockResolvedValueOnce(9)
  prisma.order.count
    .mockResolvedValueOnce(120) // total
    .mockResolvedValueOnce(88)  // paid
    .mockResolvedValueOnce(10)  // pending
    .mockResolvedValueOnce(8)   // failed
    .mockResolvedValueOnce(6)   // refunded
  prisma.downloadLog.count.mockResolvedValueOnce(0)
  prisma.order.findMany.mockResolvedValueOnce(recent)
  prisma.orderItem.groupBy.mockResolvedValueOnce(topRaw)
  prisma.order.groupBy.mockResolvedValueOnce(payingCustomers)
  prisma.order.aggregate.mockResolvedValueOnce({ _sum: { totalAmount: 201_100 } })
  prisma.product.findMany.mockResolvedValueOnce(lookup)
  prisma.downloadLog.groupBy.mockResolvedValueOnce([])
}

const raw = (productId, quantity, lineTotal) => ({ productId, _sum: { quantity, lineTotal } })

beforeEach(() => jest.clearAllMocks())

test("topProducts uses the field names the dashboard panel actually reads", async () => {
  arrange({
    topRaw: [raw("p1", 36, 4320)],
    lookup: [{ id: "p1", title: "IT Infrastructure Audit" }],
  })

  const { topProducts } = await getAdminDashboardStats()

  // `name` and `sales` are the contract. Renaming either silently blanks the
  // panel rather than failing, which is how the original bug shipped.
  expect(topProducts[0]).toMatchObject({
    productId: "p1",
    name: "IT Infrastructure Audit",
    sales: 36,
    revenue: 4320,
  })
})

test("service line items never take a top-seller slot", async () => {
  arrange({ topRaw: [], lookup: [] })

  await getAdminDashboardStats()

  // A null productId groups into its own bucket that is filtered out later, so
  // without this filter the panel quietly shows four rows instead of five.
  expect(prisma.orderItem.groupBy).toHaveBeenCalledWith(
    expect.objectContaining({ where: { productId: { not: null } } })
  )
})

test("activeCustomers counts distinct paying customers, not rows", async () => {
  arrange({
    payingCustomers: [
      { customerEmail: "a@demo.test" },
      { customerEmail: "b@demo.test" },
      { customerEmail: "c@demo.test" },
    ],
  })

  const { stats } = await getAdminDashboardStats()

  expect(stats.activeCustomers).toBe(3)
  // Grouped on customerEmail, not userId: userId is nullable for guest
  // checkout, so grouping on it drops every guest who paid.
  expect(prisma.order.groupBy).toHaveBeenCalledWith(
    expect.objectContaining({ by: ["customerEmail"], where: { status: "paid" } })
  )
})

test("a product row whose lookup misses still renders a label, never undefined", async () => {
  arrange({ topRaw: [raw("gone", 5, 100)], lookup: [] })

  const { topProducts } = await getAdminDashboardStats()

  expect(topProducts).toHaveLength(1)
  expect(topProducts[0].name).toBe("Unknown product")
  expect(topProducts[0].sales).toBe(5)
})

test("the empty state is zeros, never NaN or undefined", async () => {
  arrange()
  prisma.order.aggregate.mockReset().mockResolvedValueOnce({ _sum: { totalAmount: null } })

  const { stats, topProducts } = await getAdminDashboardStats()

  expect(topProducts).toEqual([])
  expect(stats.revenue).toBe(0)
  expect(stats.activeCustomers).toBe(0)
  expect(Number.isNaN(stats.revenue)).toBe(false)
})
