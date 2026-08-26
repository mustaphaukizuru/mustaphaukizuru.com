/**
 * src/services/analyticsService.getFunnel — G4.
 *
 * The contract, pinned:
 *   - each step counts UNIQUE sessions, never events
 *   - the first step is product-page views (/store/:slug), not any pageview
 *   - stepRate is relative to the previous step, overallRate to the top
 *   - dropOff never goes negative when a later step has more sessions
 *     (a session can begin checkout from a restored cart without a view)
 *   - biggestDropOff names the step with the largest absolute loss
 *   - an empty range yields zeros, not NaN or division errors
 */

jest.mock("../src/lib/prisma", () => ({
  pageView:       { findMany: jest.fn() },
  analyticsEvent: { findMany: jest.fn() },
}))

const prisma = require("../src/lib/prisma")
const { getFunnel } = require("../src/services/analyticsService")

const rows = (...hashes) => hashes.map((sessionHash) => ({ sessionHash }))

beforeEach(() => jest.clearAllMocks())

test("counts unique sessions per step and derives rates and drop-off", async () => {
  prisma.pageView.findMany.mockResolvedValueOnce(rows("a", "b", "c", "d", "e", "f", "g", "h", "i", "j"))
  prisma.analyticsEvent.findMany
    .mockResolvedValueOnce(rows("a", "b", "c", "d"))    // add_to_cart
    .mockResolvedValueOnce(rows("a", "b"))              // begin_checkout
    .mockResolvedValueOnce(rows("a"))                   // purchase

  const funnel = await getFunnel({ daysBack: 30 })

  expect(funnel.steps.map((s) => s.sessions)).toEqual([10, 4, 2, 1])
  expect(funnel.steps.map((s) => s.stepRate)).toEqual([100, 40, 50, 50])
  expect(funnel.steps.map((s) => s.overallRate)).toEqual([100, 40, 20, 10])
  expect(funnel.steps.map((s) => s.dropOff)).toEqual([0, 6, 2, 1])
  expect(funnel.biggestDropOff).toBe("addToCart")
})

test("first step is scoped to product pages within the range", async () => {
  prisma.pageView.findMany.mockResolvedValueOnce([])
  prisma.analyticsEvent.findMany.mockResolvedValue([])

  await getFunnel({ daysBack: 7 })

  const arg = prisma.pageView.findMany.mock.calls[0][0]
  expect(arg.where.path).toEqual({ startsWith: "/store/" })
  expect(arg.where.createdAt.gte).toBeInstanceOf(Date)
  expect(arg.distinct).toEqual(["sessionHash"])
  for (const call of prisma.analyticsEvent.findMany.mock.calls) {
    expect(call[0].distinct).toEqual(["sessionHash"])
  }
  expect(prisma.analyticsEvent.findMany.mock.calls.map((c) => c[0].where.name))
    .toEqual(["add_to_cart", "begin_checkout", "purchase"])
})

test("ignores rows without a session hash and never reports negative drop-off", async () => {
  prisma.pageView.findMany.mockResolvedValueOnce([{ sessionHash: null }, ...rows("a")])
  prisma.analyticsEvent.findMany
    .mockResolvedValueOnce(rows("a", "z"))              // more carts than views
    .mockResolvedValueOnce(rows("a", "z", "y"))
    .mockResolvedValueOnce([])

  const funnel = await getFunnel()

  expect(funnel.steps.map((s) => s.sessions)).toEqual([1, 2, 3, 0])
  expect(funnel.steps.map((s) => s.dropOff)).toEqual([0, 0, 0, 3])
  expect(funnel.biggestDropOff).toBe("purchase")
})

test("an empty range yields zeros, not NaN", async () => {
  prisma.pageView.findMany.mockResolvedValueOnce([])
  prisma.analyticsEvent.findMany.mockResolvedValue([])

  const funnel = await getFunnel({ daysBack: 1 })

  expect(funnel.steps).toHaveLength(4)
  for (const s of funnel.steps) {
    expect(s.sessions).toBe(0)
    expect(s.overallRate).toBe(0)
    expect(s.dropOff).toBe(0)
    expect(Number.isNaN(s.stepRate)).toBe(false)
  }
  expect(funnel.biggestDropOff).toBeNull()
})
