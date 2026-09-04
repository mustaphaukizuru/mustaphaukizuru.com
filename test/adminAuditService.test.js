/**
 * T1-4 · the audit list is clamped: page ≥ 1, 1 ≤ limit ≤ 200, and the
 * route no longer touches Prisma itself.
 */
jest.mock("../src/lib/prisma", () => ({ adminAuditLog: { findMany: jest.fn(), count: jest.fn() } }))

const fs = require("fs")
const path = require("path")
const prisma = require("../src/lib/prisma")
const { listAuditLogs, clampPage, clampLimit, MAX_LIMIT, DEFAULT_LIMIT } = require("../src/services/adminAuditService")

beforeEach(() => {
  jest.clearAllMocks()
  prisma.adminAuditLog.findMany.mockResolvedValue([])
  prisma.adminAuditLog.count.mockResolvedValue(0)
})

test("clamps", () => {
  expect(clampPage(undefined)).toBe(1)
  expect(clampPage("0")).toBe(1)
  expect(clampPage("-3")).toBe(1)
  expect(clampPage("4")).toBe(4)
  expect(clampLimit(undefined)).toBe(DEFAULT_LIMIT)
  expect(clampLimit("999999")).toBe(MAX_LIMIT)
  expect(clampLimit("500")).toBe(MAX_LIMIT)
  expect(clampLimit("25")).toBe(25)
  // 0 and junk both mean "unspecified" and take the default, the same way
  // adminEmailLogController reads its limit; a negative floors at 1.
  expect(clampLimit("0")).toBe(DEFAULT_LIMIT)
  expect(clampLimit("nope")).toBe(DEFAULT_LIMIT)
  expect(clampLimit("-7")).toBe(1)
})

test("?limit=999999 becomes take 200, and the page maths uses the clamped values", async () => {
  prisma.adminAuditLog.count.mockResolvedValue(1001)
  const r = await listAuditLogs({ page: "3", limit: "999999" })
  expect(prisma.adminAuditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 400, take: 200 }))
  expect(r.meta).toEqual({ page: 3, limit: 200, total: 1001, pages: 6 })
})

test("the route file has no Prisma access any more", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "src", "routes", "adminAuditRoutes.js"), "utf8")
  expect(src).not.toMatch(/lib\/prisma/)
  expect(src).toMatch(/adminAuditService/)
})
