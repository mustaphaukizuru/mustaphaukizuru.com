/**
 * blogService.listArchive — SQL-grouped blog archive.
 *
 * listArchive used to pull EVERY published post and bucket it by month in a
 * JS loop, so both work and memory grew with the archive for a response that
 * only ever contains one row per month. It now groups in MySQL.
 *
 * These tests pin the contract that swap has to preserve — the response shape
 * the blog nav consumes — plus the two ways a raw query like this goes wrong:
 * BigInt counts (JSON.stringify throws on them, which would 500 the route)
 * and month labels being derived from a string rather than a Date.
 */

jest.mock("../src/lib/prisma", () => ({
  $queryRaw: jest.fn(),
  blogPost: { findMany: jest.fn() },
}))

const prisma = require("../src/lib/prisma")
const blogService = require("../src/services/blogService")

describe("blogService.listArchive", () => {
  beforeEach(() => jest.clearAllMocks())

  test("returns { key, label, count } newest-first", async () => {
    prisma.$queryRaw.mockResolvedValue([
      { ym: "2026-08", count: 4 },
      { ym: "2026-07", count: 1 },
    ])

    const out = await blogService.listArchive()

    expect(out).toEqual([
      { key: "2026-08", label: "August 2026", count: 4 },
      { key: "2026-07", label: "July 2026", count: 1 },
    ])
  })

  test("coerces BigInt counts — JSON.stringify throws on BigInt", async () => {
    // The MySQL driver returns COUNT(*) as BigInt. If that reaches the
    // response serialiser the route 500s, so the coercion is load-bearing.
    prisma.$queryRaw.mockResolvedValue([{ ym: "2026-08", count: 7n }])

    const out = await blogService.listArchive()

    expect(typeof out[0].count).toBe("number")
    expect(out[0].count).toBe(7)
    expect(() => JSON.stringify(out)).not.toThrow()
  })

  test("builds the label from the month, not from a parsed date string", async () => {
    // `new Date("2026-01")` is UTC-parsed and can render as December in
    // negative-offset zones. Constructing from numeric parts avoids that.
    prisma.$queryRaw.mockResolvedValue([{ ym: "2026-01", count: 2 }])

    const out = await blogService.listArchive()

    expect(out[0].label).toBe("January 2026")
  })

  test("returns an empty array when there are no posts", async () => {
    prisma.$queryRaw.mockResolvedValue([])
    await expect(blogService.listArchive()).resolves.toEqual([])
  })

  test("no longer loads every post to build the archive", async () => {
    prisma.$queryRaw.mockResolvedValue([{ ym: "2026-08", count: 1 }])

    await blogService.listArchive()

    // The whole point of the change: one grouped query, zero row scans.
    expect(prisma.blogPost.findMany).not.toHaveBeenCalled()
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
  })
})
