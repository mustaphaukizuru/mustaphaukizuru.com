// ─────────────────────────────────────────────────────────────────────────────
// bioService.getProof — GET /api/v1/bio/proof (Tier 3, proof numbers)
//
//   projects  = published Portfolio rows
//   clients   = distinct ClientProject.userId
//   reviews   = approved Review rows, avgRating rounded to 1 dp
//   years     = whole years since the earliest visible Experience.startDate
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  portfolio:     { count: jest.fn() },
  clientProject: { findMany: jest.fn() },
  review:        { aggregate: jest.fn() },
  experience:    { findFirst: jest.fn(), findMany: jest.fn() },
  education:     { findMany: jest.fn() },
  certificate:   { findMany: jest.fn() },
  skill:         { findMany: jest.fn() },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))

const prisma = require("../src/lib/prisma")
const { getProof, yearsSince } = require("../src/services/bioService")

beforeEach(() => jest.clearAllMocks())

function seed({ projects = 12, clients = ["u1", "u2", "u3"], reviews = 9, avg = 4.6667, start = "2018-03-01" } = {}) {
  prisma.portfolio.count.mockResolvedValue(projects)
  prisma.clientProject.findMany.mockResolvedValue(clients.map((userId) => ({ userId })))
  prisma.review.aggregate.mockResolvedValue({ _count: { _all: reviews }, _avg: { rating: avg } })
  prisma.experience.findFirst.mockResolvedValue(start ? { startDate: new Date(start) } : null)
}

describe("getProof", () => {
  test("aggregates the five counters from the right tables/filters", async () => {
    seed()
    const proof = await getProof()

    expect(proof.projects).toBe(12)
    expect(proof.clients).toBe(3)
    expect(proof.reviews).toBe(9)
    expect(proof.avgRating).toBe(4.7)
    expect(proof.years).toBe(yearsSince(new Date("2018-03-01")))
    expect(proof.years).toBeGreaterThanOrEqual(8)

    expect(prisma.portfolio.count).toHaveBeenCalledWith({ where: { status: "published" } })
    expect(prisma.clientProject.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ distinct: ["userId"] }),
    )
    expect(prisma.review.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "approved" } }),
    )
    expect(prisma.experience.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isVisible: true }, orderBy: { startDate: "asc" } }),
    )
  })

  test("returns zeros on an empty database (no NaN, no nulls)", async () => {
    seed({ projects: 0, clients: [], reviews: 0, avg: null, start: null })
    const proof = await getProof()
    expect(proof).toEqual({ projects: 0, clients: 0, reviews: 0, avgRating: 0, years: 0 })
  })

  test("avgRating is 0 when there are no approved reviews even if _avg is set", async () => {
    seed({ reviews: 0, avg: 5 })
    const proof = await getProof()
    expect(proof.avgRating).toBe(0)
  })

  test("years never goes negative for a future start date", () => {
    expect(yearsSince(new Date(Date.now() + 86_400_000))).toBe(0)
    expect(yearsSince(null)).toBe(0)
    expect(yearsSince("not-a-date")).toBe(0)
    expect(yearsSince(new Date("2020-01-01"), new Date("2026-08-26"))).toBe(6)
    expect(yearsSince(new Date("2020-09-01"), new Date("2026-08-26"))).toBe(5)
  })
})

describe("bioController.proof", () => {
  test("responds with the counters and a 10-minute public Cache-Control", async () => {
    seed()
    const ctrl = require("../src/controllers/bioController")
    const headers = {}
    const res = { set: jest.fn((k, v) => { headers[k] = v }), json: jest.fn(), status: jest.fn().mockReturnThis() }
    const next = jest.fn()
    ctrl.proof({ query: {} }, res, next)
    await new Promise((r) => setImmediate(r))

    expect(next).not.toHaveBeenCalled()
    expect(headers["Cache-Control"]).toMatch(/public, max-age=600/)
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({ projects: 12, clients: 3, reviews: 9, avgRating: 4.7 }),
    })
  })
})
